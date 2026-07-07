import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../db.js';
import { authenticate } from '../middleware/authenticate.js';
import {
  serializeNotification,
  subscribeToNotifications,
} from '../services/notification.service.js';

const router = Router();
const DEFAULT_LIMIT = 30;
const MAX_LIMIT = 60;

async function authenticateStream(req, res) {
  const header = req.headers.authorization;
  const headerToken = header?.startsWith('Bearer ') ? header.slice(7) : null;
  const token = headerToken || (req.query.token ? String(req.query.token) : null);

  if (!token) {
    res.status(401).json({ message: 'Authentication token is required.' });
    return null;
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET || 'change-this-development-secret');
    const user = await prisma.user.findUnique({ where: { id: payload.sub } });

    if (!user) {
      res.status(401).json({ message: 'User no longer exists.' });
      return null;
    }

    return user;
  } catch {
    res.status(401).json({ message: 'Invalid or expired token.' });
    return null;
  }
}

function sendEvent(res, event, data) {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

router.get('/stream', async (req, res, next) => {
  try {
    const user = await authenticateStream(req, res);
    if (!user) return;

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    res.flushHeaders?.();

    const unreadCount = await prisma.notification.count({
      where: {
        userId: user.id,
        readAt: null,
      },
    });
    sendEvent(res, 'connected', { unreadCount });

    const unsubscribe = subscribeToNotifications(user.id, (notification) => {
      sendEvent(res, 'notification', notification);
    });
    const heartbeat = setInterval(() => {
      sendEvent(res, 'heartbeat', { now: new Date().toISOString() });
    }, 25000);

    req.on('close', () => {
      clearInterval(heartbeat);
      unsubscribe();
      res.end();
    });
  } catch (error) {
    next(error);
  }
});

router.get('/', authenticate, async (req, res, next) => {
  try {
    const requestedLimit = Number(req.query.limit) || DEFAULT_LIMIT;
    const limit = Math.min(Math.max(requestedLimit, 1), MAX_LIMIT);
    const cursor = req.query.cursor ? String(req.query.cursor) : null;

    const notifications = await prisma.notification.findMany({
      where: { userId: req.user.id },
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      orderBy: { createdAt: 'desc' },
    });
    const unreadCount = await prisma.notification.count({
      where: {
        userId: req.user.id,
        readAt: null,
      },
    });
    const hasMore = notifications.length > limit;
    const visibleNotifications = hasMore ? notifications.slice(0, limit) : notifications;

    return res.json({
      notifications: visibleNotifications.map(serializeNotification),
      unreadCount,
      nextCursor: hasMore
        ? visibleNotifications[visibleNotifications.length - 1]?.id || null
        : null,
    });
  } catch (error) {
    next(error);
  }
});

router.patch('/:notificationId/read', authenticate, async (req, res, next) => {
  try {
    await prisma.notification.updateMany({
      where: {
        id: String(req.params.notificationId),
        userId: req.user.id,
      },
      data: {
        readAt: new Date(),
      },
    });
    const notification = await prisma.notification.findFirst({
      where: {
        id: String(req.params.notificationId),
        userId: req.user.id,
      },
    });

    if (!notification) {
      return res.status(404).json({ message: 'Notification not found.' });
    }

    return res.json({ notification: serializeNotification(notification) });
  } catch (error) {
    next(error);
  }
});

router.post('/read-all', authenticate, async (req, res, next) => {
  try {
    const result = await prisma.notification.updateMany({
      where: {
        userId: req.user.id,
        readAt: null,
      },
      data: {
        readAt: new Date(),
      },
    });

    return res.json({ updated: result.count });
  } catch (error) {
    next(error);
  }
});

export default router;
