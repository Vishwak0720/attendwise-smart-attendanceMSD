import { Router } from 'express';
import { createPublicKey, randomBytes } from 'node:crypto';
import User from '../models/User.js';
import AttendanceSession from '../models/AttendanceSession.js';
import AttendanceRecord from '../models/AttendanceRecord.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { asyncHandler } from '../utils/errors.js';

const router = Router();
router.use(requireAuth, requireRole('student'));

router.get('/profile', (req, res) => {
  res.json({
    user: {
      id: req.user.id,
      name: req.user.name,
      email: req.user.email,
      studentId: req.user.studentId,
      className: req.user.className,
      hasDevice: Boolean(req.user.devicePublicKey),
      hasPasskey: req.user.passkeys.length > 0
    }
  });
});

router.get('/dashboard', asyncHandler(async (req, res) => {
  const sessions = await AttendanceSession.find({
    className: req.user.className,
    startsAt: { $lte: new Date() }
  }).populate('subject', 'name code');
  const attendedIds = new Set((await AttendanceRecord.find({ student: req.user.id }).select('session'))
    .map((record) => record.session.toString()));
  const totalClasses = sessions.length;
  const classesAttended = sessions.filter((session) => attendedIds.has(session.id)).length;
  const activeSession = await AttendanceSession.findOne({
    className: req.user.className,
    status: 'active',
    expiresAt: { $gt: new Date() },
    stoppedAt: null
  }).populate('subject', 'name code');
  const subjectSummaries = await Promise.all(
    [...new Set(sessions.map((session) => session.subject?._id.toString()).filter(Boolean))]
      .map(async (subjectId) => {
        const subjectSessions = sessions.filter((session) => session.subject?._id.toString() === subjectId);
        const attended = subjectSessions.filter((session) => attendedIds.has(session.id)).length;
        return {
          subject: subjectSessions[0].subject,
          attended,
          total: subjectSessions.length,
          percentage: subjectSessions.length ? Math.round(attended / subjectSessions.length * 100) : 0
        };
      })
  );
  res.json({
    totalClasses,
    classesAttended,
    classesMissed: totalClasses - classesAttended,
    attendancePercentage: totalClasses ? Math.round(classesAttended / totalClasses * 100) : 0,
    activeSession,
    subjects: subjectSummaries
  });
}));

router.get('/attendance', asyncHandler(async (req, res) => {
  const records = await AttendanceRecord.find({ student: req.user.id })
    .sort({ markedAt: -1 })
    .populate({ path: 'subject', select: 'name code' })
    .populate({ path: 'session', select: 'startsAt className' });
  res.json({ records });
}));

router.get('/attendance-percentage', asyncHandler(async (req, res) => {
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

router.post('/device/register', asyncHandler(async (req, res) => {
  if (req.user.devicePublicKey) {
    return res.status(409).json({ message: 'A device is already registered. Ask faculty to reset it before replacing this device.' });
  }
  if (typeof req.body.publicKey !== 'string' || req.body.publicKey.length > 2000) {
    return res.status(400).json({ message: 'A valid device public key is required.' });
  }
  let publicKey;
  try {
    publicKey = createPublicKey({
      key: Buffer.from(req.body.publicKey, 'base64url'),
      format: 'der',
      type: 'spki'
    }).export({ type: 'spki', format: 'pem' }).toString();
  } catch {
    return res.status(400).json({ message: 'Device key is invalid.' });
  }
  req.user.devicePublicKey = publicKey;
  await req.user.save();
  res.status(201).json({ message: 'This browser is now registered to your account.' });
}));

router.post('/device/challenge', asyncHandler(async (req, res) => {
  if (!req.user.devicePublicKey) {
    return res.status(409).json({ message: 'Register this device before marking attendance.' });
  }
  const challenge = randomBytes(32).toString('base64url');
  req.user.deviceChallenge = { value: challenge, expiresAt: new Date(Date.now() + 2 * 60_000) };
  await req.user.save();
  res.json({ challenge });
}));

export default router;
