const User = require('../models/User');
const Board = require('../models/Board');
const ActionLog = require('../models/ActionLog');

const register = async (req, res) => {
  try {
    console.log('📝 Registration request body:', req.body);
    const { name, email, password } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User already exists with this email'
      });
    }

    // Create user
    const user = await User.create({
      name,
      email,
      password
    });

    // Create default board for user
    const defaultBoard = await Board.create({
      name: `${name}'s Board`,
      description: 'Your personal task board',
      owner: user._id,
      members: [user._id]
    });

    // Generate token
    const token = user.generateToken();

    // Log user registration
    await ActionLog.createLog({
      user: user._id,
      action: 'user_joined',
      message: `${name} joined the board`,
      boardId: defaultBoard._id
    });

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          activeTasksCount: user.activeTasksCount,
          createdAt: user.createdAt
        },
        board: {
          id: defaultBoard._id,
          name: defaultBoard.name,
          description: defaultBoard.description
        },
        token
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      success: false,
      message: 'Registration failed',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find user and include password for comparison
    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    // Check password
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    // Update user online status
    user.isOnline = true;
    user.lastSeen = new Date();
    await user.save();

    // Find user's board (for simplicity, get the first board they're a member of)
    const board = await Board.findOne({ members: user._id });

    // Generate token
    const token = user.generateToken();

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          activeTasksCount: user.activeTasksCount,
          isOnline: user.isOnline,
          lastSeen: user.lastSeen
        },
        board: board ? {
          id: board._id,
          name: board.name,
          description: board.description
        } : null,
        token
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Login failed',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

const logout = async (req, res) => {
  try {
    // Update user offline status
    const user = await User.findById(req.user.id);
    user.isOnline = false;
    user.lastSeen = new Date();
    await user.save();

    res.json({
      success: true,
      message: 'Logout successful'
    });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      success: false,
      message: 'Logout failed'
    });
  }
};

const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    
    res.json({
      success: true,
      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          activeTasksCount: user.activeTasksCount,
          isOnline: user.isOnline,
          lastSeen: user.lastSeen,
          createdAt: user.createdAt
        }
      }
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get profile'
    });
  }
};

module.exports = {
  register,
  login,
  logout,
  getProfile
};
