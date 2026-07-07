import { prisma } from '../db.js';
import {
  buildSigningString,
  getActorUrlFromKeyId,
  parseSignatureHeader,
  verifyDigestHeader,
  verifyRsaSignature,
} from '../utils/httpSignatures.js';

function parseActorUrl(actorUrl) {
  try {
    const url = new URL(actorUrl);
    const segments = url.pathname.split('/').filter(Boolean);
    return {
      username: (segments[segments.length - 1] || url.hostname).toLowerCase(),
      server: url.host.toLowerCase(),
    };
  } catch {
    return {
      username: 'remote',
      server: 'unknown',
    };
  }
}

async function getPublicKeyFromRequestBody(req, keyId) {
  const actor = req.body?.actor;
  if (!actor || typeof actor !== 'object') return null;

  const publicKey = actor.publicKey;
  if (!publicKey?.publicKeyPem) return null;
  if (publicKey.id && publicKey.id !== keyId) return null;

  return {
    actorUrl: actor.id || publicKey.owner || getActorUrlFromKeyId(keyId),
    publicKeyPem: publicKey.publicKeyPem,
    actor,
  };
}

async function fetchRemoteActor(actorUrl) {
  const response = await fetch(actorUrl, {
    headers: {
      Accept: 'application/activity+json, application/ld+json, application/json',
    },
  });

  if (!response.ok) return null;
  return response.json();
}

async function resolvePublicKey(req, keyId) {
  const actorUrl = getActorUrlFromKeyId(keyId);
  const bodyKey = await getPublicKeyFromRequestBody(req, keyId);

  if (bodyKey?.publicKeyPem) return bodyKey;

  if (!actorUrl) return null;

  const storedActor = await prisma.remoteActor.findUnique({ where: { actorUrl } });
  if (storedActor?.publicKeyPem) {
    return {
      actorUrl,
      publicKeyPem: storedActor.publicKeyPem,
    };
  }

  try {
    const fetchedActor = await fetchRemoteActor(actorUrl);
    if (!fetchedActor?.publicKey?.publicKeyPem) return null;

    const parsed = parseActorUrl(actorUrl);
    await prisma.remoteActor.upsert({
      where: { actorUrl },
      update: {
        username: parsed.username,
        server: parsed.server,
        inboxUrl: typeof fetchedActor.inbox === 'string' ? fetchedActor.inbox : undefined,
        outboxUrl: typeof fetchedActor.outbox === 'string' ? fetchedActor.outbox : undefined,
        publicKeyPem: fetchedActor.publicKey.publicKeyPem,
        name: typeof fetchedActor.name === 'string' ? fetchedActor.name : undefined,
      },
      create: {
        actorUrl,
        username: parsed.username,
        server: parsed.server,
        inboxUrl: typeof fetchedActor.inbox === 'string' ? fetchedActor.inbox : undefined,
        outboxUrl: typeof fetchedActor.outbox === 'string' ? fetchedActor.outbox : undefined,
        publicKeyPem: fetchedActor.publicKey.publicKeyPem,
        name: typeof fetchedActor.name === 'string' ? fetchedActor.name : parsed.username,
      },
    });

    return {
      actorUrl,
      publicKeyPem: fetchedActor.publicKey.publicKeyPem,
    };
  } catch {
    return null;
  }
}

export async function verifyActivityPubHttpSignature(req, res, next) {
  try {
    const header = req.get('signature');
    const requireSignatures = process.env.REQUIRE_HTTP_SIGNATURES === 'true';

    if (!header) {
      req.httpSignature = { verified: false, reason: 'missing' };
      if (requireSignatures) {
        return res.status(401).json({ message: 'HTTP Signature is required.' });
      }
      return next();
    }

    const parsed = parseSignatureHeader(header);
    const keyId = parsed?.keyId;
    const signature = parsed?.signature;
    const signedHeaders = (parsed?.headers || 'date').split(/\s+/).filter(Boolean);

    if (!keyId || !signature) {
      req.httpSignature = { verified: false, reason: 'invalid-signature-header' };
      return res.status(401).json({ message: 'Invalid HTTP Signature header.' });
    }

    const digestResult = verifyDigestHeader(req);
    if (!digestResult.ok) {
      req.httpSignature = { verified: false, keyId, reason: digestResult.reason };
      return res.status(401).json({ message: digestResult.reason });
    }

    const key = await resolvePublicKey(req, keyId);
    if (!key?.publicKeyPem) {
      req.httpSignature = { verified: false, keyId, reason: 'public-key-not-found' };
      if (requireSignatures) {
        return res.status(401).json({ message: 'Could not resolve HTTP Signature public key.' });
      }
      return next();
    }

    const signingString = buildSigningString(req, signedHeaders);
    const verified = verifyRsaSignature({
      publicKeyPem: key.publicKeyPem,
      signingString,
      signature,
    });

    req.httpSignature = {
      verified,
      keyId,
      actorUrl: key.actorUrl,
      signedHeaders,
    };

    if (!verified) {
      return res.status(401).json({ message: 'Invalid HTTP Signature.' });
    }

    return next();
  } catch (error) {
    next(error);
  }
}
