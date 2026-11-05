import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import AttendanceSession from '../models/AttendanceSession.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { config } from '../config.js';
import { asyncHandler } from '../utils/errors.js';
import {
  authenticationOptions,
  registrationOptions,
  verifyAuthentication,
  verifyRegistration
} from '../utils/passkey.js';

const router = Router();
router.use(requireAuth, requireRole('student'));

router.post('/register-options', asyncHandler(async (req, res) => {
  if (req.user.passkeys.length) {
    return res.status(409).json({ message: 'A passkey is already registered for this account.' });
  }
  const options = await registrationOptions(req.user);
  req.user.webauthnChallenge = {
    value: options.challenge,
    purpose: 'registration',
    expiresAt: new Date(Date.now() + 5 * 60_000)
  };
  await req.user.save();
  res.json(options);
}));

router.post('/register-verify', asyncHandler(async (req, res) => {
  const saved = req.user.webauthnChallenge;
  if (saved?.purpose !== 'registration' || saved.expiresAt < new Date()) {
    return res.status(400).json({ message: 'Passkey registration expired. Please start again.' });
  }
  let result;
  try {
    result = await verifyRegistration(req.body, saved.value);
  } catch (error) {
    return res.status(400).json({ message: `Passkey could not be verified: ${error.message}` });
  }
  req.user.webauthnChallenge = undefined;
  if (!result.verified || !result.registrationInfo) {
    await req.user.save();
    return res.status(400).json({ message: 'Passkey registration was not verified.' });
  }
  const credential = result.registrationInfo.credential;
  req.user.passkeys.push({
    credentialId: credential.id,
    publicKey: Buffer.from(credential.publicKey).toString('base64url'),
    counter: credential.counter,
    transports: credential.transports ?? []
  });
  await req.user.save();
  res.json({ message: 'Passkey registered. Your device may use its supported biometric or screen lock.' });
}));

router.post('/authenticate-options', asyncHandler(async (req, res) => {
  const parsed = z.object({ sessionId: z.string().min(1) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'A session ID is required.' });
  const session = await AttendanceSession.findOne({
    _id: parsed.data.sessionId,
    className: req.user.className,
    status: 'active',
    stoppedAt: null,
    expiresAt: { $gt: new Date() }
  });
  if (!session) return res.status(409).json({ message: 'That attendance session is closed or expired.' });
  if (!req.user.passkeys.length) return res.status(409).json({ message: 'Register a passkey before marking attendance.' });
  const options = await authenticationOptions(req.user);
  req.user.webauthnChallenge = {
    value: options.challenge,
    purpose: 'attendance',
    sessionId: session.id,
    expiresAt: new Date(Date.now() + 3 * 60_000)
  };
  await req.user.save();
  res.json(options);
}));

router.post('/authenticate-verify', asyncHandler(async (req, res) => {
  const saved = req.user.webauthnChallenge;
  if (saved?.purpose !== 'attendance' || saved.expiresAt < new Date()) {
    return res.status(400).json({ message: 'Passkey request expired. Please try again.' });
  }
  const session = await AttendanceSession.findOne({
    _id: saved.sessionId,
    className: req.user.className,
    status: 'active',
    stoppedAt: null,
    expiresAt: { $gt: new Date() }
  });
  if (!session) {
    req.user.webauthnChallenge = undefined;
    await req.user.save();
    return res.status(409).json({ message: 'That attendance session is closed or expired.' });
  }
  const credential = req.user.passkeys.find((item) => item.credentialId === req.body.id);
  if (!credential) return res.status(403).json({ message: 'This passkey is not registered to your account.' });

  let result;
  try {
    result = await verifyAuthentication(req.body, credential, saved.value);
  } catch (error) {
    return res.status(400).json({ message: `Passkey could not be verified: ${error.message}` });
  }
  req.user.webauthnChallenge = undefined;
  if (!result.verified) {
    await req.user.save();
    return res.status(403).json({ message: 'Passkey verification failed.' });
  }
  credential.counter = result.authenticationInfo.newCounter;
  const jti = randomUUID();
  const expiresAt = new Date(Date.now() + 2 * 60_000);
  req.user.pendingAttendanceTicket = { jti, sessionId: session.id, expiresAt };
  await req.user.save();
  const ticket = jwt.sign({
    sub: req.user.id,
    sessionId: session.id,
    credentialId: credential.credentialId,
    jti,
    purpose: 'attendance'
  }, config.JWT_SECRET, { expiresIn: '2m' });
  res.json({ ticket, expiresAt });
}));

export default router;
