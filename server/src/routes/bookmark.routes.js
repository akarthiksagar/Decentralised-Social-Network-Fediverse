import { Router } from 'express';
import { prisma } from '../db.js';
import { authenticate } from '../middleware/authenticate.js';
import { getPostInclude, serializePost } from './post.routes.js';

const router = Router();
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

router.get('/', authenticate, async (req, res, next) => {
  try {
    const requestedLimit = Number(req.query.limit) || DEFAULT_LIMIT;
    const limit = Math.min(Math.max(requestedLimit, 1), MAX_LIMIT);
    const cursor = req.query.cursor ? String(req.query.cursor) : null;

    const bookmarks = await prisma.bookmark.findMany({
      where: { userId: req.user.id },
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      orderBy: { createdAt: 'desc' },
      include: {
        post: {
          include: getPostInclude(req.user.id),
        },
      },
    });
    const hasMore = bookmarks.length > limit;
    const visibleBookmarks = hasMore ? bookmarks.slice(0, limit) : bookmarks;

    return res.json({
      posts: visibleBookmarks.map((bookmark) => ({
        ...serializePost(bookmark.post),
        isBookmarked: true,
        bookmarkedAt: bookmark.createdAt,
      })),
      nextCursor: hasMore ? visibleBookmarks[visibleBookmarks.length - 1]?.id || null : null,
    });
  } catch (error) {
    next(error);
  }
});

router.post('/:postId', authenticate, async (req, res, next) => {
  try {
    const postId = String(req.params.postId);
    const post = await prisma.post.findUnique({ where: { id: postId } });

    if (!post) {
      return res.status(404).json({ message: 'Post not found.' });
    }

    const bookmark = await prisma.bookmark.upsert({
      where: {
        userId_postId: {
          userId: req.user.id,
          postId,
        },
      },
      update: {},
      create: {
        userId: req.user.id,
        postId,
      },
    });

    return res.status(201).json({ bookmark });
  } catch (error) {
    next(error);
  }
});

router.delete('/:postId', authenticate, async (req, res, next) => {
  try {
    await prisma.bookmark.deleteMany({
      where: {
        userId: req.user.id,
        postId: String(req.params.postId),
      },
    });

    return res.status(204).send();
  } catch (error) {
    next(error);
  }
});

export default router;
