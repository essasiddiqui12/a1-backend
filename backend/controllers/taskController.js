const Task = require('../models/Task');
const User = require('../models/User');
const ActionLog = require('../models/ActionLog');
const { getIO } = require('../socket');

const getAllTasks = async (req, res) => {
  try {
    const { boardId } = req.params;
    
    const tasks = await Task.find({ boardId })
      .populate('assignedTo', 'name email')
      .populate('lastEditedBy', 'name email')
      .sort({ position: 1, createdAt: 1 });

    res.json({
      success: true,
      data: { tasks }
    });
  } catch (error) {
    console.error('Get tasks error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch tasks'
    });
  }
};

const createTask = async (req, res) => {
  try {
    const { title, description, priority, assignedTo } = req.body;
    const { boardId } = req.params;

    // If no assignedTo provided, use smart assign
    let assignedUserId = assignedTo;
    if (!assignedUserId) {
      const userWithFewestTasks = await Task.findUserWithFewestTasks();
      assignedUserId = userWithFewestTasks ? userWithFewestTasks._id : req.user.id;
    }

    const task = await Task.create({
      title,
      description,
      priority: priority || 'Medium',
      assignedTo: assignedUserId,
      boardId,
      lastEditedBy: req.user.id
    });

    await task.populate('assignedTo', 'name email');
    await task.populate('lastEditedBy', 'name email');

    // Update assigned user's active task count
    const assignedUser = await User.findById(assignedUserId);
    await assignedUser.updateActiveTasksCount();

    // Create action log
    const actionLog = await ActionLog.createLog({
      user: req.user.id,
      action: 'task_created',
      message: `${req.user.name} created task "${title}"`,
      taskId: task._id,
      boardId,
      metadata: { priority, assignedTo: assignedUser.name }
    });

    // Emit real-time update
    const io = getIO();
    console.log(`🔥 Emitting task_created to board_${boardId}:`, { task: task.title, actionLog: actionLog.message });
    io.to(`board_${boardId}`).emit('task_created', {
      task,
      actionLog
    });

    res.status(201).json({
      success: true,
      message: 'Task created successfully',
      data: { task }
    });
  } catch (error) {
    console.error('Create task error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create task'
    });
  }
};

const updateTask = async (req, res) => {
  try {
    const { taskId } = req.params;
    const { clientUpdatedAt, ...updateData } = req.body;

    const existingTask = await Task.findById(taskId)
      .populate('assignedTo', 'name email')
      .populate('lastEditedBy', 'name email');

    if (!existingTask) {
      return res.status(404).json({
        success: false,
        message: 'Task not found'
      });
    }

    // Check for conflicts if clientUpdatedAt is provided
    if (clientUpdatedAt && existingTask.hasConflict(clientUpdatedAt)) {
      return res.status(409).json({
        success: false,
        message: 'Conflict detected',
        conflict: true,
        data: {
          serverVersion: existingTask,
          clientUpdatedAt,
          serverUpdatedAt: existingTask.updatedAt
        }
      });
    }

    // Store old values for comparison
    const oldStatus = existingTask.status;
    const oldAssignedTo = existingTask.assignedTo._id;

    // Update task
    Object.assign(existingTask, updateData);
    existingTask.lastEditedBy = req.user.id;
    
    const updatedTask = await existingTask.save();
    await updatedTask.populate('assignedTo', 'name email');
    await updatedTask.populate('lastEditedBy', 'name email');

    // Update active task counts if assignment or status changed
    if (updateData.assignedTo && updateData.assignedTo !== oldAssignedTo.toString()) {
      const oldUser = await User.findById(oldAssignedTo);
      const newUser = await User.findById(updateData.assignedTo);
      await oldUser.updateActiveTasksCount();
      await newUser.updateActiveTasksCount();
    } else if (updateData.status && updateData.status !== oldStatus) {
      const assignedUser = await User.findById(updatedTask.assignedTo._id);
      await assignedUser.updateActiveTasksCount();
    }

    // Create action log
    let actionMessage = `${req.user.name} updated task "${updatedTask.title}"`;
    if (updateData.status && updateData.status !== oldStatus) {
      actionMessage = `${req.user.name} moved "${updatedTask.title}" to ${updateData.status}`;
    }

    const actionLog = await ActionLog.createLog({
      user: req.user.id,
      action: updateData.status && updateData.status !== oldStatus ? 'task_moved' : 'task_updated',
      message: actionMessage,
      taskId: updatedTask._id,
      boardId: updatedTask.boardId,
      metadata: { 
        oldStatus, 
        newStatus: updatedTask.status,
        changes: Object.keys(updateData)
      }
    });

    // Emit real-time update
    const io = getIO();
    io.to(`board_${updatedTask.boardId}`).emit('task_updated', {
      task: updatedTask,
      actionLog
    });

    res.json({
      success: true,
      message: 'Task updated successfully',
      data: { task: updatedTask }
    });
  } catch (error) {
    console.error('Update task error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update task'
    });
  }
};

const deleteTask = async (req, res) => {
  try {
    const { taskId } = req.params;

    const task = await Task.findById(taskId)
      .populate('assignedTo', 'name email');

    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Task not found'
      });
    }

    await Task.findByIdAndDelete(taskId);

    // Update assigned user's active task count
    const assignedUser = await User.findById(task.assignedTo._id);
    await assignedUser.updateActiveTasksCount();

    // Create action log
    const actionLog = await ActionLog.createLog({
      user: req.user.id,
      action: 'task_deleted',
      message: `${req.user.name} deleted task "${task.title}"`,
      boardId: task.boardId,
      metadata: { deletedTask: task.title }
    });

    // Emit real-time update
    const io = getIO();
    io.to(`board_${task.boardId}`).emit('task_deleted', {
      taskId: task._id,
      actionLog
    });

    res.json({
      success: true,
      message: 'Task deleted successfully'
    });
  } catch (error) {
    console.error('Delete task error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete task'
    });
  }
};

const smartAssignTask = async (req, res) => {
  try {
    const { taskId } = req.params;

    const task = await Task.findById(taskId);
    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Task not found'
      });
    }

    // Find user with fewest active tasks
    const userWithFewestTasks = await Task.findUserWithFewestTasks();
    if (!userWithFewestTasks) {
      return res.status(400).json({
        success: false,
        message: 'No available users for assignment'
      });
    }

    const oldAssignedTo = task.assignedTo;
    task.assignedTo = userWithFewestTasks._id;
    task.lastEditedBy = req.user.id;

    const updatedTask = await task.save();
    await updatedTask.populate('assignedTo', 'name email');
    await updatedTask.populate('lastEditedBy', 'name email');

    // Update both users' active task counts
    const oldUser = await User.findById(oldAssignedTo);
    await oldUser.updateActiveTasksCount();
    await userWithFewestTasks.updateActiveTasksCount();

    // Create action log
    const actionLog = await ActionLog.createLog({
      user: req.user.id,
      action: 'task_assigned',
      message: `${req.user.name} smart-assigned "${task.title}" to ${userWithFewestTasks.name}`,
      taskId: task._id,
      boardId: task.boardId,
      metadata: {
        oldAssignee: oldUser.name,
        newAssignee: userWithFewestTasks.name
      }
    });

    // Emit real-time update
    const io = getIO();
    io.to(`board_${task.boardId}`).emit('task_updated', {
      task: updatedTask,
      actionLog
    });

    res.json({
      success: true,
      message: 'Task smart-assigned successfully',
      data: { task: updatedTask }
    });
  } catch (error) {
    console.error('Smart assign error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to smart assign task'
    });
  }
};

module.exports = {
  getAllTasks,
  createTask,
  updateTask,
  deleteTask,
  smartAssignTask
};
