import { Router } from 'express';
import { prisma } from '../db.js';
import { authenticate } from '../middleware/authenticate.js';
import { serializePost } from './post.routes.js';

const router = Router();
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

router.get('/home', authenticate, async (req, res, next) => {
  try {
    const requestedLimit = Number(req.query.limit) || DEFAULT_LIMIT;
    const limit = Math.min(Math.max(requestedLimit, 1), MAX_LIMIT);
    const cursor = req.query.cursor ? String(req.query.cursor) : null;

    const follows = await prisma.follow.findMany({
      where: {
        followerId: req.user.id,
        status: 'ACCEPTED',
      },
      select: { followingId: true },
    });
    const remoteFollows = await prisma.remoteFollowing.findMany({
      where: {
        userId: req.user.id,
        status: 'ACCEPTED',
      },
      include: { remoteActor: true },
    });
    const remoteActorUrls = remoteFollows.map((follow) => follow.remoteActor.actorUrl);
    const matchingLocalRemoteActors = remoteActorUrls.length
      ? await prisma.user.findMany({
          where: {
            actorUrl: { in: remoteActorUrls },
          },
          select: { id: true },
        })
      : [];
    const authorIds = [
      req.user.id,
      ...follows.map((follow) => follow.followingId),
      ...matchingLocalRemoteActors.map((actor) => actor.id),
    ];
    const remoteAuthorIds = remoteFollows.map((follow) => follow.remoteActorId);

    const posts = await prisma.post.findMany({
      where: {
        OR: [
          {
            authorId: { in: authorIds },
            visibility: { in: ['PUBLIC', 'UNLISTED', 'FOLLOWERS'] },
          },
          {
            remoteAuthorId: { in: remoteAuthorIds },
            visibility: { in: ['PUBLIC', 'UNLISTED'] },
          },
        ],
      },
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      orderBy: { createdAt: 'desc' },
      include: { author: true, remoteAuthor: true },
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

export default router;
