const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { validateTask, validateTaskUpdate } = require('../middleware/validation');
const {
  getAllTasks,
  createTask,
  updateTask,
  deleteTask,
  smartAssignTask
} = require('../controllers/taskController');

// @route   GET /api/tasks/board/:boardId
// @desc    Get all tasks for a board
// @access  Private
router.get('/board/:boardId', authenticateToken, getAllTasks);

// @route   POST /api/tasks/board/:boardId
// @desc    Create a new task
// @access  Private
router.post('/board/:boardId', authenticateToken, validateTask, createTask);

// @route   PUT /api/tasks/:taskId
// @desc    Update a task
// @access  Private
router.put('/:taskId', authenticateToken, validateTaskUpdate, updateTask);

// @route   DELETE /api/tasks/:taskId
// @desc    Delete a task
// @access  Private
router.delete('/:taskId', authenticateToken, deleteTask);

// @route   POST /api/tasks/:taskId/smart-assign
// @desc    Smart assign task to user with fewest active tasks
// @access  Private
router.post('/:taskId/smart-assign', authenticateToken, smartAssignTask);

module.exports = router;
