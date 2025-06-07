const socketIO = require('socket.io');
const jwt = require('jsonwebtoken');
const User = require('./models/User');

function initializeSocket(server) {
  const io = socketIO(server, {
    cors: {
      origin: "http://localhost:5173",
      methods: ["GET", "POST"]
    }
  });

  // Middleware to authenticate socket connections
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      if (!token) {
        return next(new Error('Authentication error'));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.userId);
      
      if (!user) {
        return next(new Error('User not found'));
      }

      socket.user = user;
      next();
    } catch (error) {
      next(new Error('Authentication error'));
    }
  });

  io.on('connection', (socket) => {
    console.log('User connected:', socket.user.email);

    // Handle tab-specific room joining
    socket.on('joinTab', ({ tabId }) => {
      // Leave any existing tab rooms
      const rooms = Array.from(socket.rooms);
      rooms.forEach(room => {
        if (room !== socket.id && room.startsWith('tab_')) {
          socket.leave(room);
        }
      });
      
      // Join the new tab room
      const tabRoom = `tab_${tabId}`;
      socket.join(tabRoom);
      console.log(`User ${socket.user.email} joined tab room: ${tabRoom}`);
    });

    // Handle board room joining
    socket.on('joinBoard', (boardId) => {
      socket.join(boardId);
      console.log(`User ${socket.user.email} joined board: ${boardId}`);
    });

    // Handle board room leaving
    socket.on('leaveBoard', (boardId) => {
      socket.leave(boardId);
      console.log(`User ${socket.user.email} left board: ${boardId}`);
    });

    // Handle card movement
    socket.on('moveCard', (data) => {
      const { boardId, cardId, sourceColumnId, destinationColumnId, sourceIndex, destinationIndex } = data;
      socket.to(boardId).emit('cardMoved', {
        cardId,
        sourceColumnId,
        destinationColumnId,
        sourceIndex,
        destinationIndex
      });
    });

    socket.on('disconnect', () => {
      console.log('User disconnected:', socket.user.email);
    });
  });

  return io;
}

module.exports = initializeSocket; 