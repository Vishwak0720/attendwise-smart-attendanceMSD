import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { config } from '../config.js';

export async function requireAuth(req, res, next) {
  const token = req.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return res.status(401).json({ message: 'Please log in to continue.' });

  let payload;
  try {
    payload = jwt.verify(token, config.JWT_SECRET);
  } catch {
    return res.status(401).json({ message: 'Your login has expired. Please sign in again.' });
  }

  try {
    const user = await User.findById(payload.sub).select('+devicePublicKey');
    if (!user) return res.status(401).json({ message: 'Account not found.' });
    req.user = user;
    return next();
  } catch (error) {
    return next(error);
  }
}

export function requireRole(role) {
  return (req, res, next) => {
    if (req.user?.role !== role) {
      return res.status(403).json({ message: 'You do not have permission to do that.' });
    }
    return next();
  };
}
