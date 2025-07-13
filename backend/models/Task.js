const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Title is required'],
    trim: true,
    maxlength: [100, 'Title cannot exceed 100 characters'],
    validate: {
      validator: function(value) {
        const columnNames = ['Todo', 'In Progress', 'Done'];
        return !columnNames.includes(value);
      },
      message: 'Title cannot be the same as column names (Todo, In Progress, Done)'
    }
  },
  description: {
    type: String,
    trim: true,
    maxlength: [500, 'Description cannot exceed 500 characters']
  },
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Task must be assigned to a user']
  },
  status: {
    type: String,
    enum: {
      values: ['Todo', 'In Progress', 'Done'],
      message: 'Status must be Todo, In Progress, or Done'
    },
    default: 'Todo'
  },
  priority: {
    type: String,
    enum: {
      values: ['Low', 'Medium', 'High'],
      message: 'Priority must be Low, Medium, or High'
    },
    default: 'Medium'
  },
  boardId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Board',
    required: true
  },
  position: {
    type: Number,
    default: 0
  },
  lastEditedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  version: {
    type: Number,
    default: 1
  }
}, {
  timestamps: true
});

// Compound index for unique title per board
taskSchema.index({ title: 1, boardId: 1 }, { unique: true });

// Index for efficient queries
taskSchema.index({ boardId: 1, status: 1 });
taskSchema.index({ assignedTo: 1, status: 1 });

// Pre-save middleware to increment version on updates
taskSchema.pre('save', function(next) {
  if (!this.isNew && this.isModified()) {
    this.version += 1;
  }
  next();
});

// Method to check for conflicts
taskSchema.methods.hasConflict = function(clientUpdatedAt, conflictWindowMs = 5000) {
  const timeDiff = Math.abs(new Date(this.updatedAt) - new Date(clientUpdatedAt));
  return timeDiff < conflictWindowMs;
};

// Static method to find user with fewest active tasks
taskSchema.statics.findUserWithFewestTasks = async function() {
  const User = mongoose.model('User');
  return await User.findOne().sort({ activeTasksCount: 1 });
};

module.exports = mongoose.model('Task', taskSchema);
