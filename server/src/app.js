import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { prisma } from './db.js';
import {
  cacheRemoteImage,
  getMediaStorageDir,
  getPostMediaUrl,
} from './services/media.service.js';
import authRoutes from './routes/auth.routes.js';
import bookmarkRoutes from './routes/bookmark.routes.js';
import followRoutes from './routes/follow.routes.js';
import instanceDirectoryRoutes from './routes/instance-directory.routes.js';
import instanceRoutes from './routes/instance.routes.js';
import notificationRoutes from './routes/notification.routes.js';
import postRoutes from './routes/post.routes.js';
import searchRoutes from './routes/search.routes.js';
import timelineRoutes from './routes/timeline.routes.js';
import userRoutes from './routes/user.routes.js';
import webfingerRoutes from './routes/webfinger.routes.js';

export const app = express();

function getAllowedOrigins() {
  const origins = [process.env.CLIENT_URL, process.env.CLIENT_URLS]
    .filter(Boolean)
    .flatMap((value) => value.split(','))
    .map((origin) => origin.trim().replace(/\/$/, ''))
    .filter(Boolean);

  return [...new Set(origins)];
}

function isAllowedOrigin(origin) {
  if (!origin) return true;
  if (process.env.NODE_ENV !== 'production' && /^https?:\/\/localhost(:\d+)?$/.test(origin)) {
    return true;
  }

  const allowedOrigins = getAllowedOrigins();
  if (!allowedOrigins.length) return process.env.NODE_ENV !== 'production';

  return allowedOrigins.includes(origin.replace(/\/$/, ''));
}

app.set('trust proxy', 1);
app.use(helmet());
app.get('/media/:postId', async (req, res, next) => {
  try {
    const post = await prisma.post.findUnique({
      where: { id: String(req.params.postId) },
      select: {
        id: true,
        mediaUrl: true,
        remoteAuthorId: true,
        mediaAsset: { select: { data: true, mediaType: true } },
      },
    });
    if (!post) return next();

    let asset = post.mediaAsset;
    if (!asset && post.remoteAuthorId && /^https:\/\//i.test(post.mediaUrl || '')) {
      try {
        const cached = await cacheRemoteImage(post.mediaUrl);
        asset = { data: cached.bytes, mediaType: cached.mediaType };
        await prisma.$transaction([
          prisma.postMedia.upsert({
            where: { postId: post.id },
            update: { mediaType: asset.mediaType, data: asset.bytes },
            create: { postId: post.id, mediaType: asset.mediaType, data: asset.bytes },
          }),
          prisma.post.update({
            where: { id: post.id },
            data: { mediaUrl: getPostMediaUrl(post.id), mediaType: asset.mediaType },
          }),
        ]);
      } catch (error) {
        console.warn(`Unable to load media for post ${post.id}: ${error.message}`);
        return res.status(502).json({ message: 'Remote image is currently unavailable.' });
      }
    }

    if (!asset?.data || !asset.mediaType) return next();

    res.set({
      'Content-Type': asset.mediaType,
      'Content-Length': String(asset.data.length),
      'Cache-Control': 'public, max-age=31536000, immutable',
      'Cross-Origin-Resource-Policy': 'cross-origin',
      'X-Content-Type-Options': 'nosniff',
    });
    return res.status(200).send(Buffer.from(asset.data));
  } catch (error) {
    return next(error);
  }
});
app.use('/media', express.static(getMediaStorageDir(), {
  dotfiles: 'deny',
  index: false,
  maxAge: '1y',
  immutable: true,
  setHeaders(res) {
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  },
}));
app.use(
  cors({
    origin(origin, callback) {
      if (isAllowedOrigin(origin)) return callback(null, true);
      return callback(new Error('Not allowed by CORS.'));
    },
    credentials: true,
  })
);
app.use(
  express.json({
    limit: '7mb',
    type: ['application/json', 'application/activity+json', 'application/ld+json'],
    verify: (req, res, buffer) => {
      req.rawBody = buffer;
    }
  })
);
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.use('/auth', authRoutes);
app.use('/bookmarks', bookmarkRoutes);
app.use('/follows', followRoutes);
app.use('/instance', instanceRoutes);
app.use('/instances', instanceDirectoryRoutes);
app.use('/notifications', notificationRoutes);
app.use('/posts', postRoutes);
app.use('/search', searchRoutes);
app.use('/timeline', timelineRoutes);
app.use('/.well-known', webfingerRoutes);
app.use('/users', userRoutes);

app.use((req, res) => {
  res.status(404).json({ message: 'Route not found.' });
});

app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);

  console.error(err);
  return res.status(err.status || 500).json({
    message: err.message || 'Internal server error.',
  });
});
