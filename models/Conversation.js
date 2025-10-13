import mongoose from "mongoose";

const conversationSchema = new mongoose.Schema({
  name: {
    type: String,
    required: function() {
      return this.type === 'group' || this.type === 'team' || this.type === 'project';
    }
  },
  type: {
    type: String,
    enum: ['direct', 'group', 'team', 'project'],
    required: true
  },
  participants: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }],
  teamId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Team',
    required: function() {
      return this.type === 'team';
    }
  },
  projectId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    required: function() {
      return this.type === 'project';
    }
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  lastMessage: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  avatar: String,
  description: String,
  settings: {
    allowFileSharing: {
      type: Boolean,
      default: true
    },
    allowImages: {
      type: Boolean,
      default: true
    },
    allowVideos: {
      type: Boolean,
      default: true
    }
  }
}, {
  timestamps: true
});

conversationSchema.index({ participants: 1 });
conversationSchema.index({ teamId: 1 });
conversationSchema.index({ projectId: 1 });
conversationSchema.index({ type: 1 });

export default mongoose.model('Conversation', conversationSchema);