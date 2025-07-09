const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const User = require('./models/User');

if (!process.env.JWT_SECRET) {
  console.error('JWT_SECRET is not set in environment variables');
  process.exit(1);
}

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true,
    allowedHeaders: ["Authorization"]
  },
  transports: ['polling', 'websocket'],
  allowEIO3: true,
  pingTimeout: 60000,
  pingInterval: 25000,
  connectTimeout: 45000,
  maxHttpBufferSize: 1e8
});

// Make io instance available to routes
app.set('io', io);

const PORT = process.env.PORT || 3001;

// Load models
const Board = require('./models/Board');

// Middleware
app.use(cors());
app.use(express.json());

// Routes
const boardRoutes = require('./routes/boards');
const cardRoutes = require('./routes/cards');
const authRoutes = require('./routes/auth');

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/auth', authRoutes);
app.use('/api/boards', boardRoutes);
app.use('/api/cards', cardRoutes);

// Socket.io authentication middleware
io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth.token;
    console.log('Socket auth attempt with token:', token ? 'present' : 'missing');
    
    if (!token) {
      console.log('No token provided for socket connection');
      return next(new Error('Authentication error'));
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log('Socket token decoded:', decoded);
    
    const user = await User.findById(decoded.userId).select('-password');
    console.log('Socket user found:', user ? 'yes' : 'no');
    
    if (!user) {
      console.log('User not found for socket connection');
      return next(new Error('User not found'));
    }

    socket.user = user;
    next();
  } catch (error) {
    console.error('Socket authentication error:', error);
    next(new Error('Authentication error'));
  }
});

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log('Client connected:', socket.user.username);

  // Join a board room
  socket.on('joinBoard', async (boardId) => {
    try {
      console.log(`User ${socket.user.username} attempting to join board: ${boardId}`);
      const board = await Board.findOne({
        _id: boardId,
        $or: [
          { owner: socket.user._id },
          { sharedWith: { $in: [socket.user._id] } }
        ]
      });

      if (!board) {
        console.log(`Access denied for user ${socket.user.username} to board ${boardId}`);
        return socket.emit('error', 'Access denied');
      }

      socket.join(boardId.toString());
      console.log(`${socket.user.username} successfully joined board: ${boardId}`);
      console.log(`Socket rooms after join:`, Array.from(socket.rooms));
    } catch (error) {
      console.error('Error joining board:', error);
      socket.emit('error', 'Failed to join board');
    }
  });

  // Leave a board room
  socket.on('leaveBoard', (boardId) => {
    socket.leave(boardId.toString());
    console.log(`${socket.user.username} left board: ${boardId}`);
  });

  // Handle card updates
  socket.on('cardUpdated', async (data) => {
    try {
      const board = await Board.findOne({
        _id: data.boardId,
        $or: [
          { owner: socket.user._id },
          { sharedWith: { $in: [socket.user._id] } }
        ]
      });

      if (!board) {
        return socket.emit('error', 'Access denied');
      }

      socket.to(data.boardId.toString()).emit('cardUpdated', data);
    } catch (error) {
      console.error('Error updating card:', error);
      socket.emit('error', 'Failed to update card');
    }
  });

  // Handle card creation
  socket.on('cardCreated', async (data) => {
    try {
      const board = await Board.findOne({
        _id: data.boardId,
        $or: [
          { owner: socket.user._id },
          { sharedWith: { $in: [socket.user._id] } }
        ]
      });

      if (!board) {
        return socket.emit('error', 'Access denied');
      }

      socket.to(data.boardId.toString()).emit('cardCreated', data);
    } catch (error) {
      console.error('Error creating card:', error);
      socket.emit('error', 'Failed to create card');
    }
  });

  // Handle card deletion
  socket.on('cardDeleted', async (data) => {
    try {
      const board = await Board.findOne({
        _id: data.boardId,
        $or: [
          { owner: socket.user._id },
          { sharedWith: { $in: [socket.user._id] } }
        ]
      });

      if (!board) {
        return socket.emit('error', 'Access denied');
      }

      socket.to(data.boardId.toString()).emit('cardDeleted', data);
    } catch (error) {
      console.error('Error deleting card:', error);
      socket.emit('error', 'Failed to delete card');
    }
  });

  // Handle column updates
  socket.on('columnUpdated', async (data) => {
    try {
      const board = await Board.findOne({
        _id: data.boardId,
        $or: [
          { owner: socket.user._id },
          { sharedWith: { $in: [socket.user._id] } }
        ]
      });

      if (!board) {
        return socket.emit('error', 'Access denied');
      }

      socket.to(data.boardId).emit('columnUpdated', data);
    } catch (error) {
      console.error('Error updating column:', error);
      socket.emit('error', 'Failed to update column');
    }
  });

  // Handle column creation
  socket.on('columnCreated', async (data) => {
    try {
      const board = await Board.findOne({
        _id: data.boardId,
        $or: [
          { owner: socket.user._id },
          { sharedWith: { $in: [socket.user._id] } }
        ]
      });

      if (!board) {
        return socket.emit('error', 'Access denied');
      }

      socket.to(data.boardId).emit('columnCreated', data);
    } catch (error) {
      console.error('Error creating column:', error);
      socket.emit('error', 'Failed to create column');
    }
  });

  // Handle column deletion
  socket.on('columnDeleted', async (data) => {
    try {
      const board = await Board.findOne({
        _id: data.boardId,
        $or: [
          { owner: socket.user._id },
          { sharedWith: { $in: [socket.user._id] } }
        ]
      });

      if (!board) {
        return socket.emit('error', 'Access denied');
      }

      socket.to(data.boardId).emit('columnDeleted', data);
    } catch (error) {
      console.error('Error deleting column:', error);
      socket.emit('error', 'Failed to delete column');
    }
  });

  // Card movement is now handled through the API route, which emits the appropriate events

  // Test event handler
  socket.on('test', (data) => {
    console.log('Received test event from client:', data);
    console.log('Client socket ID:', socket.id);
    console.log('Client username:', socket.user.username);
    socket.emit('testResponse', { message: 'Hello from server', received: data });
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.user.username);
  });
});

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('MongoDB Atlas connected'))
.catch(err => console.error('MongoDB Atlas connection error:', err));

// Start server
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
