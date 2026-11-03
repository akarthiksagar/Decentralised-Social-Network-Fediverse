import { randomUUID } from 'crypto';
import { prisma } from '../db.js';

const FETCH_TIMEOUT_MS = Number(process.env.FEDERATION_DISCOVERY_TIMEOUT_MS || 5000);
const MAX_OUTBOX_ITEMS = 40;
const PUBLIC_COLLECTION = 'https://www.w3.org/ns/activitystreams#Public';

function getId(value) {
  if (typeof value === 'string') return value;
  return typeof value?.id === 'string' ? value.id : null;
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

  if (Array.isArray(inlineItems)) return inlineItems.slice(0, MAX_OUTBOX_ITEMS);

  const firstPage = getId(outbox.first) || outbox.first;
  if (!firstPage) return [];

  const page = typeof firstPage === 'string'
    ? await fetchActivityPubJson(firstPage)
    : firstPage;
  return toArray(page?.orderedItems || page?.items).slice(0, MAX_OUTBOX_ITEMS);
}

function getNoteFromActivity(activity) {
  if (activity?.type === 'Create' && activity.object?.type === 'Note') {
    return activity.object;
  }
  return activity?.type === 'Note' ? activity : null;
}

function isPublicNote(activity, note) {
  const recipients = [activity?.to, activity?.cc, note?.to, note?.cc]
    .flatMap((value) => Array.isArray(value) ? value : [value]);
  return recipients.includes(PUBLIC_COLLECTION);
}

/** Import a small recent window so a new remote follow has posts to show. */
export async function syncRemoteOutbox(remoteActor) {
  if (!remoteActor?.actorUrl || !remoteActor?.outboxUrl) return 0;

  const items = await getOutboxItems(remoteActor.outboxUrl);
  let stored = 0;

  for (const item of items) {
    const note = getNoteFromActivity(item);
    if (!note || !isPublicNote(item, note)) continue;

    const attributedTo = getId(note.attributedTo) || getId(item?.actor);
    if (attributedTo && attributedTo !== remoteActor.actorUrl) continue;

    const remoteUrl = getId(note);
    const activityId = getId(item) || remoteUrl || `${remoteActor.actorUrl}/activities/${randomUUID()}`;
    const existing = await prisma.post.findFirst({
      where: { OR: [{ activityId }, ...(remoteUrl ? [{ remoteUrl }] : [])] },
      select: { id: true },
    });
    if (existing) continue;

    await prisma.post.create({
      data: {
        content: typeof note.content === 'string' ? note.content : '',
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
