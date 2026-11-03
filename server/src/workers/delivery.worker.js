import 'dotenv/config';
import http from 'node:http';
import { Worker } from 'bullmq';
import { prisma } from '../db.js';
import {
  createRedisConnection,
  DELIVERY_QUEUE_NAME,
} from '../services/delivery.service.js';
import { signActivityRequest } from '../utils/httpSignatures.js';

const connection = createRedisConnection({
  enableOfflineQueue: true,
  lazyConnect: false,
  maxRetriesPerRequest: null,
});

async function deliverActivity(job) {
  const { deliveryTaskId, actorId, inboxUrl, activity } = job.data;
  const actor = await prisma.user.findUnique({ where: { id: actorId } });

  if (!actor) {
    throw new Error(`Delivery actor not found: ${actorId}`);
  }

  const body = JSON.stringify(activity);
  const signedHeaders = signActivityRequest({ actor, inboxUrl, body });
  const response = await fetch(inboxUrl, {
    method: 'POST',
    headers: {
      ...signedHeaders,
      Accept: 'application/activity+json, application/ld+json, application/json',
      'Content-Type': 'application/activity+json',
    },
    body,
  });

  if (!response.ok) {
    const responseText = await response.text().catch(() => '');
    throw new Error(
      `Remote inbox returned ${response.status}${responseText ? `: ${responseText.slice(0, 200)}` : ''}`
    );
  }

  await prisma.deliveryTask.update({
    where: { id: deliveryTaskId },
    data: {
      status: 'SENT',
      attempts: job.attemptsMade + 1,
      lastError: null,
    },
  });
}

const worker = new Worker(DELIVERY_QUEUE_NAME, deliverActivity, {
  connection,
  concurrency: Number(process.env.FEDERATION_DELIVERY_CONCURRENCY || 5),
  drainDelay: 30,          // Wait 30s between polls when queue is empty
  stalledInterval: 300000, // Check for stalled jobs every 5 minutes
  maxStalledCount: 1,
});

worker.on('failed', async (job, error) => {
  if (!job?.data?.deliveryTaskId) return;

  await prisma.deliveryTask.update({
    where: { id: job.data.deliveryTaskId },
    data: {
      status: 'FAILED',
      attempts: job.attemptsMade,
      lastError: error.message,
    },
  });
});

worker.on('completed', (job) => {
  if (process.env.NODE_ENV === 'development') {
    console.log(`Delivered ActivityPub job ${job.id}`);
  }
});

console.log(`ActivityPub delivery worker listening on queue "${DELIVERY_QUEUE_NAME}"`);

// Minimal HTTP server so Render's Web Service port scan succeeds
const PORT = Number(process.env.PORT || 3001);
const healthServer = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ status: 'ok', queue: DELIVERY_QUEUE_NAME }));
});

healthServer.listen(PORT, '0.0.0.0', () => {
  console.log(`Worker health-check server bound to 0.0.0.0:${PORT}`);
});

async function shutdown() {
  healthServer.close();
  await worker.close();
  await connection.quit();
  await prisma.$disconnect();
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);