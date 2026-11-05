import mongoose from 'mongoose';

const attendanceRecordSchema = new mongoose.Schema({
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  session: { type: mongoose.Schema.Types.ObjectId, ref: 'AttendanceSession', required: true },
  subject: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject', required: true },
  markedAt: { type: Date, required: true },
  status: { type: String, enum: ['present'], default: 'present' },
  verification: {
    gps: { type: Boolean, required: true },
    network: { type: Boolean, required: true },
    device: { type: Boolean, required: true },
    passkey: { type: Boolean, required: true }
  }
}, { timestamps: true });

attendanceRecordSchema.index({ student: 1, session: 1 }, { unique: true });
export default mongoose.model('AttendanceRecord', attendanceRecordSchema);
