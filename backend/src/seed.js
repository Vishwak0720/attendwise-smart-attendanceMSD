import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { config } from './config.js';
import User from './models/User.js';
import Subject from './models/Subject.js';

await mongoose.connect(config.MONGODB_URI);
const facultyPassword = await bcrypt.hash('FacultyDemo123!', 12);
const studentPassword = await bcrypt.hash('StudentDemo123!', 12);

const faculty = await User.findOneAndUpdate(
  { email: 'faculty@example.edu' },
  {
    $set: {
      name: 'Demo Faculty',
      email: 'faculty@example.edu',
      passwordHash: facultyPassword,
      role: 'faculty',
      facultyId: 'FAC-001'
    }
  },
  { upsert: true, new: true, setDefaultsOnInsert: true }
);
await User.findOneAndUpdate(
  { email: 'student@example.edu' },
  {
    $set: {
      name: 'Demo Student',
      email: 'student@example.edu',
      passwordHash: studentPassword,
      role: 'student',
      studentId: 'STU-001',
      className: 'CSE-3A'
    }
  },
  { upsert: true, new: true, setDefaultsOnInsert: true }
);
await Subject.findOneAndUpdate(
  { code: 'CSE301' },
  { $set: { name: 'Database Management Systems', code: 'CSE301', faculty: faculty.id, className: 'CSE-3A' } },
  { upsert: true, new: true, setDefaultsOnInsert: true }
);
await Subject.findOneAndUpdate(
  { code: 'CSE302' },
  { $set: { name: 'Computer Networks', code: 'CSE302', faculty: faculty.id, className: 'CSE-3A' } },
  { upsert: true, new: true, setDefaultsOnInsert: true }
);

console.log('Demo data is ready. Sign in with the accounts documented in README.md.');
await mongoose.disconnect();
