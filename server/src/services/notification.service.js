const subscribers = new Map();

export async function createNotification(prisma, { userId, type, actorUrl, title, body, data }) {
  if (!userId || !type || !title) return null;

  const notification = await prisma.notification.create({
    data: {
      userId,
      type,
      actorUrl,
      title,
      body,
      data: data || undefined,
    },
  });
  publishNotification(userId, serializeNotification(notification));

  return notification;
}

export function serializeNotification(notification) {
  return {
    id: notification.id,
    type: notification.type,
    actorUrl: notification.actorUrl,
    title: notification.title,
    body: notification.body,
    data: notification.data,
    readAt: notification.readAt,
    createdAt: notification.createdAt,
  };
}

export function actorDisplayName(actor) {
  if (!actor) return 'Someone';
  return actor.name || actor.username || actor.actorUrl || 'Someone';
}

export function actorHandle(actor) {
  if (!actor) return '';
  if (actor.username && actor.server) return `@${actor.username}@${actor.server}`;
  return actor.actorUrl || '';
}

export function truncateNotificationBody(value, maxLength = 180) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 3)}...`;
}

export function subscribeToNotifications(userId, listener) {
  if (!subscribers.has(userId)) {
    subscribers.set(userId, new Set());
  }

  const userSubscribers = subscribers.get(userId);
  userSubscribers.add(listener);

  return () => {
    userSubscribers.delete(listener);
    if (!userSubscribers.size) {
      subscribers.delete(userId);
    }
  };
}

function publishNotification(userId, notification) {
  const userSubscribers = subscribers.get(userId);
  if (!userSubscribers) return;

  for (const listener of userSubscribers) {
    listener(notification);
  }
}
