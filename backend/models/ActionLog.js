const mongoose = require('mongoose');

const actionLogSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  action: {
    type: String,
    required: true,
    enum: [
      'task_created',
      'task_updated',
      'task_deleted',
      'task_moved',
      'task_assigned',
      'user_joined',
      'user_left'
    ]
  },
  message: {
    type: String,
    required: true,
    maxlength: [200, 'Message cannot exceed 200 characters']
  },
  taskId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Task'
  },
  boardId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Board',
    required: true
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  }
}, {
  timestamps: true
});

// Index for efficient queries (most recent first)
actionLogSchema.index({ boardId: 1, createdAt: -1 });
actionLogSchema.index({ user: 1, createdAt: -1 });

// Static method to create action log
actionLogSchema.statics.createLog = async function(logData) {
  try {
    const log = new this(logData);
    await log.save();
    
    // Populate user data for real-time emission
    await log.populate('user', 'name email');
    return log;
  } catch (error) {
    console.error('Error creating action log:', error);
    throw error;
  }
};

// Static method to get recent logs
actionLogSchema.statics.getRecentLogs = async function(boardId, limit = 20) {
  return await this.find({ boardId })
    .populate('user', 'name email')
    .populate('taskId', 'title')
    .sort({ createdAt: -1 })
    .limit(limit);
};

module.exports = mongoose.model('ActionLog', actionLogSchema);
