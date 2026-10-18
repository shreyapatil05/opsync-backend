import mongoose from 'mongoose';

const activitySchema = new mongoose.Schema({
  actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  category: { type: String, enum: ['communication', 'project', 'task', 'file', 'account', 'system'], required: true, index: true },
  action: { type: String, required: true, maxlength: 80 },
  targetType: { type: String, enum: ['conversation', 'message', 'project', 'task', 'file', 'account', 'system'], required: true },
  targetId: { type: mongoose.Schema.Types.ObjectId },
  targetName: { type: String, maxlength: 200 },
  targetUrl: { type: String, maxlength: 500 },
  context: { type: String, maxlength: 200 },
  preview: { type: String, maxlength: 500 },
  changes: [{ field: String, from: mongoose.Schema.Types.Mixed, to: mongoose.Schema.Types.Mixed }],
  recipients: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  isSystem: { type: Boolean, default: false, index: true },
  savedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
}, { timestamps: true });

activitySchema.index({ actor: 1, createdAt: -1 });
activitySchema.index({ recipients: 1, createdAt: -1 });
activitySchema.index({ category: 1, createdAt: -1 });

export default mongoose.model('Activity', activitySchema);
