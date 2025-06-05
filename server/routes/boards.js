const express = require('express');
const router = express.Router();
const Board = require('../models/Board');
const Card = require('../models/Card');

// GET /api/boards - Get all boards
router.get('/', async (req, res) => {
  try {
    const boards = await Board.find();
    res.json(boards);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch boards' });
  }
});

// POST /api/boards - Create a new board
router.post('/', async (req, res) => {
  try {
    const { title } = req.body;
    const board = new Board({
      title,
      columns: [
        { name: 'To Do', position: 0 },
        { name: 'Doing', position: 1 },
        { name: 'Done', position: 2 },
      ],
    });
    const saved = await board.save();
    res.json(saved);
  } catch (err) {
    res.status(400).json({ error: 'Failed to create board' });
  }
});

// GET /api/boards/:boardId - Get one board and its cards
router.get('/:boardId', async (req, res) => {
  try {
    const board = await Board.findById(req.params.boardId);
    const cards = await Card.find({ boardId: req.params.boardId });
    res.json({ board, cards });
  } catch (err) {
    res.status(404).json({ error: 'Board not found' });
  }
});

// PUT /api/boards/:boardId - Update board title or columns
router.put('/:boardId', async (req, res) => {
  try {
    const updated = await Board.findByIdAndUpdate(req.params.boardId, req.body, { new: true });
    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: 'Failed to update board' });
  }
});

// DELETE /api/boards/:boardId - Delete board and all its cards
router.delete('/:boardId', async (req, res) => {
  try {
    await Card.deleteMany({ boardId: req.params.boardId });
    await Board.findByIdAndDelete(req.params.boardId);
    res.json({ message: 'Board and related cards deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete board' });
  }
});

module.exports = router;
