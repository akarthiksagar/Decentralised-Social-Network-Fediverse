import { Router } from 'express';
import { prisma } from '../db.js';

const router = Router();

function getInstanceRules() {
  return String(process.env.INSTANCE_RULES || '')
    .split('|')
    .map((rule) => rule.trim())
    .filter(Boolean);
}

function getInstanceName() {
  return process.env.INSTANCE_NAME || process.env.LOCAL_DOMAIN || process.env.SERVER_DOMAIN || 'Instance';
}

function getFederationReachability() {
  const publicBaseUrl = process.env.PUBLIC_BASE_URL || null;
  if (!publicBaseUrl) return { publicBaseUrl: null, inboxReachable: false };

  try {
    const { protocol, hostname } = new URL(publicBaseUrl);
    const isLocalHost =
      hostname === 'localhost' ||
      hostname.endsWith('.localhost') ||
      hostname.endsWith('.local') ||
      hostname === '0.0.0.0' ||
      hostname.startsWith('127.');
    return {
      publicBaseUrl,
      inboxReachable: !isLocalHost && protocol === 'https:',
    };
  } catch {
    return { publicBaseUrl, inboxReachable: false };
  }
}

router.get('/', async (req, res, next) => {
  try {
    const [
      localUserCount,
      localPostCount,
      remotePostCount,
      remoteActorCount,
      pendingDeliveryCount,
      sentDeliveryCount,
      failedDeliveryCount,
      remoteActors,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.post.count({ where: { isLocal: true } }),
      prisma.post.count({ where: { isLocal: false } }),
      prisma.remoteActor.count(),
      prisma.deliveryTask.count({ where: { status: 'PENDING' } }),
      prisma.deliveryTask.count({ where: { status: 'SENT' } }),
      prisma.deliveryTask.count({ where: { status: 'FAILED' } }),
      prisma.remoteActor.findMany({
        select: {
          server: true,
          updatedAt: true,
        },
        orderBy: { updatedAt: 'desc' },
        take: 200,
      }),
    ]);

    const peerMap = remoteActors.reduce((map, actor) => {
      const current = map.get(actor.server) || {
        domain: actor.server,
        actorCount: 0,
        lastSeen: actor.updatedAt,
      };

      current.actorCount += 1;
      if (actor.updatedAt > current.lastSeen) current.lastSeen = actor.updatedAt;
      map.set(actor.server, current);
      return map;
    }, new Map());

    const deliveryTotal = sentDeliveryCount + failedDeliveryCount;
    const deliverySuccessRate = deliveryTotal
      ? Number(((sentDeliveryCount / deliveryTotal) * 100).toFixed(1))
      : null;

    return res.json({
      instance: {
        name: getInstanceName(),
        domain: process.env.LOCAL_DOMAIN || process.env.SERVER_DOMAIN || null,
        publicBaseUrl: process.env.PUBLIC_BASE_URL || null,
        federation: getFederationReachability(),
        registrations: process.env.REGISTRATIONS_OPEN === 'false' ? 'Closed' : 'Open',
        rules: getInstanceRules(),
      },
      stats: {
        localUsers: localUserCount,
        localPosts: localPostCount,
        remotePosts: remotePostCount,
        remoteActors: remoteActorCount,
        pendingDeliveries: pendingDeliveryCount,
        sentDeliveries: sentDeliveryCount,
        failedDeliveries: failedDeliveryCount,
        deliverySuccessRate,
      },
      peers: [...peerMap.values()].slice(0, 20),
      moderationQueue: [],
    });
  } catch (error) {
    next(error);
  }
});

export default router;
