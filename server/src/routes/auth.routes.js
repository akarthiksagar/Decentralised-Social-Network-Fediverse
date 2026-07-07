import { Router } from 'express';
import bcrypt from 'bcrypt';
import { prisma } from '../db.js';
import { authenticate } from '../middleware/authenticate.js';
import { buildActorUrls, generateActorKeyPair } from '../utils/activitypub.js';
import {
  createToken,
  normalizeEmail,
  normalizeServer,
  normalizeUsername,
  serializeUser,
} from '../utils/auth.js';

const router = Router();
const SALT_ROUNDS = 12;

function validateRegistration({ name, username, email, password }) {
  if (!String(name || '').trim()) return 'Display name is required.';
  if (!username) return 'Username is required.';
  if (!/^[a-z0-9_]{3,30}$/.test(username)) {
    return 'Username must be 3-30 characters and use only letters, numbers, or underscores.';
  }
  if (!email || !/^\S+@\S+\.\S+$/.test(email)) return 'A valid email is required.';
  if (!password || password.length < 8) return 'Password must be at least 8 characters.';
  return null;
}

function validateProfile({ name, username, bio }) {
  if (!String(name || '').trim()) return 'Display name is required.';
  if (!username) return 'Username is required.';
  if (!/^[a-z0-9_]{3,30}$/.test(username)) {
    return 'Username must be 3-30 characters and use only letters, numbers, or underscores.';
  }
  if (String(bio || '').length > 240) return 'Bio must be 240 characters or less.';
  return null;
}

router.post('/register', async (req, res, next) => {
  try {
     const name = String(req.body.name || '').trim();
    const username = normalizeUsername(req.body.username);
    const email = normalizeEmail(req.body.email);
    const server = normalizeServer(req.body.server);
    const password = String(req.body.password || '');
    const validationError = validateRegistration({ name, username, email, password });

    if (validationError) {
      return res.status(400).json({ message: validationError });
    }

    const existingEmail = await prisma.user.findUnique({ where: { email } });
    if (existingEmail) {
      return res.status(409).json({ message: 'An account with this email already exists.' });
    }

    const existingHandle = await prisma.user.findUnique({
      where: { username_server: { username, server } },
    });
    if (existingHandle) {
      return res.status(409).json({ message: `@${username}@${server} is already taken.` });
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const actorUrls = buildActorUrls(username);
    const keyPair = generateActorKeyPair();
    const user = await prisma.user.create({
      data: {
        name,
        username,
        email,
        passwordHash,
        server,
        actorUrl: actorUrls.actorUrl,
        inboxUrl: actorUrls.inboxUrl,
        outboxUrl: actorUrls.outboxUrl,
        publicKeyPem: keyPair.publicKeyPem,
        privateKeyPem: keyPair.privateKeyPem,
      },
    });

    return res.status(201).json({
      user: serializeUser(user),
      token: createToken(user),
    });
  } catch (error) {
    next(error);
  }
});

router.post('/login', async (req, res, next) => {
  try {
    const email = normalizeEmail(req.body.email);
    const password = String(req.body.password || '');

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required.' });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    const isValidPassword = await bcrypt.compare(password, user.passwordHash);
    if (!isValidPassword) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    return res.json({
      user: serializeUser(user),
      token: createToken(user),
    });
  } catch (error) {
    next(error);
  }
});

router.get('/me', authenticate, (req, res) => {
  return res.json({ user: serializeUser(req.user) });
});

router.patch('/me', authenticate, async (req, res, next) => {
  try {
    const name = String(req.body.name || '').trim();
    const username = normalizeUsername(req.body.username);
    const bio = String(req.body.bio || '').trim();
    const validationError = validateProfile({ name, username, bio });

    if (validationError) {
      return res.status(400).json({ message: validationError });
    }

    if (username !== req.user.username) {
      const existingHandle = await prisma.user.findUnique({
        where: { username_server: { username, server: req.user.server } },
      });

      if (existingHandle && existingHandle.id !== req.user.id) {
        return res
          .status(409)
          .json({ message: `@${username}@${req.user.server} is already taken.` });
      }
    }

    const actorUrls = buildActorUrls(username);
    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: {
        name,
        username,
        bio,
        actorUrl: actorUrls.actorUrl,
        inboxUrl: actorUrls.inboxUrl,
        outboxUrl: actorUrls.outboxUrl,
      },
    });

    return res.json({ user: serializeUser(user) });
  } catch (error) {
    next(error);
  }
});

export default router;
