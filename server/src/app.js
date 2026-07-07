import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import authRoutes from './routes/auth.routes.js';
import followRoutes from './routes/follow.routes.js';
import notificationRoutes from './routes/notification.routes.js';
import postRoutes from './routes/post.routes.js';
import searchRoutes from './routes/search.routes.js';
import timelineRoutes from './routes/timeline.routes.js';
import userRoutes from './routes/user.routes.js';
import webfingerRoutes from './routes/webfinger.routes.js';

export const app = express();

app.use(helmet());
app.use(
  cors({
    origin: process.env.CLIENT_URL || true,
    credentials: true,
  })
);
app.use(
  express.json({
    limit: '1mb',
    type: ['application/json', 'application/activity+json', 'application/ld+json'],
    verify: (req, res, buffer) => {
      req.rawBody = buffer;
    },
  })
);
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.use('/auth', authRoutes);
app.use('/follows', followRoutes);
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
