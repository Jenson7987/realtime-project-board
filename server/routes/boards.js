const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Board = require('../models/Board');
const auth = require('../middleware/auth');

// GET /api/boards - Get all boards for the authenticated user
router.get('/', auth, async (req, res) => {
  try {
    console.log('Fetching boards for user:', req.user._id);
    const boards = await Board.find({
      $or: [
        { owner: req.user._id },
        { sharedWith: req.user._id }
      ]
    }).populate('owner', 'email firstName lastName');

    console.log('Found boards:', JSON.stringify(boards, null, 2));
    res.json({ boards });
  } catch (err) {
    console.error('Error fetching boards:', err);
    res.status(500).json({ error: 'Failed to fetch boards' });
  }
});

// POST /api/boards - Create a new board
router.post('/', auth, async (req, res) => {
  try {
    const { title, columns } = req.body;
    console.log('Creating board with data:', { title, columns, owner: req.user._id });

    // Convert columns with 'name' to 'title' for backward compatibility
    let safeColumns = columns;
    if (Array.isArray(columns)) {
      safeColumns = columns.map(col => {
        if (col && col.name && !col.title) {
          return { ...col, title: col.name, name: undefined };
        }
        return col;
      });
    }

    const board = new Board({
      title,
      owner: req.user._id,
      columns: safeColumns || [
        { _id: new mongoose.Types.ObjectId(), title: 'To Do', position: 0 },
        { _id: new mongoose.Types.ObjectId(), title: 'In Progress', position: 1 },
        { _id: new mongoose.Types.ObjectId(), title: 'Done', position: 2 },
      ],
      cards: [],
    });

    const saved = await board.save();
    console.log('Created board:', saved);
    res.json({ board: saved });
  } catch (err) {
    console.error('Error creating board:', err);
    res.status(400).json({ error: 'Failed to create board' });
  }
});

// GET /api/boards/:boardId - Get one board and its cards
router.get('/:boardId', auth, async (req, res) => {
  try {
    const board = await Board.findOne({
      _id: req.params.boardId,
      $or: [
        { owner: req.user._id },
        { sharedWith: req.user._id }
      ]
    }).populate('owner', 'email firstName lastName');

    if (!board) {
      return res.status(404).json({ error: 'Board not found' });
    }

    res.json({ board });
  } catch (err) {
    console.error('Error fetching board:', err);
    res.status(404).json({ error: 'Board not found' });
  }
});

// PUT /api/boards/:boardId - Update board title or columns
router.put('/:boardId', auth, async (req, res) => {
  try {
    const board = await Board.findOne({
      _id: req.params.boardId,
      owner: req.user._id
    });

    if (!board) {
      return res.status(404).json({ error: 'Board not found or unauthorized' });
    }

    const updated = await Board.findByIdAndUpdate(
      req.params.boardId,
      req.body,
      { new: true }
    );
    res.json({ board: updated });
  } catch (err) {
    console.error('Error updating board:', err);
    res.status(400).json({ error: 'Failed to update board' });
  }
});

// DELETE /api/boards/:boardId - Delete board and all its cards
router.delete('/:boardId', auth, async (req, res) => {
  try {
    const board = await Board.findOne({
      _id: req.params.boardId,
      owner: req.user._id
    });

    if (!board) {
      return res.status(404).json({ error: 'Board not found or unauthorized' });
    }

    await Board.findByIdAndDelete(req.params.boardId);
    res.json({ message: 'Board deleted' });
  } catch (err) {
    console.error('Error deleting board:', err);
    res.status(500).json({ error: 'Failed to delete board' });
  }
});

// POST /api/boards/:boardId/columns - Add a new column to a board
router.post('/:boardId/columns', auth, async (req, res) => {
  try {
    const { boardId } = req.params;
    const { title } = req.body;

    const board = await Board.findOne({
      _id: boardId,
      owner: req.user._id
    });

    if (!board) {
      return res.status(404).json({ error: 'Board not found or unauthorized' });
    }

    const newColumn = {
      _id: new mongoose.Types.ObjectId(),
      title,
      position: board.columns.length
    };

    board.columns.push(newColumn);
    const updatedBoard = await board.save();

    // Emit socket event for real-time updates
    req.app.get('io').to(boardId).emit('columnCreated', {
      boardId,
      column: newColumn
    });

    res.json({ column: newColumn, board: updatedBoard });
  } catch (err) {
    console.error('Error adding column:', err);
    res.status(400).json({ error: 'Failed to add column' });
  }
});

// DELETE /api/boards/:boardId/columns/:columnId - Remove a column from a board
router.delete('/:boardId/columns/:columnId', auth, async (req, res) => {
  try {
    const { boardId, columnId } = req.params;

    const board = await Board.findOne({
      _id: boardId,
      owner: req.user._id
    });

    if (!board) {
      return res.status(404).json({ error: 'Board not found or unauthorized' });
    }

    const hasCards = board.cards.some(card => card.columnId.toString() === columnId);
    if (hasCards) {
      return res.status(400).json({ error: 'Column is not empty' });
    }
    
    // Remove the column
    board.columns = board.columns.filter(col => col._id.toString() !== columnId);
    
    // Also remove any cards in this column
    board.cards = board.cards.filter(card => card.columnId.toString() !== columnId);
    
    const updatedBoard = await board.save();

    // Emit socket event for real-time updates
    req.app.get('io').to(boardId).emit('columnDeleted', {
      boardId,
      columnId
    });
    
    res.json({ board: updatedBoard });
  } catch (err) {
    console.error('Error removing column:', err);
    res.status(400).json({ error: 'Failed to remove column' });
  }
});

module.exports = router;
