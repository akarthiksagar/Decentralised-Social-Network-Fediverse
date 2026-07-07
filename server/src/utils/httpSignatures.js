import { createHash, createSign, createVerify } from 'crypto';

export function parseSignatureHeader(header) {
  if (!header) return null;

  return Object.fromEntries(
    header
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const index = part.indexOf('=');
        const key = part.slice(0, index);
        const value = part.slice(index + 1).replace(/^"|"$/g, '');
        return [key, value];
      })
  );
}

export function getActorUrlFromKeyId(keyId) {
  if (!keyId) return null;
  return keyId.split('#')[0];
}

export function buildSigningString(req, signedHeaders) {
  return signedHeaders
    .map((header) => {
      const lowerHeader = header.toLowerCase();

      if (lowerHeader === '(request-target)') {
        return `(request-target): ${req.method.toLowerCase()} ${req.originalUrl}`;
      }

      return `${lowerHeader}: ${req.get(lowerHeader) || ''}`;
    })
    .join('\n');
}

export function verifyDigestHeader(req) {
  const digest = req.get('digest');
  if (!digest) return { ok: true };

  const separatorIndex = digest.indexOf('=');
  const algorithm = separatorIndex >= 0 ? digest.slice(0, separatorIndex) : '';
  const expected = separatorIndex >= 0 ? digest.slice(separatorIndex + 1) : '';
  if (algorithm?.toLowerCase() !== 'sha-256' || !expected) {
    return { ok: false, reason: 'Unsupported Digest header.' };
  }

  const actual = createHash('sha256').update(req.rawBody || Buffer.from('')).digest('base64');
  return {
    ok: actual === expected,
    reason: actual === expected ? undefined : 'Digest header does not match request body.',
  };
}

export function verifyRsaSignature({ publicKeyPem, signingString, signature }) {
  const verifier = createVerify('RSA-SHA256');
  verifier.update(signingString);
  verifier.end();
  return verifier.verify(publicKeyPem, signature, 'base64');
}

export function createDigestHeader(body) {
  return `SHA-256=${createHash('sha256').update(body).digest('base64')}`;
}

export function buildOutboundSigningString({ method = 'POST', url, headers }) {
  const targetUrl = new URL(url);
  const path = `${targetUrl.pathname}${targetUrl.search}`;
  const signedHeaders = ['(request-target)', 'host', 'date', 'digest'];
  const headerLookup = Object.fromEntries(
    Object.entries(headers).map(([key, value]) => [key.toLowerCase(), value])
  );

  return signedHeaders
    .map((header) => {
      if (header === '(request-target)') {
        return `(request-target): ${method.toLowerCase()} ${path}`;
      }

      return `${header}: ${headerLookup[header] || ''}`;
    })
    .join('\n');
}

export function signActivityRequest({ actor, inboxUrl, body }) {
  if (!actor?.privateKeyPem) {
    throw new Error('Actor private key is required for signed ActivityPub delivery.');
  }

  if (!actor?.actorUrl) {
    throw new Error('Actor URL is required for signed ActivityPub delivery.');
  }

  const targetUrl = new URL(inboxUrl);
  const digest = createDigestHeader(body);
  const date = new Date().toUTCString();
  const headers = {
    Host: targetUrl.host,
    Date: date,
    Digest: digest,
  };
  const signingString = buildOutboundSigningString({
    method: 'POST',
    url: inboxUrl,
    headers,
  });
  const signer = createSign('RSA-SHA256');
  signer.update(signingString);
  signer.end();
  const signature = signer.sign(actor.privateKeyPem, 'base64');
  const keyId = `${actor.actorUrl}#main-key`;

  return {
    ...headers,
    Signature: `keyId="${keyId}",algorithm="rsa-sha256",headers="(request-target) host date digest",signature="${signature}"`,
  };
}
