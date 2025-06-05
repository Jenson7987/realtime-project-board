require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const app = express();
const PORT = 3001;

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

// Start server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
