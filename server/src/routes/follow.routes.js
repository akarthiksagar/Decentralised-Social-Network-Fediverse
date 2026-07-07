import { Router } from 'express';
import { prisma } from '../db.js';
import { authenticate } from '../middleware/authenticate.js';
import { ensureActivityPubIdentity } from '../services/actor.service.js';
import {
  enqueueActivityDelivery,
  recordOutboundActivity,
} from '../services/delivery.service.js';
import { createNotification } from '../services/notification.service.js';
import {
  discoverRemoteActor,
  serializeRemoteActor,
} from '../services/remoteDiscovery.service.js';
import {
  serializeFollowActivity,
  serializeUndoActivity,
} from '../utils/activitypub.js';

const router = Router();

router.get('/remote/lookup', authenticate, async (req, res, next) => {
  try {
    const { remoteActor } = await discoverRemoteActor({
      handle: req.query.handle,
      actorUrl: req.query.actorUrl,
    });
    const relationship = await prisma.remoteFollowing.findUnique({
      where: {
        userId_remoteActorId: {
          userId: req.user.id,
          remoteActorId: remoteActor.id,
        },
      },
    });

    return res.json({
      actor: serializeRemoteActor(remoteActor, relationship),
    });
  } catch (error) {
    error.status = error.status || 400;
    next(error);
  }
});

router.post('/remote', authenticate, async (req, res, next) => {
  try {
    const actor = await ensureActivityPubIdentity(req.user);
    const { remoteActor } = await discoverRemoteActor({
      handle: req.body.handle,
      actorUrl: req.body.actorUrl,
    });

    if (remoteActor.actorUrl === actor.actorUrl) {
      return res.status(400).json({ message: 'You cannot follow yourself.' });
    }

    if (!remoteActor.inboxUrl) {
      return res.status(422).json({ message: 'Remote actor does not expose an inbox.' });
    }

    const activity = serializeFollowActivity(actor, remoteActor);
    await recordOutboundActivity(activity);

    const follow = await prisma.remoteFollowing.upsert({
      where: {
        userId_remoteActorId: {
          userId: actor.id,
          remoteActorId: remoteActor.id,
        },
      },
      update: {
        activityId: activity.id,
        status: 'PENDING',
      },
      create: {
        userId: actor.id,
        remoteActorId: remoteActor.id,
        activityId: activity.id,
        status: 'PENDING',
      },
    });

    await enqueueActivityDelivery({
      actor,
      inboxUrl: remoteActor.inboxUrl,
      activity,
    });

    return res.status(202).json({
      follow,
      actor: serializeRemoteActor(remoteActor, follow),
    });
  } catch (error) {
    error.status = error.status || 400;
    next(error);
  }
});

router.delete('/remote/:remoteActorId', authenticate, async (req, res, next) => {
  try {
    const actor = await ensureActivityPubIdentity(req.user);
    const remoteActorId = String(req.params.remoteActorId);
    const follow = await prisma.remoteFollowing.findUnique({
      where: {
        userId_remoteActorId: {
          userId: actor.id,
          remoteActorId,
        },
      },
      include: { remoteActor: true },
    });

    if (!follow) {
      return res.status(204).send();
    }

    if (follow.remoteActor.inboxUrl && follow.activityId) {
      const followActivity = {
        ...serializeFollowActivity(actor, follow.remoteActor),
        id: follow.activityId,
      };
      const undoActivity = serializeUndoActivity(actor, followActivity);
      await recordOutboundActivity(undoActivity);
      await enqueueActivityDelivery({
        actor,
        inboxUrl: follow.remoteActor.inboxUrl,
        activity: undoActivity,
      });
    }

    await prisma.remoteFollowing.delete({
      where: {
        userId_remoteActorId: {
          userId: actor.id,
          remoteActorId,
        },
      },
    });

    return res.status(204).send();
  } catch (error) {
    next(error);
  }
});

router.post('/:userId', authenticate, async (req, res, next) => {
  try {
    const followingId = String(req.params.userId);

    if (followingId === req.user.id) {
      return res.status(400).json({ message: 'You cannot follow yourself.' });
    }

    const following = await prisma.user.findUnique({ where: { id: followingId } });
    if (!following) {
      return res.status(404).json({ message: 'User not found.' });
    }

    const follow = await prisma.follow.upsert({
      where: {
        followerId_followingId: {
          followerId: req.user.id,
          followingId,
        },
      },
      update: { status: 'ACCEPTED' },
      create: {
        followerId: req.user.id,
        followingId,
        status: 'ACCEPTED',
      },
    });
    await createNotification(prisma, {
      userId: following.id,
      type: 'FOLLOW',
      actorUrl: req.user.actorUrl,
      title: `${req.user.name || req.user.username} followed you`,
      body: `@${req.user.username}@${req.user.server}`,
      data: {
        followerId: req.user.id,
      },
    });

    return res.status(201).json({ follow });
  } catch (error) {
    next(error);
  }
});

router.delete('/:userId', authenticate, async (req, res, next) => {
  try {
    const followingId = String(req.params.userId);

    await prisma.follow.deleteMany({
      where: {
        followerId: req.user.id,
        followingId,
      },
    });

    return res.status(204).send();
  } catch (error) {
    next(error);
  }
});

router.get('/following/list', authenticate, async (req, res, next) => {
  try {
    const follows = await prisma.follow.findMany({
      where: {
        followerId: req.user.id,
        status: 'ACCEPTED',
      },
      include: {
        following: true,
      },
      orderBy: { createdAt: 'desc' },
    });
    const remoteFollows = await prisma.remoteFollowing.findMany({
      where: {
        userId: req.user.id,
        status: { in: ['PENDING', 'ACCEPTED'] },
      },
      include: {
        remoteActor: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return res.json({
      users: follows.map((follow) => ({
        id: follow.following.id,
        name: follow.following.name,
        username: follow.following.username,
        server: follow.following.server,
        actorUrl: follow.following.actorUrl,
        bio: follow.following.bio,
      })),
      remoteUsers: remoteFollows.map((follow) => serializeRemoteActor(follow.remoteActor, follow)),
    });
  } catch (error) {
    next(error);
  }
});

export default router;
