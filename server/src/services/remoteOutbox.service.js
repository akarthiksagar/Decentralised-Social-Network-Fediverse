import { randomUUID } from 'crypto';
import { prisma } from '../db.js';
import { normalizeRemoteImage } from './media.service.js';

const FETCH_TIMEOUT_MS = Number(process.env.FEDERATION_DISCOVERY_TIMEOUT_MS || 5000);
const MAX_OUTBOX_ITEMS = 40;
const PUBLIC_COLLECTION = 'https://www.w3.org/ns/activitystreams#Public';
const SYNC_TTL_MS = 10 * 60 * 1000;
const FAILED_SYNC_TTL_MS = 60 * 1000;
const syncCache = new Map();

function getId(value) {
  if (typeof value === 'string') return value;
  return typeof value?.id === 'string' ? value.id : null;
}

function getTypeName(value) {
  return typeof value?.type === 'string'
    ? value.type.split(/[\/#]/).filter(Boolean).at(-1)
    : null;
}

function toArray(value) {
  return Array.isArray(value) ? value : [];
}

async function fetchActivityPubJson(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      headers: {
        Accept: 'application/activity+json, application/ld+json, application/json',
      },
      signal: controller.signal,
    });

    if (!response.ok) throw new Error(`Remote outbox returned ${response.status}.`);
    return response.json();
  } finally {
    clearTimeout(timeout);
  }
}

async function getOutboxItems(outboxUrl) {
  const outbox = await fetchActivityPubJson(outboxUrl);
  const inlineItems = outbox.orderedItems || outbox.items;

  if (Array.isArray(inlineItems) && inlineItems.length) {
    return inlineItems.slice(0, MAX_OUTBOX_ITEMS);
  }

  const firstPage = outbox.first;
  if (!firstPage) return [];

  const embeddedItems = firstPage.orderedItems || firstPage.items;
  if (Array.isArray(embeddedItems) && embeddedItems.length) {
    return embeddedItems.slice(0, MAX_OUTBOX_ITEMS);
  }

  const firstPageUrl = getId(firstPage) || (typeof firstPage === 'string' ? firstPage : null);
  if (!firstPageUrl) return [];

  const page = await fetchActivityPubJson(firstPageUrl);
  return toArray(page?.orderedItems || page?.items).slice(0, MAX_OUTBOX_ITEMS);
}

function getNoteFromActivity(activity) {
  if (getTypeName(activity) === 'Create' && getTypeName(activity.object) === 'Note') {
    return activity.object;
  }
  return getTypeName(activity) === 'Note' ? activity : null;
}

async function resolveNoteFromActivity(activity) {
  const embedded = getNoteFromActivity(activity);
  if (embedded) return embedded;

  const objectUrl = typeof activity?.object === 'string'
    ? activity.object
    : typeof activity?.object?.id === 'string'
      ? activity.object.id
      : null;
  if (getTypeName(activity) !== 'Create' || !objectUrl || !/^https?:\/\//i.test(objectUrl)) {
    return null;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(objectUrl, {
      headers: {
        Accept: 'application/activity+json, application/ld+json, application/json',
      },
      signal: controller.signal,
    });
    if (!response.ok) return null;
    const note = await response.json();
    return getTypeName(note) === 'Note' ? note : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function isPublicNote(activity, note) {
  const recipients = [activity?.to, activity?.cc, note?.to, note?.cc]
    .flatMap((value) => Array.isArray(value) ? value : [value])
    .map((value) => getId(value) || value);
  return recipients.includes(PUBLIC_COLLECTION);
}

async function importRecentOutboxItems(remoteActor) {
  if (!remoteActor?.actorUrl || !remoteActor?.outboxUrl) return 0;

  const items = await getOutboxItems(remoteActor.outboxUrl);
  let stored = 0;

  for (const item of items) {
    const note = await resolveNoteFromActivity(item);
    if (!note || !isPublicNote(item, note)) continue;

    const attributedTo = getId(note.attributedTo) || getId(item?.actor);
    if (attributedTo && attributedTo !== remoteActor.actorUrl) continue;

    const remoteUrl = getId(note);
    const media = normalizeRemoteImage(note);
    const activityId = getId(item) || remoteUrl || `${remoteActor.actorUrl}/activities/${randomUUID()}`;
    const existing = await prisma.post.findFirst({
      where: { OR: [{ activityId }, ...(remoteUrl ? [{ remoteUrl }] : [])] },
      select: { id: true },
    });
    if (existing) continue;

    await prisma.post.create({
      data: {
        content: typeof note.content === 'string' ? note.content : '',
        mediaUrl: media.mediaUrl,
        mediaType: media.mediaType,
        visibility: 'PUBLIC',
        activityId,
        remoteUrl,
        isLocal: false,
        remoteAuthorId: remoteActor.id,
        ...(note.published && !Number.isNaN(Date.parse(note.published))
          ? { createdAt: new Date(note.published) }
          : {}),
      },
    });
    stored += 1;
  }

  return stored;
}

/** Import a small recent window so followed remote accounts have posts to show. */
export async function syncRemoteOutbox(remoteActor) {
  if (!remoteActor?.actorUrl || !remoteActor?.outboxUrl) return 0;

  const now = Date.now();
  const cached = syncCache.get(remoteActor.id);
  if (cached && cached.expiresAt > now) return cached.promise;

  const entry = {
    expiresAt: now + SYNC_TTL_MS,
    promise: importRecentOutboxItems(remoteActor),
  };
  syncCache.set(remoteActor.id, entry);

  try {
    return await entry.promise;
  } catch (error) {
    entry.expiresAt = Date.now() + FAILED_SYNC_TTL_MS;
    throw error;
  }
}
