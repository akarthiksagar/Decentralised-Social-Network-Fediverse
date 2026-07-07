import { generateKeyPairSync, randomUUID } from 'crypto';

export const ACTIVITYSTREAMS_CONTEXT = 'https://www.w3.org/ns/activitystreams';
export const SECURITY_CONTEXT = 'https://w3id.org/security/v1';
export const PUBLIC_COLLECTION = 'https://www.w3.org/ns/activitystreams#Public';

export function getPublicBaseUrl() {
  return (process.env.PUBLIC_BASE_URL || `http://localhost:${process.env.PORT || 3000}`).replace(
    /\/$/,
    ''
  );
}

export function buildActorUrls(username) {
  const actorUrl = `${getPublicBaseUrl()}/users/${username}`;

  return {
    actorUrl,
    inboxUrl: `${actorUrl}/inbox`,
    outboxUrl: `${actorUrl}/outbox`,
    keyId: `${actorUrl}#main-key`,
  };
}

export function generateActorKeyPair() {
  const { publicKey, privateKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: {
      type: 'spki',
      format: 'pem',
    },
    privateKeyEncoding: {
      type: 'pkcs8',
      format: 'pem',
    },
  });

  return {
    publicKeyPem: publicKey,
    privateKeyPem: privateKey,
  };
}

export function serializeActor(user) {
  const urls = buildActorUrls(user.username);

  return {
    '@context': [ACTIVITYSTREAMS_CONTEXT, SECURITY_CONTEXT],
    id: user.actorUrl || urls.actorUrl,
    type: 'Person',
    preferredUsername: user.username,
    name: user.name,
    summary: user.bio || '',
    inbox: user.inboxUrl || urls.inboxUrl,
    outbox: user.outboxUrl || urls.outboxUrl,
    url: user.actorUrl || urls.actorUrl,
    manuallyApprovesFollowers: false,
    discoverable: true,
    publicKey: {
      id: `${user.actorUrl || urls.actorUrl}#main-key`,
      owner: user.actorUrl || urls.actorUrl,
      publicKeyPem: user.publicKeyPem,
    },
  };
}

export function serializeCreateActivity(post) {
  const objectId = post.remoteUrl || `${post.author.actorUrl}/statuses/${post.id}`;

  return {
    '@context': ACTIVITYSTREAMS_CONTEXT,
    id: post.activityId,
    type: 'Create',
    actor: post.author.actorUrl,
    published: post.createdAt,
    to: [PUBLIC_COLLECTION],
    cc: [`${post.author.actorUrl}/followers`],
    object: {
      id: objectId,
      type: 'Note',
      attributedTo: post.author.actorUrl,
      content: post.content,
      published: post.createdAt,
      to: [PUBLIC_COLLECTION],
      cc: [`${post.author.actorUrl}/followers`],
      url: objectId,
    },
  };
}

export function serializeFollowActivity(localActor, remoteActor) {
  const actorUrl = localActor.actorUrl || buildActorUrls(localActor.username).actorUrl;

  return {
    '@context': ACTIVITYSTREAMS_CONTEXT,
    id: `${actorUrl}/follows/${randomUUID()}`,
    type: 'Follow',
    actor: actorUrl,
    object: remoteActor.actorUrl,
  };
}

export function serializeUndoActivity(localActor, objectActivity) {
  const actorUrl = localActor.actorUrl || buildActorUrls(localActor.username).actorUrl;

  return {
    '@context': ACTIVITYSTREAMS_CONTEXT,
    id: `${actorUrl}/undos/${randomUUID()}`,
    type: 'Undo',
    actor: actorUrl,
    object: objectActivity,
  };
}
