import { Router } from 'express';
import { verify as verifySignature } from 'node:crypto';
import jwt from 'jsonwebtoken';
import AttendanceSession from '../models/AttendanceSession.js';
import AttendanceRecord from '../models/AttendanceRecord.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { asyncHandler, distanceInMeters, isValidCoordinates } from '../utils/errors.js';
import { isAuthorizedNetwork } from '../utils/network.js';
import { collegeLocation, config } from '../config.js';

const router = Router();

router.get('/active-session', requireAuth, requireRole('student'), asyncHandler(async (req, res) => {
  const session = await AttendanceSession.findOne({
    className: req.user.className,
    status: 'active',
    stoppedAt: null,
    expiresAt: { $gt: new Date() }
  }).populate('subject', 'name code');
  res.json({ session });
}));

router.get('/history', requireAuth, requireRole('student'), asyncHandler(async (req, res) => {
  const records = await AttendanceRecord.find({ student: req.user.id })
    .sort({ markedAt: -1 })
    .populate('subject', 'name code')
    .populate('session', 'startsAt');
  res.json({ records });
}));

router.get('/percentage', requireAuth, requireRole('student'), asyncHandler(async (req, res) => {
  const sessions = await AttendanceSession.find({
    className: req.user.className,
    startsAt: { $lte: new Date() }
  }).select('_id');
  const attended = await AttendanceRecord.countDocuments({
    student: req.user.id,
    session: { $in: sessions.map((session) => session.id) }
  });
  const total = sessions.length;
  res.json({
    totalClasses: total,
    classesAttended: attended,
    classesMissed: total - attended,
    attendancePercentage: total ? Math.round(attended / total * 100) : 0
  });
}));

router.post('/mark-present', requireAuth, requireRole('student'), asyncHandler(async (req, res) => {
  const { sessionId, latitude, longitude, biometricTicket, deviceChallenge, deviceSignature } = req.body;
  if (typeof sessionId !== 'string' || !isValidCoordinates(latitude, longitude)
    || typeof biometricTicket !== 'string' || typeof deviceChallenge !== 'string'
    || typeof deviceSignature !== 'string') {
    return res.status(400).json({ message: 'Complete location, device and passkey verification before submitting.' });
  }

  const session = await AttendanceSession.findOne({
    _id: sessionId,
    className: req.user.className,
    status: 'active',
    stoppedAt: null,
    startsAt: { $lte: new Date() },
    expiresAt: { $gt: new Date() }
  });
  if (!session) return res.status(409).json({ message: 'Attendance is not active or has expired.' });
  if (await AttendanceRecord.exists({ student: req.user.id, session: session.id })) {
    return res.status(409).json({ message: 'Your attendance is already recorded for this session.' });
  }
  if (collegeLocation.latitude === null || collegeLocation.longitude === null) {
    return res.status(503).json({ message: 'College GPS coordinates are not configured on the server.' });
  }
  const gpsPassed = distanceInMeters(
    { latitude, longitude },
    collegeLocation
  ) <= config.COLLEGE_RADIUS_METERS;
  if (!gpsPassed) return res.status(403).json({ message: 'GPS verification failed: you are outside the allowed college radius.' });

  const networkPassed = isAuthorizedNetwork(req.ip);
  if (!networkPassed) return res.status(403).json({ message: 'Network verification failed: connect to an authorized college network.' });

  if (!req.user.devicePublicKey) {
    return res.status(403).json({ message: 'Register this device before marking attendance.' });
  }
  const savedDeviceChallenge = req.user.deviceChallenge;
  if (savedDeviceChallenge?.value !== deviceChallenge
    || savedDeviceChallenge.expiresAt < new Date()) {
    return res.status(403).json({ message: 'Device verification expired. Please retry.' });
  }
  const devicePassed = verifySignature(
    'sha256',
    Buffer.from(deviceChallenge),
    req.user.devicePublicKey,
    Buffer.from(deviceSignature, 'base64url')
  );
  if (!devicePassed) return res.status(403).json({ message: 'Device verification failed.' });

  let ticket;
  try {
    ticket = jwt.verify(biometricTicket, config.JWT_SECRET);
  } catch {
    return res.status(403).json({ message: 'Passkey verification expired. Please authenticate again.' });
  }
  const pendingTicket = req.user.pendingAttendanceTicket;
  if (!pendingTicket || ticket.sub !== req.user.id || ticket.purpose !== 'attendance'
    || ticket.sessionId !== session.id || ticket.jti !== pendingTicket?.jti
    || pendingTicket.sessionId !== session.id || pendingTicket.expiresAt < new Date()) {
    return res.status(403).json({ message: 'Passkey verification does not match this attendance session.' });
  }

  try {
    const record = await AttendanceRecord.create({
      student: req.user.id,
      session: session.id,
      subject: session.subject,
      markedAt: new Date(),
      verification: { gps: true, network: true, device: true, passkey: true }
    });
    req.user.deviceChallenge = undefined;
    req.user.pendingAttendanceTicket = undefined;
    await req.user.save();
    return res.status(201).json({ message: 'Attendance marked present.', record });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ message: 'Your attendance is already recorded for this session.' });
    throw error;
  }
}));

export default router;
