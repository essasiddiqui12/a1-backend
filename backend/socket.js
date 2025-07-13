const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const User = require('./models/User');
const ActionLog = require('./models/ActionLog');

let io;

const initializeSocket = (server) => {
  const allowedOrigins = [
    process.env.CLIENT_URL || 'http://localhost:3000',
    'https://a1-frontend-e2v2xjxcx-essa-siddiquis-projects.vercel.app',
    'http://localhost:3000'
  ];

  io = new Server(server, {
    cors: {
      origin: function (origin, callback) {
        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin) return callback(null, true);

        if (allowedOrigins.indexOf(origin) !== -1) {
          callback(null, true);
        } else {
          callback(new Error('Not allowed by CORS'));
        }
      },
      methods: ["GET", "POST"],
      credentials: true
    },
    pingTimeout: 60000,
    pingInterval: 25000
  });

  // Authentication middleware for socket connections
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      
      if (!token) {
        return next(new Error('Authentication error: No token provided'));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.id).select('-password');
      
      if (!user) {
        return next(new Error('Authentication error: User not found'));
      }

      socket.userId = user._id.toString();
      socket.user = user;
      next();
    } catch (error) {
      console.error('Socket authentication error:', error);
      next(new Error('Authentication error: Invalid token'));
    }
  });

  io.on('connection', async (socket) => {
    console.log(`User ${socket.user.name} connected: ${socket.id}`);

    // Update user online status
    try {
      await User.findByIdAndUpdate(socket.userId, {
        isOnline: true,
        lastSeen: new Date()
      });
    } catch (error) {
      console.error('Error updating user online status:', error);
    }

    // Handle joining board rooms
    socket.on('join_board', async (boardId) => {
      try {
        socket.join(`board_${boardId}`);
        socket.currentBoard = boardId;
        
        console.log(`User ${socket.user.name} joined board ${boardId}`);
        
        // Notify other users in the board
        socket.to(`board_${boardId}`).emit('user_joined', {
          user: {
            id: socket.user._id,
            name: socket.user.name,
            email: socket.user.email
          },
          message: `${socket.user.name} joined the board`
        });

        // Send current online users in the board
        const socketsInRoom = await io.in(`board_${boardId}`).fetchSockets();
        const onlineUsers = socketsInRoom.map(s => ({
          id: s.user._id,
          name: s.user.name,
          email: s.user.email
        }));

        socket.emit('online_users', onlineUsers);
      } catch (error) {
        console.error('Error joining board:', error);
        socket.emit('error', { message: 'Failed to join board' });
      }
    });

    // Handle leaving board rooms
    socket.on('leave_board', (boardId) => {
      socket.leave(`board_${boardId}`);
      socket.to(`board_${boardId}`).emit('user_left', {
        user: {
          id: socket.user._id,
          name: socket.user.name,
          email: socket.user.email
        },
        message: `${socket.user.name} left the board`
      });
      console.log(`User ${socket.user.name} left board ${boardId}`);
    });

    // Handle task editing status (for showing who's editing what)
    socket.on('task_editing_start', (data) => {
      const { taskId, boardId } = data;
      socket.to(`board_${boardId}`).emit('task_editing_start', {
        taskId,
        user: {
          id: socket.user._id,
          name: socket.user.name
        }
      });
    });

    socket.on('task_editing_stop', (data) => {
      const { taskId, boardId } = data;
      socket.to(`board_${boardId}`).emit('task_editing_stop', {
        taskId,
        user: {
          id: socket.user._id,
          name: socket.user.name
        }
      });
    });

    // Handle typing indicators for task descriptions
    socket.on('task_typing', (data) => {
      const { taskId, boardId, isTyping } = data;
      socket.to(`board_${boardId}`).emit('task_typing', {
        taskId,
        user: {
          id: socket.user._id,
          name: socket.user.name
        },
        isTyping
      });
    });

    // Handle real-time cursor position sharing (for collaborative editing)
    socket.on('cursor_position', (data) => {
      const { taskId, boardId, position } = data;
      socket.to(`board_${boardId}`).emit('cursor_position', {
        taskId,
        user: {
          id: socket.user._id,
          name: socket.user.name
        },
        position
      });
    });

    // Handle disconnect
    socket.on('disconnect', async () => {
      console.log(`User ${socket.user.name} disconnected: ${socket.id}`);

      try {
        // Update user offline status
        await User.findByIdAndUpdate(socket.userId, {
          isOnline: false,
          lastSeen: new Date()
        });

        // Notify users in current board if any
        if (socket.currentBoard) {
          socket.to(`board_${socket.currentBoard}`).emit('user_left', {
            user: {
              id: socket.user._id,
              name: socket.user.name,
              email: socket.user.email
            },
            message: `${socket.user.name} disconnected`
          });
        }
      } catch (error) {
        console.error('Error handling disconnect:', error);
      }
    });

    // Handle errors
    socket.on('error', (error) => {
      console.error('Socket error:', error);
    });
  });

  return io;
};

const getIO = () => {
  if (!io) {
    throw new Error('Socket.io not initialized');
  }
  return io;
};

// Utility function to emit to specific board
const emitToBoard = (boardId, event, data) => {
  if (io) {
    io.to(`board_${boardId}`).emit(event, data);
  }
};

// Utility function to emit to specific user
const emitToUser = (userId, event, data) => {
  if (io) {
    const userSockets = Array.from(io.sockets.sockets.values())
      .filter(socket => socket.userId === userId.toString());
    
    userSockets.forEach(socket => {
      socket.emit(event, data);
    });
  }
};

module.exports = {
  initializeSocket,
  getIO,
  emitToBoard,
  emitToUser
};
