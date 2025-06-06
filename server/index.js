require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true
  },
  transports: ['websocket', 'polling'],
  allowEIO3: true
});
const PORT = process.env.PORT || 3001;

// Load models
const Board = require('./models/Board');
const Card = require('./models/Card');

// Correct Mongo URI from .env
const MONGO_URI = process.env.MONGO_URI;

console.log('Connecting to Mongo URI:', process.env.MONGO_URI);

mongoose.connect(MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('MongoDB Atlas connected'))
.catch(err => console.error('MongoDB Atlas connection error:', err));

// Middleware
app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK' });
});

// Optional test route to create board
app.get('/api/test-create-board', async (req, res) => {
  const board = new Board({
    title: 'Test Board',
    columns: [
      { name: 'To Do', position: 0 },
      { name: 'Doing', position: 1 },
      { name: 'Done', position: 2 },
    ],
  });

  try {
    const savedBoard = await board.save();
    res.json(savedBoard);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create board' });
  }
});

const boardRoutes = require('./routes/boards');
const cardRoutes = require('./routes/cards');

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log('Client connected');

  // Join a board room
  socket.on('joinBoard', (boardId) => {
    socket.join(boardId);
    console.log(`Client joined board: ${boardId}`);
  });

  // Leave a board room
  socket.on('leaveBoard', (boardId) => {
    socket.leave(boardId);
    console.log(`Client left board: ${boardId}`);
  });

  // Handle card updates
  socket.on('cardUpdated', (data) => {
    socket.to(data.boardId).emit('cardUpdated', data);
  });

  // Handle card creation
  socket.on('cardCreated', (data) => {
    socket.to(data.boardId).emit('cardCreated', data);
  });

  // Handle card deletion
  socket.on('cardDeleted', (data) => {
    socket.to(data.boardId).emit('cardDeleted', data);
  });

  // Handle column updates
  socket.on('columnUpdated', (data) => {
    socket.to(data.boardId).emit('columnUpdated', data);
  });

  // Handle column creation
  socket.on('columnCreated', (data) => {
    socket.to(data.boardId).emit('columnCreated', data);
  });

  // Handle column deletion
  socket.on('columnDeleted', (data) => {
    socket.to(data.boardId).emit('columnDeleted', data);
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected');
  });
});

// Routes
app.use('/api/boards', boardRoutes);
app.use('/api/cards', cardRoutes);

// Start server
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
