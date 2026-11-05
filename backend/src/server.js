import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { config, trustedProxies } from './config.js';
import authRoutes from './routes/auth.js';
import studentRoutes from './routes/student.js';
import facultyRoutes from './routes/faculty.js';
import attendanceRoutes from './routes/attendance.js';
import biometricRoutes from './routes/biometric.js';
import AttendanceSession from './models/AttendanceSession.js';

const app = express();
app.set('trust proxy', trustedProxies);
app.use(cors({ origin: config.CLIENT_ORIGIN }));
app.use(express.json({ limit: '64kb' }));
app.use('/api', rateLimit({
  windowMs: 60_000,
  limit: 180,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { message: 'Too many requests. Please wait and try again.' }
}));
app.use('/api/auth', rateLimit({
  windowMs: 15 * 60_000,
  limit: 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { message: 'Too many authentication attempts. Please wait and try again.' }
}));

app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));
app.use('/api/auth', authRoutes);
app.use('/api/student', studentRoutes);
app.use('/api/faculty', facultyRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/biometric', biometricRoutes);

app.use((_req, res) => res.status(404).json({ message: 'API route not found.' }));
app.use((error, _req, res, _next) => {
  console.error(error);
  if (error.name === 'ValidationError') {
    return res.status(400).json({ message: 'Submitted data is invalid.' });
  }
  if (error.name === 'CastError') {
    return res.status(400).json({ message: 'The requested record ID is invalid.' });
  }
  return res.status(500).json({ message: 'Unexpected server error. Check the backend log for details.' });
});

await mongoose.connect(config.MONGODB_URI);
const expireSessions = async () => {
  await AttendanceSession.updateMany(
    { status: 'active', expiresAt: { $lte: new Date() } },
    { $set: { status: 'closed' } }
  );
};
await expireSessions();
setInterval(() => {
  expireSessions().catch((error) => console.error('Could not expire attendance sessions:', error));
}, 15_000);
app.listen(config.PORT, () => {
  console.log(`Attendance API listening at http://localhost:${config.PORT}`);
});

process.on('SIGINT', async () => {
  await mongoose.disconnect();
  process.exit(0);
});
