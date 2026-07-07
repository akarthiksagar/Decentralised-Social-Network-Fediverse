import { prisma } from '../db.js';
import { buildActorUrls, generateActorKeyPair, getPublicBaseUrl } from '../utils/activitypub.js';

export async function ensureActivityPubIdentity(user) {
  if (user.actorUrl && user.inboxUrl && user.outboxUrl && user.publicKeyPem && user.privateKeyPem) {
    return user;
  }

  const actorUrls = buildActorUrls(user.username);
  const keyPair = generateActorKeyPair();

  return prisma.user.update({
    where: { id: user.id },
    data: {
      actorUrl: actorUrls.actorUrl,
      inboxUrl: actorUrls.inboxUrl,
      outboxUrl: actorUrls.outboxUrl,
      publicKeyPem: user.publicKeyPem || keyPair.publicKeyPem,
      privateKeyPem: user.privateKeyPem || keyPair.privateKeyPem,
    },
  });
}

export function getLocalDomains() {
  const domains = new Set(
    [process.env.SERVER_DOMAIN, process.env.LOCAL_DOMAIN, 'fediverse.local'].filter(Boolean)
  );

  try {
    const publicUrl = new URL(getPublicBaseUrl());
    domains.add(publicUrl.host.toLowerCase());
    domains.add(publicUrl.hostname.toLowerCase());
  } catch {
    // Keep the configured domains above when PUBLIC_BASE_URL is malformed.
  }

  return domains;
}

export async function findLocalActor(username, domain) {
  const normalizedUsername = String(username || '').toLowerCase();
  const normalizedDomain = String(domain || '').toLowerCase();

  const exactServerUser = await prisma.user.findUnique({
    where: {
      username_server: {
        username: normalizedUsername,
        server: normalizedDomain,
      },
    },
  });

  if (exactServerUser) return exactServerUser;

  if (!getLocalDomains().has(normalizedDomain)) return null;

  return prisma.user.findFirst({
    where: { username: normalizedUsername },
    orderBy: { createdAt: 'asc' },
  });
}
