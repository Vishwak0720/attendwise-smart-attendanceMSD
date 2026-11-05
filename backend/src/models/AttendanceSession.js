import mongoose from 'mongoose';

const attendanceSessionSchema = new mongoose.Schema({
  subject: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject', required: true },
  faculty: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  className: { type: String, required: true },
  startsAt: { type: Date, required: true },
  expiresAt: { type: Date, required: true },
  stoppedAt: { type: Date, default: null },
  status: { type: String, enum: ['active', 'closed'], default: 'active' }
}, { timestamps: true });

attendanceSessionSchema.index({ subject: 1, status: 1, expiresAt: 1 });
attendanceSessionSchema.index(
  { className: 1 },
  { unique: true, partialFilterExpression: { status: 'active' } }
);
attendanceSessionSchema.index(
  { faculty: 1 },
  { unique: true, partialFilterExpression: { status: 'active' } }
);
export default mongoose.model('AttendanceSession', attendanceSessionSchema);
