import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import path from 'path';
import { fileURLToPath } from 'url';
import { getPublicBaseUrl } from '../utils/activitypub.js';

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

export function getMediaStorageDir() {
  const configuredPath = process.env.MEDIA_STORAGE_DIR;
  if (configuredPath) {
    return path.isAbsolute(configuredPath)
      ? configuredPath
      : path.resolve(process.cwd(), configuredPath);
  }

  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../uploads');
}

export function getPostMediaUrl(postId) {
  return `${getPublicBaseUrl()}/media/${encodeURIComponent(postId)}`;
}

export function parseImageDataUrl(dataUrl) {
  if (typeof dataUrl !== 'string') {
    throw Object.assign(new Error('Image data must be a base64 data URL.'), { status: 400 });
  }

  const match = dataUrl.match(/^data:(image\/(?:jpeg|png|webp|gif));base64,([A-Za-z0-9+/]+={0,2})$/);
  if (!match) {
    throw Object.assign(new Error('Use a JPEG, PNG, WebP, or GIF image.'), { status: 400 });
  }

  const [, mediaType, encoded] = match;
  if (encoded.length > Math.ceil(MAX_IMAGE_BYTES / 3) * 4 + 4) {
    throw Object.assign(new Error('Images must be 5 MB or smaller.'), { status: 413 });
  }

  const bytes = Buffer.from(encoded, 'base64');
  if (!bytes.length || bytes.length > MAX_IMAGE_BYTES) {
    throw Object.assign(new Error('Images must be 5 MB or smaller.'), { status: 413 });
  }

  return { bytes, mediaType };
}

function isPrivateIpv4(address) {
  const parts = address.split('.').map(Number);
  const [a, b] = parts;
  return a === 0 || a === 10 || a === 127 || a >= 224 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 198 && (b === 18 || b === 19));
}

function isPublicAddress(address) {
  const version = isIP(address);
  if (version === 4) return !isPrivateIpv4(address);
  if (version === 6) {
    const normalized = address.toLowerCase();
    return !normalized.startsWith('::') &&
      !normalized.startsWith('fc') &&
      !normalized.startsWith('fd') &&
      !normalized.startsWith('fe8') &&
      !normalized.startsWith('fe9') &&
      !normalized.startsWith('fea') &&
      !normalized.startsWith('feb');
  }
  return false;
}

async function assertPublicHttpsUrl(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error('Invalid image URL.');
  }

  if (url.protocol !== 'https:' || url.username || url.password) {
    throw new Error('Only public HTTPS image URLs can be cached.');
  }

  const hostname = url.hostname.toLowerCase();
  if (hostname === 'localhost' || hostname.endsWith('.localhost') ||
      hostname.endsWith('.local') || hostname.endsWith('.internal') || isIP(hostname)) {
    throw new Error('Image host is not public.');
  }

  const addresses = await lookup(hostname, { all: true, verbatim: true });
  if (!addresses.length || addresses.some(({ address }) => !isPublicAddress(address))) {
    throw new Error('Image host resolves to a non-public address.');
  }
  return url;
}

async function readLimitedBody(response) {
  const contentLength = Number(response.headers.get('content-length'));
  if (Number.isFinite(contentLength) && contentLength > MAX_IMAGE_BYTES) {
    throw new Error('Remote image exceeds the 5 MB limit.');
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error('Remote image has no response body.');
  const chunks = [];
  let total = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_IMAGE_BYTES) {
      await reader.cancel();
      throw new Error('Remote image exceeds the 5 MB limit.');
    }
    chunks.push(Buffer.from(value));
  }

  return Buffer.concat(chunks, total);
}

export async function cacheRemoteImage(imageUrl) {
  let url = imageUrl;
  for (let redirectCount = 0; redirectCount <= 3; redirectCount += 1) {
    url = await assertPublicHttpsUrl(url);
    const response = await fetch(url, {
      headers: { Accept: 'image/jpeg, image/png, image/webp, image/gif' },
      redirect: 'manual',
      signal: AbortSignal.timeout(5000),
    });

    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get('location');
      if (!location || redirectCount === 3) throw new Error('Too many image redirects.');
      url = new URL(location, url).href;
      continue;
    }

    if (!response.ok) throw new Error(`Remote image returned ${response.status}.`);
    const mediaType = String(response.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
    if (!IMAGE_TYPES.has(mediaType)) throw new Error('Remote resource is not a supported image.');
    return { bytes: await readLimitedBody(response), mediaType };
  }

  throw new Error('Unable to fetch remote image.');
}

export function normalizeRemoteImage(note) {
  const attachments = Array.isArray(note?.attachment)
    ? note.attachment
    : note?.attachment
      ? [note.attachment]
      : [];
  const image = attachments.find((attachment) => {
    const mediaType = String(attachment?.mediaType || attachment?.url?.mediaType || '').toLowerCase();
    return (mediaType.startsWith('image/') || attachment?.type === 'Image') &&
      (attachment?.url || attachment?.href);
  });
  if (!image) return { mediaUrl: null, mediaType: null };

  const mediaUrl = typeof image.url === 'string'
    ? image.url
    : typeof image.url?.href === 'string'
      ? image.url.href
      : typeof image.href === 'string'
        ? image.href
        : typeof image.url?.id === 'string'
          ? image.url.id
          : null;

  if (!mediaUrl || !/^https?:\/\//i.test(mediaUrl)) {
    return { mediaUrl: null, mediaType: null };
  }

  return {
    mediaUrl,
    mediaType: String(image.mediaType || image.url?.mediaType || '').toLowerCase() || null,
  };
}
