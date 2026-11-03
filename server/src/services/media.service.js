import { randomUUID } from 'crypto';
import { mkdir, writeFile } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { getPublicBaseUrl } from '../utils/activitypub.js';

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const IMAGE_TYPES = new Map([
  ['image/jpeg', 'jpg'],
  ['image/png', 'png'],
  ['image/webp', 'webp'],
  ['image/gif', 'gif'],
]);

export function getMediaStorageDir() {
  const configuredPath = process.env.MEDIA_STORAGE_DIR;
  if (configuredPath) {
    return path.isAbsolute(configuredPath)
      ? configuredPath
      : path.resolve(process.cwd(), configuredPath);
  }

  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../uploads');
}

export async function storeImageDataUrl(dataUrl) {
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

  const extension = IMAGE_TYPES.get(mediaType);
  const filename = `${randomUUID()}.${extension}`;
  const storageDir = getMediaStorageDir();
  await mkdir(storageDir, { recursive: true });
  await writeFile(path.join(storageDir, filename), bytes, { flag: 'wx' });

  return {
    mediaUrl: `${getPublicBaseUrl()}/media/${filename}`,
    mediaType,
  };
}

export function normalizeRemoteImage(note) {
  const attachments = Array.isArray(note?.attachment)
    ? note.attachment
    : note?.attachment
      ? [note.attachment]
      : [];
  const image = attachments.find((attachment) => {
    const mediaType = String(attachment?.mediaType || '').toLowerCase();
    return mediaType.startsWith('image/') && (attachment?.url || attachment?.href);
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
    mediaType: String(image.mediaType).toLowerCase(),
  };
}
