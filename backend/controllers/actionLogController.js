const ActionLog = require('../models/ActionLog');

const getActionLogs = async (req, res) => {
  try {
    const { boardId } = req.params;
    const { limit = 20, page = 1 } = req.query;

    const skip = (page - 1) * limit;
    
    const logs = await ActionLog.find({ boardId })
      .populate('user', 'name email')
      .populate('taskId', 'title')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(skip);

    const totalLogs = await ActionLog.countDocuments({ boardId });
    const totalPages = Math.ceil(totalLogs / limit);

    res.json({
      success: true,
      data: {
        logs,
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          totalLogs,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1
        }
      }
    });
  } catch (error) {
    console.error('Get action logs error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch action logs'
    });
  }
};

const getRecentLogs = async (req, res) => {
  try {
    const { boardId } = req.params;
    const { limit = 20 } = req.query;

    const logs = await ActionLog.getRecentLogs(boardId, parseInt(limit));

    res.json({
      success: true,
      data: { logs }
    });
  } catch (error) {
    console.error('Get recent logs error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch recent logs'
    });
  }
};

const getUserActionLogs = async (req, res) => {
  try {
    const { userId } = req.params;
    const { limit = 20, page = 1 } = req.query;

    const skip = (page - 1) * limit;
    
    const logs = await ActionLog.find({ user: userId })
      .populate('user', 'name email')
      .populate('taskId', 'title')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(skip);

    const totalLogs = await ActionLog.countDocuments({ user: userId });
    const totalPages = Math.ceil(totalLogs / limit);

    res.json({
      success: true,
      data: {
        logs,
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          totalLogs,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1
        }
      }
    });
  } catch (error) {
    console.error('Get user action logs error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch user action logs'
    });
  }
};

module.exports = {
  getActionLogs,
  getRecentLogs,
  getUserActionLogs
};
