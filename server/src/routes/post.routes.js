import { randomUUID } from 'crypto';
import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../db.js';
import { authenticate } from '../middleware/authenticate.js';
import { ensureActivityPubIdentity } from '../services/actor.service.js';
import {
  enqueueActivityDelivery,
  recordOutboundActivity,
} from '../services/delivery.service.js';
import {
  actorDisplayName,
  actorHandle,
  createNotification,
  truncateNotificationBody,
} from '../services/notification.service.js';
import { discoverRemoteActor } from '../services/remoteDiscovery.service.js';
import { serializeCreateActivity } from '../utils/activitypub.js';
import { getJwtSecret } from '../utils/auth.js';

const router = Router();
const MAX_POST_LENGTH = 500;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;
const ALLOWED_VISIBILITY = new Set(['PUBLIC', 'UNLISTED', 'FOLLOWERS', 'DIRECT']);

function extractTags(content) {
  const tags = content.match(/#[a-zA-Z0-9_]+/g) || [];
  return [...new Set(tags.map((tag) => tag.slice(1).toLowerCase()))];
}

export function serializePost(post) {
  const actor = post.author || post.remoteAuthor;

  return {
    id: post.id,
    body: post.content,
    visibility: post.visibility,
    author: actor?.name || actor?.username || 'Unknown actor',
    username: actor?.username || 'unknown',
    server: actor?.server || 'unknown',
    actorUrl: actor?.actorUrl,
    time: post.createdAt,
    tags: extractTags(post.content),
    replies: post.replyCount,
    reposts: post.boostCount,
    likes: post.likeCount,
    isLocal: post.isLocal,
    isLiked: Boolean(post.likes?.length),
    activityId: post.activityId,
    parentId: post.parentId,
  };
}

function getViewerId(req) {
  try {
    const header = req.headers.authorization;
    const token = header?.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) return null;

    const payload = jwt.verify(token, getJwtSecret());
    return payload.sub || null;
  } catch {
    return null;
  }
}

export function getPostInclude(viewerId = null) {
  return {
    author: true,
    remoteAuthor: true,
    ...(viewerId
      ? {
          likes: {
            where: { userId: viewerId },
            select: { id: true },
          },
        }
      : {}),
  };
}

function normalizeVisibility(value) {
  const visibility = String(value || 'PUBLIC').toUpperCase();
  return ALLOWED_VISIBILITY.has(visibility) ? visibility : 'PUBLIC';
}

async function getDeliverableInbox(remoteActor) {
  if (remoteActor?.inboxUrl) return remoteActor.inboxUrl;
  if (!remoteActor?.actorUrl) return null;

  try {
    const { remoteActor: resolvedActor } = await discoverRemoteActor({
      actorUrl: remoteActor.actorUrl,
    });
    return resolvedActor.inboxUrl || null;
  } catch {
    return null;
  }
}

router.get('/', async (req, res, next) => {
  try {
    const viewerId = getViewerId(req);
    const requestedLimit = Number(req.query.limit) || DEFAULT_LIMIT;
    const limit = Math.min(Math.max(requestedLimit, 1), MAX_LIMIT);
    const cursor = req.query.cursor ? String(req.query.cursor) : null;

    const posts = await prisma.post.findMany({
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      orderBy: { createdAt: 'desc' },
      include: getPostInclude(viewerId),
    });

    const hasMore = posts.length > limit;
    const visiblePosts = hasMore ? posts.slice(0, limit) : posts;

    return res.json({
      posts: visiblePosts.map(serializePost),
      nextCursor: hasMore ? visiblePosts[visiblePosts.length - 1]?.id : null,
    });
  } catch (error) {
    next(error);
  }
});

router.post('/:postId/like', authenticate, async (req, res, next) => {
  try {
    const postId = String(req.params.postId);
    const post = await prisma.post.findUnique({
      where: { id: postId },
      include: { author: true },
    });

    if (!post) {
      return res.status(404).json({ message: 'Post not found.' });
    }

    let liked = true;
    let updatedPost = post;
    let like = null;

    try {
      like = await prisma.like.create({
        data: {
          userId: req.user.id,
          postId,
        },
      });
      updatedPost = await prisma.post.update({
        where: { id: postId },
        data: { likeCount: { increment: 1 } },
      });
    } catch (error) {
      if (error.code !== 'P2002') throw error;
      liked = true;
    }

    if (like && post.authorId && post.authorId !== req.user.id) {
      await createNotification(prisma, {
        userId: post.authorId,
        type: 'LIKE',
        actorUrl: req.user.actorUrl,
        title: `${actorDisplayName(req.user)} liked your post`,
        body: truncateNotificationBody(post.content),
        data: {
          postId,
          likeId: like.id,
          actorHandle: actorHandle(req.user),
        },
      });
    }

    return res.status(201).json({
      liked,
      likes: updatedPost.likeCount,
    });
  } catch (error) {
    next(error);
  }
});

router.delete('/:postId/like', authenticate, async (req, res, next) => {
  try {
    const postId = String(req.params.postId);
    const deleted = await prisma.like.deleteMany({
      where: {
        userId: req.user.id,
        postId,
      },
    });

    let post = await prisma.post.findUnique({ where: { id: postId } });
    if (!post) {
      return res.status(404).json({ message: 'Post not found.' });
    }

    if (deleted.count > 0) {
      post = await prisma.post.update({
        where: { id: postId },
        data: { likeCount: { decrement: post.likeCount > 0 ? 1 : 0 } },
      });
    }

    return res.json({
      liked: false,
      likes: post.likeCount,
    });
  } catch (error) {
    next(error);
  }
});

router.post('/', authenticate, async (req, res, next) => {
  try {
    const content = String(req.body.content || '').trim();
    const visibility = normalizeVisibility(req.body.visibility);
    const parentId = req.body.parentId ? String(req.body.parentId) : null;

    if (!content) {
      return res.status(400).json({ message: 'Post content is required.' });
    }

    if (content.length > MAX_POST_LENGTH) {
      return res.status(400).json({ message: `Posts must be ${MAX_POST_LENGTH} characters or less.` });
    }

    if (parentId) {
      const parent = await prisma.post.findUnique({ where: { id: parentId } });
      if (!parent) {
        return res.status(404).json({ message: 'Parent post not found.' });
      }
    }

    const actor = await ensureActivityPubIdentity(req.user);
    const post = await prisma.post.create({
      data: {
        content,
        visibility,
        parentId,
        authorId: actor.id,
        activityId: `${process.env.PUBLIC_BASE_URL || 'http://localhost:3000'}/activities/${randomUUID()}`,
      },
      include: { author: true },
    });

    if (parentId) {
      await prisma.post.update({
        where: { id: parentId },
        data: { replyCount: { increment: 1 } },
      });
    }

    if (visibility !== 'DIRECT') {
      const activity = serializeCreateActivity(post);
      await recordOutboundActivity(activity);

      const remoteFollowers = await prisma.remoteFollow.findMany({
        where: {
          userId: actor.id,
          status: 'ACCEPTED',
        },
        include: { remoteActor: true },
      });

      await Promise.allSettled(
        remoteFollowers.map(async (follow) => {
          const inboxUrl = await getDeliverableInbox(follow.remoteActor);
          if (!inboxUrl) return null;

          return enqueueActivityDelivery({
            actor,
            inboxUrl,
            activity,
          });
        })
      );
    }

    return res.status(201).json({ post: serializePost(post) });
  } catch (error) {
    next(error);
  }
});

export default router;
