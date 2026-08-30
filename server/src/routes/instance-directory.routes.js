import { Router } from 'express';
import { prisma } from '../db.js';

const router = Router();
const VERIFY_TIMEOUT_MS = Number(process.env.INSTANCE_DIRECTORY_VERIFY_TIMEOUT_MS || 5000);

function getSelfServer() {
  const apiUrl = (process.env.PUBLIC_BASE_URL || `http://localhost:${process.env.PORT || 3000}`)
    .trim()
    .replace(/\/$/, '');
  const domain = process.env.LOCAL_DOMAIN || process.env.SERVER_DOMAIN || new URL(apiUrl).host;

  return {
    id: domain,
    name: process.env.INSTANCE_NAME || domain,
    domain,
    apiUrl,
    category: 'Server',
    registrations: process.env.REGISTRATIONS_OPEN === 'false' ? 'Closed' : 'Open',
    description: `Connect to ${domain}.`,
    rules: String(process.env.INSTANCE_RULES || '')
      .split('|')
      .map((rule) => rule.trim())
      .filter(Boolean),
    verifiedAt: new Date().toISOString(),
  };
}

function normalizeApiUrl(value) {
  const url = new URL(String(value || '').trim());

  if (!['https:', 'http:'].includes(url.protocol)) {
    throw new Error('Instance API URL must use http or https.');
  }

  const allowHttp =
    process.env.ALLOW_HTTP_FEDERATION === 'true' ||
    process.env.NODE_ENV !== 'production' ||
    url.hostname === 'localhost' ||
    url.hostname.startsWith('127.');

  if (url.protocol === 'http:' && !allowHttp) {
    throw new Error('Instance API URL must use HTTPS in production.');
  }

  return `${url.origin}${url.pathname === '/' ? '' : url.pathname}`.replace(/\/$/, '');
}

async function fetchJson(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), VERIFY_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: 'application/json, application/activity+json, application/ld+json',
      },
    });

    if (!response.ok) {
      throw new Error(`${url} returned ${response.status}`);
    }

    return response.json();
  } finally {
    clearTimeout(timeout);
  }
}

function serializeEntry(entry) {
  return {
    id: entry.id,
    name: entry.name,
    domain: entry.domain,
    apiUrl: entry.apiUrl,
    category: entry.category,
    description: entry.description,
    registrations: entry.registrations,
    rules: Array.isArray(entry.rules) ? entry.rules : [],
    status: entry.status,
    healthStatus: entry.healthStatus,
    verifiedAt: entry.verifiedAt,
    lastCheckedAt: entry.lastCheckedAt,
  };
}

function isVerificationError(error) {
  return (
    error.name === 'TypeError' ||
    error.name === 'AbortError' ||
    error.name === 'SyntaxError' ||
    error.message?.includes('returned') ||
    error.message?.includes('Instance API URL')
  );
}

async function verifyInstance(apiUrl) {
  await fetchJson(`${apiUrl}/health`);
  const metadata = await fetchJson(`${apiUrl}/instance`);
  const instance = metadata.instance || {};
  const url = new URL(apiUrl);
  const domain = instance.domain || url.host;
  const rules = Array.isArray(instance.rules) ? instance.rules : [];

  return {
    name: instance.name || domain,
    domain,
    apiUrl,
    registrations: instance.registrations || 'Unknown',
    description: instance.description || `Connect to ${domain}.`,
    rules,
  };
}

router.get('/', async (req, res, next) => {
  try {
    const entries = await prisma.instanceDirectoryEntry.findMany({
      where: { status: 'VERIFIED' },
      orderBy: [{ name: 'asc' }, { createdAt: 'asc' }],
    });
    const selfServer = getSelfServer();
    const seen = new Set([selfServer.domain, selfServer.apiUrl]);
    const servers = [
      selfServer,
      ...entries
        .map(serializeEntry)
        .filter((entry) => {
          if (seen.has(entry.domain) || seen.has(entry.apiUrl)) return false;
          seen.add(entry.domain);
          seen.add(entry.apiUrl);
          return true;
        }),
    ];

    return res.json({ servers });
  } catch (error) {
    next(error);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const apiUrl = normalizeApiUrl(req.body.apiUrl);
    const category = String(req.body.category || 'Server').trim() || 'Server';
    const verified = await verifyInstance(apiUrl);
    const now = new Date();

    const entry = await prisma.instanceDirectoryEntry.upsert({
      where: { domain: verified.domain },
      update: {
        name: verified.name,
        apiUrl: verified.apiUrl,
        category,
        description: verified.description,
        registrations: verified.registrations,
        rules: verified.rules,
        status: 'VERIFIED',
        healthStatus: 'online',
        lastCheckedAt: now,
        verifiedAt: now,
      },
      create: {
        name: verified.name,
        domain: verified.domain,
        apiUrl: verified.apiUrl,
        category,
        description: verified.description,
        registrations: verified.registrations,
        rules: verified.rules,
        status: 'VERIFIED',
        healthStatus: 'online',
        lastCheckedAt: now,
        verifiedAt: now,
      },
    });

    return res.status(201).json({ server: serializeEntry(entry) });
  } catch (error) {
    if (isVerificationError(error)) {
      return res.status(400).json({
        message: error.message?.includes('Instance API URL')
          ? error.message
          : 'Unable to verify that instance API URL.',
      });
    }

    if (error.code === 'P2002') {
      return res.status(409).json({ message: 'That instance is already registered.' });
    }

    next(error);
  }
});

export default router;
