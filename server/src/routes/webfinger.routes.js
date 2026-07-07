import { Router } from 'express';
import { ensureActivityPubIdentity, findLocalActor } from '../services/actor.service.js';

const router = Router();

function parseAcctResource(resource) {
  const value = String(resource || '').trim();
  if (!value.startsWith('acct:')) return null;

  const handle = value.slice(5);
  const atIndex = handle.lastIndexOf('@');
  if (atIndex <= 0 || atIndex === handle.length - 1) return null;

  return {
    username: handle.slice(0, atIndex).toLowerCase(),
    domain: handle.slice(atIndex + 1).toLowerCase(),
    subject: `acct:${handle.toLowerCase()}`,
  };
}

router.get('/webfinger', async (req, res, next) => {
  try {
    const parsed = parseAcctResource(req.query.resource);

    if (!parsed) {
      return res.status(400).json({
        message: 'WebFinger resource must use acct:username@domain format.',
      });
    }

    const user = await findLocalActor(parsed.username, parsed.domain);
    if (!user) {
      return res.status(404).json({ message: 'Resource not found.' });
    }

    const actor = await ensureActivityPubIdentity(user);

    res.set('Content-Type', 'application/jrd+json; charset=utf-8');
    return res.json({
      subject: parsed.subject,
      aliases: [actor.actorUrl],
      links: [
        {
          rel: 'self',
          type: 'application/activity+json',
          href: actor.actorUrl,
        },
        {
          rel: 'http://webfinger.net/rel/profile-page',
          type: 'text/html',
          href: actor.actorUrl,
        },
      ],
    });
  } catch (error) {
    next(error);
  }
});

export default router;
