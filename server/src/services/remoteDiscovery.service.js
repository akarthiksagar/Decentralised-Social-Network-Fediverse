import { prisma } from '../db.js';

const ACTIVITYPUB_ACCEPT =
  'application/activity+json, application/ld+json; profile="https://www.w3.org/ns/activitystreams", application/json';
const DISCOVERY_TIMEOUT_MS = Number(process.env.FEDERATION_DISCOVERY_TIMEOUT_MS || 5000);

export function parseRemoteHandle(value) {
  const handle = String(value || '').trim().replace(/^@/, '');
  const atIndex = handle.lastIndexOf('@');

  if (atIndex <= 0 || atIndex === handle.length - 1) return null;

  return {
    username: handle.slice(0, atIndex).toLowerCase(),
    domain: handle.slice(atIndex + 1).toLowerCase(),
    subject: `acct:${handle.toLowerCase()}`,
    handle: `@${handle.toLowerCase()}`,
  };
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

function getFetchController() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DISCOVERY_TIMEOUT_MS);

  return {
    signal: controller.signal,
    clear: () => clearTimeout(timeout),
  };
}

async function fetchJson(url, options = {}) {
  const controller = getFetchController();

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`${url} returned ${response.status}`);
    }

    return response.json();
  } finally {
    controller.clear();
  }
}

function getWebFingerUrls(domain, subject) {
  const encodedResource = encodeURIComponent(subject);
  const urls = [`https://${domain}/.well-known/webfinger?resource=${encodedResource}`];
  const allowHttp =
    process.env.ALLOW_HTTP_FEDERATION === 'true' ||
    domain.startsWith('localhost') ||
    domain.startsWith('127.0.0.1');

  if (allowHttp) {
    urls.push(`http://${domain}/.well-known/webfinger?resource=${encodedResource}`);
  }

  return urls;
}

async function fetchWebFinger(domain, subject) {
  let lastError;

  for (const url of getWebFingerUrls(domain, subject)) {
    try {
      return await fetchJson(url, {
        headers: {
          Accept: 'application/jrd+json, application/json',
        },
      });
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new Error('Unable to fetch WebFinger resource.');
}

function findActorHref(webfinger) {
  const links = Array.isArray(webfinger?.links) ? webfinger.links : [];
  const selfLink = links.find(
    (link) =>
      link?.rel === 'self' &&
      typeof link.href === 'string' &&
      (!link.type || link.type.includes('activity') || link.type.includes('json'))
  );

  return selfLink?.href || null;
}

async function fetchRemoteActor(actorUrl) {
  return fetchJson(actorUrl, {
    headers: {
      Accept: ACTIVITYPUB_ACCEPT,
    },
  });
}

export async function upsertRemoteActorFromDocument(actorDocument, fallbackActorUrl) {
  const actorUrl = typeof actorDocument?.id === 'string' ? actorDocument.id : fallbackActorUrl;

  if (!actorUrl) {
    throw new Error('Remote actor document is missing an id.');
  }

  const parsed = parseActorUrl(actorUrl);
  const username =
    typeof actorDocument?.preferredUsername === 'string'
      ? actorDocument.preferredUsername.toLowerCase()
      : parsed.username;

  return prisma.remoteActor.upsert({
    where: { actorUrl },
    update: {
      username,
      server: parsed.server,
      inboxUrl: typeof actorDocument?.inbox === 'string' ? actorDocument.inbox : undefined,
      outboxUrl: typeof actorDocument?.outbox === 'string' ? actorDocument.outbox : undefined,
      publicKeyPem:
        typeof actorDocument?.publicKey?.publicKeyPem === 'string'
          ? actorDocument.publicKey.publicKeyPem
          : undefined,
      name: typeof actorDocument?.name === 'string' ? actorDocument.name : undefined,
    },
    create: {
      actorUrl,
      username,
      server: parsed.server,
      inboxUrl: typeof actorDocument?.inbox === 'string' ? actorDocument.inbox : undefined,
      outboxUrl: typeof actorDocument?.outbox === 'string' ? actorDocument.outbox : undefined,
      publicKeyPem:
        typeof actorDocument?.publicKey?.publicKeyPem === 'string'
          ? actorDocument.publicKey.publicKeyPem
          : undefined,
      name: typeof actorDocument?.name === 'string' ? actorDocument.name : username,
    },
  });
}

export async function discoverRemoteActor({ handle, actorUrl }) {
  let resolvedActorUrl = actorUrl ? String(actorUrl).trim() : null;
  let parsedHandle = null;

  if (!resolvedActorUrl) {
    parsedHandle = parseRemoteHandle(handle);
    if (!parsedHandle) {
      throw new Error('Use a remote handle like @username@example.com.');
    }

    const webfinger = await fetchWebFinger(parsedHandle.domain, parsedHandle.subject);
    resolvedActorUrl = findActorHref(webfinger);

    if (!resolvedActorUrl) {
      throw new Error('WebFinger did not return an ActivityPub actor URL.');
    }
  }

  const actorDocument = await fetchRemoteActor(resolvedActorUrl);
  const remoteActor = await upsertRemoteActorFromDocument(actorDocument, resolvedActorUrl);

  return {
    remoteActor,
    handle: parsedHandle?.handle || `@${remoteActor.username}@${remoteActor.server}`,
  };
}

export function serializeRemoteActor(remoteActor, relationship = null) {
  return {
    id: remoteActor.id,
    name: remoteActor.name,
    username: remoteActor.username,
    server: remoteActor.server,
    handle: `@${remoteActor.username}@${remoteActor.server}`,
    actorUrl: remoteActor.actorUrl,
    inboxUrl: remoteActor.inboxUrl,
    outboxUrl: remoteActor.outboxUrl,
    followingStatus: relationship?.status || null,
  };
}
