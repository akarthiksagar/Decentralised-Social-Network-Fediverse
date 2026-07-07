import { Router } from 'express';
import { prisma } from '../db.js';
import { authenticate } from '../middleware/authenticate.js';
import {
  discoverRemoteActor,
  parseRemoteHandle,
  serializeRemoteActor,
} from '../services/remoteDiscovery.service.js';
import { serializePost } from './post.routes.js';

const router = Router();
const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 25;

function serializeUserResult(user, relationship = null) {
  return {
    id: user.id,
    name: user.name,
    username: user.username,
    server: user.server,
    handle: `@${user.username}@${user.server}`,
    actorUrl: user.actorUrl,
    bio: user.bio,
    followingStatus: relationship?.status || null,
  };
}

router.get('/', authenticate, async (req, res, next) => {
  try {
    const query = String(req.query.q || '').trim();
    const requestedLimit = Number(req.query.limit) || DEFAULT_LIMIT;
    const limit = Math.min(Math.max(requestedLimit, 1), MAX_LIMIT);

    if (!query) {
      return res.json({
        query,
        users: [],
        remoteActors: [],
        posts: [],
      });
    }

    const normalizedQuery = query.replace(/^#/, '');
    const [users, remoteActors, posts] = await Promise.all([
      prisma.user.findMany({
        where: {
          id: { not: req.user.id },
          OR: [
            { name: { contains: normalizedQuery, mode: 'insensitive' } },
            { username: { contains: normalizedQuery, mode: 'insensitive' } },
            { server: { contains: normalizedQuery, mode: 'insensitive' } },
          ],
        },
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.remoteActor.findMany({
        where: {
          OR: [
            { name: { contains: normalizedQuery, mode: 'insensitive' } },
            { username: { contains: normalizedQuery, mode: 'insensitive' } },
            { server: { contains: normalizedQuery, mode: 'insensitive' } },
            { actorUrl: { contains: normalizedQuery, mode: 'insensitive' } },
          ],
        },
        take: limit,
        orderBy: { updatedAt: 'desc' },
      }),
      prisma.post.findMany({
        where: {
          visibility: { in: ['PUBLIC', 'UNLISTED'] },
          content: { contains: normalizedQuery, mode: 'insensitive' },
        },
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { author: true, remoteAuthor: true },
      }),
    ]);

    const localRelationships = users.length
      ? await prisma.follow.findMany({
          where: {
            followerId: req.user.id,
            followingId: { in: users.map((user) => user.id) },
          },
        })
      : [];
    const localRelationshipByUserId = new Map(
      localRelationships.map((relationship) => [relationship.followingId, relationship])
    );

    let remoteResults = remoteActors;
    let remoteLookupError = null;
    if (parseRemoteHandle(query)) {
      try {
        const { remoteActor } = await discoverRemoteActor({ handle: query });
        remoteResults = [
          remoteActor,
          ...remoteActors.filter((actor) => actor.id !== remoteActor.id),
        ].slice(0, limit);
      } catch (error) {
        remoteLookupError = error.message;
      }
    }

    const remoteRelationships = remoteResults.length
      ? await prisma.remoteFollowing.findMany({
          where: {
            userId: req.user.id,
            remoteActorId: { in: remoteResults.map((actor) => actor.id) },
          },
        })
      : [];
    const remoteRelationshipByActorId = new Map(
      remoteRelationships.map((relationship) => [relationship.remoteActorId, relationship])
    );

    return res.json({
      query,
      users: users.map((user) => serializeUserResult(user, localRelationshipByUserId.get(user.id))),
      remoteActors: remoteResults.map((actor) =>
        serializeRemoteActor(actor, remoteRelationshipByActorId.get(actor.id))
      ),
      posts: posts.map(serializePost),
      remoteLookupError,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
