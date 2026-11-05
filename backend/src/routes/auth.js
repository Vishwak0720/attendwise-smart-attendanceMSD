import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import User from '../models/User.js';
import { config } from '../config.js';
import { asyncHandler } from '../utils/errors.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
const registrationSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().email().transform((email) => email.toLowerCase()),
  password: z.string().min(8).max(100),
  studentId: z.string().trim().min(1).max(30),
  className: z.string().trim().min(1).max(50)
});

router.post('/register', asyncHandler(async (req, res) => {
  const parsed = registrationSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: parsed.error.issues[0].message });
  const { name, email, password, studentId, className } = parsed.data;
  const passwordHash = await bcrypt.hash(password, 12);
  try {
    const user = await User.create({ name, email, passwordHash, studentId, className, role: 'student' });
    return res.status(201).json({ message: 'Student account created.', user: publicUser(user) });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ message: 'Email or student ID is already registered.' });
    throw error;
  }
}));

router.post('/login', asyncHandler(async (req, res) => {
  const parsed = z.object({
    email: z.string().email().transform((email) => email.toLowerCase()),
    password: z.string().min(1),
    role: z.enum(['student', 'faculty'])
  }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Enter a valid email, password and account type.' });

  const user = await User.findOne({ email: parsed.data.email }).select('+passwordHash');
  if (!user || user.role !== parsed.data.role || !await bcrypt.compare(parsed.data.password, user.passwordHash)) {
    return res.status(401).json({ message: 'Email or password is incorrect.' });
  }
  const token = jwt.sign({ sub: user.id }, config.JWT_SECRET, { expiresIn: '8h' });
  return res.json({ token, user: publicUser(user) });
}));

router.post('/logout', requireAuth, (_req, res) => {
  res.json({ message: 'Signed out. Remove the saved login token from this device.' });
});

export function publicUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    studentId: user.studentId,
    facultyId: user.facultyId,
    className: user.className
  };
}

export default router;
