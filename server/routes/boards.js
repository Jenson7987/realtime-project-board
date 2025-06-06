const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
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
        { _id: new mongoose.Types.ObjectId(), name: 'To Do', position: 0 },
        { _id: new mongoose.Types.ObjectId(), name: 'Doing', position: 1 },
        { _id: new mongoose.Types.ObjectId(), name: 'Done', position: 2 },
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

// POST /api/boards/:boardId/columns - Add a new column to a board
router.post('/:boardId/columns', async (req, res) => {
  try {
    const { boardId } = req.params;
    const { _id, name, position } = req.body;

    const board = await Board.findById(boardId);
    if (!board) {
      return res.status(404).json({ error: 'Board not found' });
    }

    // Create a new column with a MongoDB ObjectId
    const newColumn = {
      _id: new mongoose.Types.ObjectId(),
      name,
      position
    };

    board.columns.push(newColumn);
    const updatedBoard = await board.save();

    res.json(updatedBoard);
  } catch (err) {
    console.error('Error adding column:', err);
    res.status(400).json({ error: 'Failed to add column' });
  }
});

// DELETE /api/boards/:boardId/columns/:columnId - Remove a column from a board
router.delete('/:boardId/columns/:columnId', async (req, res) => {
  try {
    const { boardId, columnId } = req.params;

    // Check if there are any cards in this column
    const cardsInColumn = await Card.find({ boardId, columnId });
    if (cardsInColumn.length > 0) {
      return res.status(400).json({ error: 'Cannot delete column with cards' });
    }

    const board = await Board.findById(boardId);
    if (!board) {
      return res.status(404).json({ error: 'Board not found' });
    }

    // Remove the column and update positions of remaining columns
    board.columns = board.columns
      .filter(col => col._id.toString() !== columnId)
      .map((col, index) => ({ ...col.toObject(), position: index }));

    const updatedBoard = await board.save();
    res.json(updatedBoard);
  } catch (err) {
    console.error('Error removing column:', err);
    res.status(400).json({ error: 'Failed to remove column' });
  }
});

module.exports = router;
