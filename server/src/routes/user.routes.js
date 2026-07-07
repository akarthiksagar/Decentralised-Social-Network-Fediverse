import { Router } from 'express';
import { randomUUID } from 'crypto';
import { prisma } from '../db.js';
import { authenticate } from '../middleware/authenticate.js';
import { verifyActivityPubHttpSignature } from '../middleware/httpSignature.js';
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
import {
  buildActorUrls,
  serializeActor,
  serializeCreateActivity,
} from '../utils/activitypub.js';

const router = Router();

function getActivityId(activity) {
  return typeof activity?.id === 'string' && activity.id.trim() ? activity.id.trim() : null;
}

function getActivityType(activity) {
  return typeof activity?.type === 'string' ? activity.type : null;
}

function getActorUrl(activity) {
  return typeof activity?.actor === 'string' ? activity.actor : activity?.actor?.id || null;
}

function getObjectId(object) {
  if (typeof object === 'string') return object;
  if (typeof object?.id === 'string') return object.id;
  return null;
}

function parseActorUrl(actorUrl) {
  try {
    const url = new URL(actorUrl);
    const segments = url.pathname.split('/').filter(Boolean);
    const username = segments[segments.length - 1] || url.hostname;

    return {
      username: username.toLowerCase(),
      server: url.host.toLowerCase(),
    };
  } catch {
    return {
      username: 'remote',
      server: 'unknown',
    };
  }
}

async function recordInboundActivity(activity) {
  const activityId = getActivityId(activity);
  const data = {
    type: getActivityType(activity) || 'Unknown',
    actorUrl: getActorUrl(activity),
    direction: 'INBOUND',
    raw: activity,
  };

  if (!activityId) {
    return prisma.federationActivity.create({ data });
  }

  return prisma.federationActivity.upsert({
    where: { activityId },
    update: data,
    create: {
      ...data,
      activityId,
    },
  });
}

async function upsertRemoteActor(actorUrl, object = {}) {
  const parsed = parseActorUrl(actorUrl);
  const publicKeyPem =
    typeof object?.publicKey?.publicKeyPem === 'string' ? object.publicKey.publicKeyPem : undefined;

  return prisma.remoteActor.upsert({
    where: { actorUrl },
    update: {
      username: parsed.username,
      server: parsed.server,
      inboxUrl: typeof object?.inbox === 'string' ? object.inbox : undefined,
      outboxUrl: typeof object?.outbox === 'string' ? object.outbox : undefined,
      publicKeyPem,
      name: typeof object?.name === 'string' ? object.name : undefined,
    },
    create: {
      actorUrl,
      username: parsed.username,
      server: parsed.server,
      inboxUrl: typeof object?.inbox === 'string' ? object.inbox : undefined,
      outboxUrl: typeof object?.outbox === 'string' ? object.outbox : undefined,
      publicKeyPem,
      name: typeof object?.name === 'string' ? object.name : parsed.username,
    },
  });
}

function buildAcceptActivity(followActivity, localActor) {
  const actorUrl = localActor.actorUrl || buildActorUrls(localActor.username).actorUrl;

  return {
    '@context': 'https://www.w3.org/ns/activitystreams',
    id: `${actorUrl}/accepts/${randomUUID()}`,
    type: 'Accept',
    actor: actorUrl,
    object: followActivity,
  };
}

function serializeSuggestion(user) {
  return {
    id: user.id,
    name: user.name,
    username: user.username,
    server: user.server,
    handle: `@${user.username}@${user.server}`,
    actorUrl: user.actorUrl,
    bio: user.bio,
    followerCount: user._count?.followers || 0,
    postCount: user._count?.posts || 0,
  };
}

router.get('/suggestions', authenticate, async (req, res, next) => {
  try {
    const follows = await prisma.follow.findMany({
      where: {
        followerId: req.user.id,
        status: 'ACCEPTED',
      },
      select: { followingId: true },
    });
    const excludedIds = [req.user.id, ...follows.map((follow) => follow.followingId)];

    const users = await prisma.user.findMany({
      where: {
        id: { notIn: excludedIds },
      },
      take: 5,
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: {
            followers: true,
            posts: true,
          },
        },
      },
    });

    return res.json({ users: users.map(serializeSuggestion) });
  } catch (error) {
    next(error);
  }
});

router.post('/:username/inbox', verifyActivityPubHttpSignature, async (req, res, next) => {
  try {
    const username = String(req.params.username || '').toLowerCase();
    const activity = req.body;
    const type = getActivityType(activity);
    const actorUrl = getActorUrl(activity);

    const localUser = await prisma.user.findFirst({
      where: { username },
      orderBy: { createdAt: 'asc' },
    });

    if (!localUser) {
      return res.status(404).json({ message: 'Inbox owner not found.' });
    }

    const localActor = await ensureActivityPubIdentity(localUser);
    await recordInboundActivity(activity);

    if (!type || !actorUrl) {
      return res.status(400).json({ message: 'Activity type and actor are required.' });
    }

    if (type === 'Follow') {
      const objectId = getObjectId(activity.object);

      if (objectId !== localActor.actorUrl) {
        return res.status(400).json({ message: 'Follow activity object does not target this actor.' });
      }

      const remoteActor = await upsertRemoteActor(actorUrl, activity.actor);
      await prisma.remoteFollow.upsert({
        where: {
          remoteActorId_userId: {
            remoteActorId: remoteActor.id,
            userId: localActor.id,
          },
        },
        update: {
          activityId: getActivityId(activity),
          status: 'ACCEPTED',
        },
        create: {
          remoteActorId: remoteActor.id,
          userId: localActor.id,
          activityId: getActivityId(activity),
          status: 'ACCEPTED',
        },
      });
      await createNotification(prisma, {
        userId: localActor.id,
        type: 'FOLLOW',
        actorUrl: remoteActor.actorUrl,
        title: `${actorDisplayName(remoteActor)} followed you`,
        body: actorHandle(remoteActor),
        data: {
          remoteActorId: remoteActor.id,
        },
      });

      const acceptActivity = buildAcceptActivity(activity, localActor);
      await recordOutboundActivity(acceptActivity);

      if (remoteActor.inboxUrl) {
        await enqueueActivityDelivery({
          actor: localActor,
          inboxUrl: remoteActor.inboxUrl,
          activity: acceptActivity,
        });
      }

      res.set('Content-Type', 'application/activity+json; charset=utf-8');
      return res.status(202).json(acceptActivity);
    }

    if (type === 'Undo') {
      const object = activity.object;
      const objectType = getActivityType(object);
      const objectId = getObjectId(object);
      const objectActorUrl = getActorUrl(object) || actorUrl;
      const objectTarget = typeof object === 'object' ? getObjectId(object.object) : null;

      if (objectType === 'Follow' || objectId) {
        if (objectTarget && objectTarget !== localActor.actorUrl) {
          return res.status(400).json({ message: 'Undo activity object does not target this actor.' });
        }

        if (objectActorUrl !== actorUrl) {
          return res.status(400).json({ message: 'Undo activity actor does not match object actor.' });
        }

        const remoteActor = await upsertRemoteActor(actorUrl, activity.actor);
        const deleteResult = await prisma.remoteFollow.deleteMany({
          where: {
            remoteActorId: remoteActor.id,
            userId: localActor.id,
            ...(objectId ? { activityId: objectId } : {}),
          },
        });

        return res.status(202).json({
          status: 'undone',
          type: 'Follow',
          removed: deleteResult.count,
        });
      }

      return res.status(202).json({ status: 'ignored', type: 'Undo' });
    }

    if (type === 'Accept') {
      const acceptedObjectId = getObjectId(activity.object);
      const acceptedFollow = acceptedObjectId
        ? await prisma.remoteFollowing.findFirst({
            where: {
              activityId: acceptedObjectId,
              remoteActor: {
                actorUrl,
              },
            },
            include: { remoteActor: true },
          })
        : null;
      const updateResult = acceptedFollow
        ? await prisma.remoteFollowing.updateMany({
            where: { id: acceptedFollow.id },
            data: { status: 'ACCEPTED' },
          })
        : { count: 0 };

      if (acceptedFollow) {
        await createNotification(prisma, {
          userId: acceptedFollow.userId,
          type: 'ACCEPT',
          actorUrl: acceptedFollow.remoteActor.actorUrl,
          title: `${actorDisplayName(acceptedFollow.remoteActor)} accepted your follow`,
          body: actorHandle(acceptedFollow.remoteActor),
          data: {
            remoteActorId: acceptedFollow.remoteActorId,
          },
        });
      }

      return res.status(202).json({
        status: 'accepted',
        updated: updateResult.count,
      });
    }

    if (type === 'Create') {
      const object = activity.object;
      const objectType = typeof object?.type === 'string' ? object.type : null;

      if (objectType !== 'Note') {
        return res.status(202).json({ status: 'ignored', reason: 'Only Note objects are stored.' });
      }

      const remoteActor = await upsertRemoteActor(actorUrl, activity.actor);
      const activityId = getActivityId(activity) || `${actorUrl}/activities/${randomUUID()}`;
      const remoteUrl = getObjectId(object) || activityId;
      const existingPost = await prisma.post.findFirst({
        where: {
          OR: [{ activityId }, { remoteUrl }],
        },
      });

      if (existingPost) {
        return res.status(202).json({ status: 'duplicate' });
      }

      const post = await prisma.post.create({
        data: {
          content: String(object.content || ''),
          visibility: 'PUBLIC',
          activityId,
          remoteUrl,
          isLocal: false,
          remoteAuthorId: remoteActor.id,
        },
      });
      await createNotification(prisma, {
        userId: localActor.id,
        type: 'POST',
        actorUrl: remoteActor.actorUrl,
        title: `New post from ${actorDisplayName(remoteActor)}`,
        body: truncateNotificationBody(object.content),
        data: {
          postId: post.id,
          remoteActorId: remoteActor.id,
        },
      });

      return res.status(202).json({ status: 'stored' });
    }

    return res.status(202).json({ status: 'ignored', type });
  } catch (error) {
    next(error);
  }
});

router.get('/:username', async (req, res, next) => {
  try {
    const username = String(req.params.username || '').toLowerCase();
    const user = await prisma.user.findFirst({
      where: { username },
      orderBy: { createdAt: 'asc' },
    });

    if (!user) {
      return res.status(404).json({ message: 'Actor not found.' });
    }

    const actor = await ensureActivityPubIdentity(user);
    res.set('Content-Type', 'application/activity+json; charset=utf-8');
    return res.json(serializeActor(actor));
  } catch (error) {
    next(error);
  }
});

router.get('/:username/outbox', async (req, res, next) => {
  try {
    const username = String(req.params.username || '').toLowerCase();
    const user = await prisma.user.findFirst({
      where: { username },
      orderBy: { createdAt: 'asc' },
    });

    if (!user) {
      return res.status(404).json({ message: 'Actor not found.' });
    }

    const actor = await ensureActivityPubIdentity(user);
    const outboxUrl = actor.outboxUrl || buildActorUrls(actor.username).outboxUrl;
    const totalItems = await prisma.post.count({
      where: {
        authorId: actor.id,
        visibility: 'PUBLIC',
      },
    });

    res.set('Content-Type', 'application/activity+json; charset=utf-8');

    if (req.query.page !== 'true') {
      return res.json({
        '@context': 'https://www.w3.org/ns/activitystreams',
        id: outboxUrl,
        type: 'OrderedCollection',
        totalItems,
        first: `${outboxUrl}?page=true`,
      });
    }

    const posts = await prisma.post.findMany({
      where: {
        authorId: actor.id,
        visibility: 'PUBLIC',
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
      include: { author: true, remoteAuthor: true },
    });

    return res.json({
      '@context': 'https://www.w3.org/ns/activitystreams',
      id: `${outboxUrl}?page=true`,
      type: 'OrderedCollectionPage',
      partOf: outboxUrl,
      totalItems,
      orderedItems: posts.map(serializeCreateActivity),
    });
  } catch (error) {
    next(error);
  }
});

export default router;
