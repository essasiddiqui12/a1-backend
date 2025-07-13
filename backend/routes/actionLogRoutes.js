const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const {
  getActionLogs,
  getRecentLogs,
  getUserActionLogs
} = require('../controllers/actionLogController');

// @route   GET /api/logs/board/:boardId
// @desc    Get action logs for a board with pagination
// @access  Private
router.get('/board/:boardId', authenticateToken, getActionLogs);

// @route   GET /api/logs/board/:boardId/recent
// @desc    Get recent action logs for a board
// @access  Private
router.get('/board/:boardId/recent', authenticateToken, getRecentLogs);

// @route   GET /api/logs/user/:userId
// @desc    Get action logs for a specific user
// @access  Private
router.get('/user/:userId', authenticateToken, getUserActionLogs);

module.exports = router;
