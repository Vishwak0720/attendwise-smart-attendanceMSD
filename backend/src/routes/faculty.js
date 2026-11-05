import { Router } from 'express';
import { z } from 'zod';
import User from '../models/User.js';
import Subject from '../models/Subject.js';
import AttendanceSession from '../models/AttendanceSession.js';
import AttendanceRecord from '../models/AttendanceRecord.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { asyncHandler } from '../utils/errors.js';

const router = Router();
router.use(requireAuth, requireRole('faculty'));

router.get('/dashboard', asyncHandler(async (req, res) => {
  const subjects = await Subject.find({ faculty: req.user.id }).select('name code className');
  const classNames = [...new Set(subjects.map((subject) => subject.className))];
  const students = await User.find({ role: 'student', className: { $in: classNames } })
    .select('name studentId className +devicePublicKey');
  const activeSession = await AttendanceSession.findOne({
    faculty: req.user.id,
    status: 'active',
    expiresAt: { $gt: new Date() },
    stoppedAt: null
  }).populate('subject', 'name code');
  const recentSessions = await AttendanceSession.find({ faculty: req.user.id })
    .sort({ startsAt: -1 })
    .limit(20)
    .populate('subject', 'name code');
  const records = activeSession
    ? await AttendanceRecord.find({ session: activeSession.id }).populate('student', 'name studentId')
    : [];
  res.json({
    subjects,
    students: students.map((student) => ({
      id: student.id,
      name: student.name,
      studentId: student.studentId,
      className: student.className,
      hasDevice: Boolean(student.devicePublicKey)
    })),
    activeSession,
    records,
    recentSessions
  });
}));

router.post('/start-session', asyncHandler(async (req, res) => {
  const parsed = z.object({
    subjectId: z.string().min(1),
    durationMinutes: z.union([z.literal(5), z.literal(10), z.literal(15), z.literal(20)])
  }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Choose a subject and a duration of 5, 10, 15 or 20 minutes.' });

  const subject = await Subject.findOne({
    _id: parsed.data.subjectId,
    faculty: req.user.id
  });
  if (!subject) return res.status(404).json({ message: 'That subject is not assigned to your account.' });

  const now = new Date();
  await AttendanceSession.updateMany(
    {
      $or: [{ className: subject.className }, { faculty: req.user.id }],
      status: 'active',
      expiresAt: { $lte: now }
    },
    { $set: { status: 'closed' } }
  );
  const existing = await AttendanceSession.findOne({
    $or: [{ className: subject.className }, { faculty: req.user.id }],
    status: 'active',
    expiresAt: { $gt: now },
    stoppedAt: null
  });
  if (existing) return res.status(409).json({ message: 'Stop the current attendance session before starting another.' });

  try {
    const session = await AttendanceSession.create({
      subject: subject.id,
      faculty: req.user.id,
      className: subject.className,
      startsAt: now,
      expiresAt: new Date(now.getTime() + parsed.data.durationMinutes * 60_000)
    });
    return res.status(201).json({ session });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ message: 'A session for this faculty member or class is already active.' });
    }
    throw error;
  }
}));

router.post('/stop-session', asyncHandler(async (req, res) => {
  const session = await AttendanceSession.findOneAndUpdate(
    { _id: req.body.sessionId, faculty: req.user.id, status: 'active', stoppedAt: null },
    { $set: { status: 'closed', stoppedAt: new Date() } },
    { new: true }
  );
  if (!session) return res.status(404).json({ message: 'No active session was found.' });
  res.json({ session });
}));

router.get('/attendance-report', asyncHandler(async (req, res) => {
  const parsed = z.object({
    sessionId: z.string().min(1)
  }).safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ message: 'A session ID is required.' });

  const session = await AttendanceSession.findOne({
    _id: parsed.data.sessionId,
    faculty: req.user.id
  }).populate('subject', 'name code');
  if (!session) return res.status(404).json({ message: 'Attendance session not found.' });
  const roster = await User.find({ role: 'student', className: session.className })
    .select('name studentId email');
  const records = await AttendanceRecord.find({ session: session.id }).populate('student', 'name studentId email');
  const presentIds = new Set(records.map((record) => record.student.id));
  const rows = roster.map((student) => {
    const record = records.find((item) => item.student.id === student.id);
    return {
      name: student.name,
      studentId: student.studentId,
      email: student.email,
      status: presentIds.has(student.id) ? 'Present' : 'Absent',
      markedAt: record?.markedAt ?? null,
      verification: record?.verification ?? null
    };
  });

  if (req.query.format === 'csv') {
    const escape = (value) => `"${String(value ?? '').replaceAll('"', '""')}"`;
    const csv = [
      ['Student name', 'Student ID', 'Email', 'Status', 'Marked at'],
      ...rows.map((row) => [row.name, row.studentId, row.email, row.status, row.markedAt?.toISOString() ?? ''])
    ].map((row) => row.map(escape).join(',')).join('\r\n');
    res.setHeader('content-type', 'text/csv; charset=utf-8');
    res.setHeader('content-disposition', `attachment; filename="attendance-${session.id}.csv"`);
    return res.send(csv);
  }
  res.json({ session, rows });
}));

router.post('/students/:studentId/reset-device', asyncHandler(async (req, res) => {
  const student = await User.findOne({ _id: req.params.studentId, role: 'student' });
  if (!student) return res.status(404).json({ message: 'Student not found.' });
  const assignedClass = await Subject.exists({ faculty: req.user.id, className: student.className });
  if (!assignedClass) return res.status(403).json({ message: 'You cannot manage devices for this class.' });
  student.devicePublicKey = undefined;
  student.deviceChallenge = undefined;
  await student.save();
  res.json({ message: 'Device registration cleared. The student can register a replacement device.' });
}));

export default router;
