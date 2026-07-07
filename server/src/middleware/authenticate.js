import jwt from 'jsonwebtoken';
import { prisma } from '../db.js';

export async function authenticate(req, res, next) {
  try {
    const header = req.headers.authorization;
    const token = header?.startsWith('Bearer ') ? header.slice(7) : null;

    if (!token) {
      return res.status(401).json({ message: 'Authentication token is required.' });
    }

    const payload = jwt.verify(token, process.env.JWT_SECRET || 'change-this-development-secret');
    const user = await prisma.user.findUnique({ where: { id: payload.sub } });

    if (!user) {
      return res.status(401).json({ message: 'User no longer exists.' });
    }

    req.user = user;
    next();
  } catch {
    return res.status(401).json({ message: 'Invalid or expired token.' });
  }
}
