import mongoose from 'mongoose';

const passkeySchema = new mongoose.Schema({
  credentialId: { type: String, required: true },
  publicKey: { type: String, required: true },
  counter: { type: Number, required: true },
  transports: [{ type: String }]
}, { _id: false });

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true, select: false },
  role: { type: String, enum: ['student', 'faculty'], required: true },
  studentId: { type: String, unique: true, sparse: true },
  facultyId: { type: String, unique: true, sparse: true },
  className: { type: String, trim: true },
  assignedSubjects: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Subject' }],
  devicePublicKey: { type: String, select: false },
  deviceChallenge: { value: String, expiresAt: Date },
  webauthnChallenge: { value: String, purpose: String, sessionId: String, expiresAt: Date },
  pendingAttendanceTicket: { jti: String, sessionId: String, expiresAt: Date },
  passkeys: { type: [passkeySchema], default: [] }
}, { timestamps: true });

export default mongoose.model('User', userSchema);
