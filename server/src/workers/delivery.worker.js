import 'dotenv/config';
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

async function shutdown() {
  await worker.close();
  await connection.quit();
  await prisma.$disconnect();
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
