import jwt from 'jsonwebtoken';
import { buildActorUrls } from './activitypub.js';

const DEFAULT_JWT_EXPIRES_IN = '7d';
const DEVELOPMENT_JWT_SECRET = 'change-this-development-secret';

export function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

export function normalizeUsername(username) {
  return String(username || '')
    .trim()
    .replace(/^@/, '')
    .toLowerCase();
}

export function normalizeServer(server) {
  return String(server || 'fediverse.local').trim().toLowerCase();
}

export function buildActorUrl(username, server) {
  return buildActorUrls(username, server).actorUrl;
}

export function createToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      username: user.username,
      server: user.server,
    },
    getJwtSecret(),
    { expiresIn: process.env.JWT_EXPIRES_IN || DEFAULT_JWT_EXPIRES_IN }
  );
}

export function getJwtSecret() {
  if (process.env.JWT_SECRET) return process.env.JWT_SECRET;

  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET is required in production.');
  }

  return DEVELOPMENT_JWT_SECRET;
}

export function serializeUser(user) {
  return {
    id: user.id,
    name: user.name,
    username: user.username,
    email: user.email,
    server: user.server,
    actorUrl: user.actorUrl,
    inboxUrl: user.inboxUrl,
    outboxUrl: user.outboxUrl,
    bio: user.bio,
    createdAt: user.createdAt,
  };
}
