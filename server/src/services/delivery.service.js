import IORedis from 'ioredis';
import { Queue } from 'bullmq';
import { prisma } from '../db.js';

export const DELIVERY_QUEUE_NAME = 'activity-delivery';
const QUEUE_ADD_TIMEOUT_MS = Number(process.env.FEDERATION_QUEUE_TIMEOUT_MS || 1500);

let queue;
let queueConnection;

function getRedisUrl() {
  return process.env.REDIS_URL || 'redis://127.0.0.1:6379';
}

export function createRedisConnection(options = {}) {
  return new IORedis(getRedisUrl(), {
    connectTimeout: Number(process.env.REDIS_CONNECT_TIMEOUT_MS || 1000),
    maxRetriesPerRequest:
      options.maxRetriesPerRequest === undefined ? 1 : options.maxRetriesPerRequest,
    enableOfflineQueue: options.enableOfflineQueue ?? false,
    lazyConnect: options.lazyConnect ?? true,
  });
}

function getDeliveryQueue() {
  if (queue) return queue;

  queueConnection = createRedisConnection();
  queueConnection.on('error', (error) => {
    if (process.env.NODE_ENV === 'development') {
      console.warn(`Federation queue Redis error: ${error.message}`);
    }
  });

  queue = new Queue(DELIVERY_QUEUE_NAME, {
    connection: queueConnection,
    defaultJobOptions: {
      attempts: Number(process.env.FEDERATION_DELIVERY_ATTEMPTS || 5),
      backoff: {
        type: 'exponential',
        delay: Number(process.env.FEDERATION_DELIVERY_BACKOFF_MS || 5000),
      },
      removeOnComplete: 200,
      removeOnFail: 500,
    },
  });

  return queue;
}

async function withTimeout(promise, timeoutMs, message) {
  let timeout;
  const timeoutPromise = new Promise((resolve, reject) => {
    timeout = setTimeout(() => reject(new Error(message)), timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    clearTimeout(timeout);
  }
}

export async function enqueueActivityDelivery({ actor, inboxUrl, activity }) {
  if (!actor?.id || !actor?.actorUrl || !inboxUrl || !activity) return null;

  const deliveryTask = await prisma.deliveryTask.create({
    data: {
      activityId: typeof activity.id === 'string' ? activity.id : null,
      inboxUrl,
      actorId: actor.id,
      status: 'PENDING',
    },
  });

  try {
    await withTimeout(
      getDeliveryQueue().add(
        'deliver-activity',
        {
          deliveryTaskId: deliveryTask.id,
          actorId: actor.id,
          inboxUrl,
          activity,
        },
        {
          jobId: deliveryTask.id,
        }
      ),
      QUEUE_ADD_TIMEOUT_MS,
      'Federation queue timed out.'
    );
  } catch (error) {
    await prisma.deliveryTask.update({
      where: { id: deliveryTask.id },
      data: {
        status: 'FAILED',
        lastError: `Queue unavailable: ${error.message}`,
      },
    });

    if (process.env.NODE_ENV === 'development') {
      console.warn(`Unable to queue ActivityPub delivery: ${error.message}`);
    }
  }

  return deliveryTask;
}

export async function recordOutboundActivity(activity) {
  const activityId = typeof activity?.id === 'string' && activity.id.trim() ? activity.id.trim() : null;
  const data = {
    type: typeof activity?.type === 'string' ? activity.type : 'Unknown',
    actorUrl: typeof activity?.actor === 'string' ? activity.actor : activity?.actor?.id || null,
    direction: 'OUTBOUND',
    raw: activity,
  };

  if (!activityId) {
    return prisma.federationActivity.create({ data });
  }

  return prisma.federationActivity.upsert({
    where: { activityId },
    update: data,
    create: {
      ...data,
      activityId,
    },
  });
}
