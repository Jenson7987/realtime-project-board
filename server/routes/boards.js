const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Board = require('../models/Board');
const User = require('../models/User');
const auth = require('../middleware/auth');

// GET /api/boards - Get all boards for the authenticated user
router.get('/', auth, async (req, res) => {
  try {
    console.log('Fetching boards for user:', req.user._id);
    
    // Get user's starred boards
    const user = await User.findById(req.user._id).populate('starredBoards');
    const starredBoardIds = user.starredBoards.map(board => board._id.toString());
    
    const boards = await Board.find({
      $or: [
        { owner: req.user._id },
        { sharedWith: req.user._id }
      ]
    })
    .populate('owner', 'username email firstName lastName')
    .sort({ updatedAt: -1 }); // Sort by last modified, newest first

    // Add starred status to each board
    const boardsWithStarredStatus = boards.map(board => ({
      ...board.toObject(),
      isStarred: starredBoardIds.includes(board._id.toString())
    }));

    console.log('Found boards:', JSON.stringify(boardsWithStarredStatus, null, 2));
    res.json({ boards: boardsWithStarredStatus });
  } catch (err) {
    console.error('Error fetching boards:', err);
    res.status(500).json({ error: 'Failed to fetch boards' });
  }
});

// POST /api/boards - Create a new board
router.post('/', auth, async (req, res) => {
  try {
    const { title, columns, sampleCards } = req.body;
    console.log('Creating board with data:', { title, columns, sampleCards, owner: req.user._id });

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

    // Generate slug from title
    const generateSlug = (title) => {
      return title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
    };

    const baseSlug = generateSlug(title);
    let slug = baseSlug;
    let counter = 1;
    
    // Check if slug already exists and make it unique
    while (await Board.findOne({ ownerUsername: req.user.username, slug })) {
      slug = `${baseSlug}-${counter}`;
      counter++;
    }

    // Create sample cards if requested
    let cards = [];
    if (sampleCards) {
      const todoColumnId = new mongoose.Types.ObjectId();
      const inProgressColumnId = new mongoose.Types.ObjectId();
      const doneColumnId = new mongoose.Types.ObjectId();

      // Update column IDs to use the actual IDs
      if (safeColumns && safeColumns.length >= 3) {
        safeColumns[0]._id = todoColumnId;
        safeColumns[1]._id = inProgressColumnId;
        safeColumns[2]._id = doneColumnId;
      }

      cards = [
        {
          _id: new mongoose.Types.ObjectId(),
          columnId: todoColumnId.toString(),
          title: 'Welcome to your sample board! 🎉',
          description: 'This is your first card. Click on it to edit or drag it between columns.',
          position: 0
        },
        {
          _id: new mongoose.Types.ObjectId(),
          columnId: todoColumnId.toString(),
          title: 'Create your own cards',
          description: 'Click the "+" button in any column to add new cards.',
          position: 1
        },
        {
          _id: new mongoose.Types.ObjectId(),
          columnId: inProgressColumnId.toString(),
          title: 'Drag and drop cards',
          description: 'Try dragging this card to another column to see it in action!',
          position: 0
        },
        {
          _id: new mongoose.Types.ObjectId(),
          columnId: doneColumnId.toString(),
          title: 'Collaborate with others',
          description: 'Share your boards with team members for real-time collaboration.',
          position: 0
        }
      ];
    }

    const board = new Board({
      title,
      slug,
      owner: req.user._id,
      ownerUsername: req.user.username,
      columns: safeColumns || [
        { _id: new mongoose.Types.ObjectId(), title: 'To Do', position: 0 },
        { _id: new mongoose.Types.ObjectId(), title: 'In Progress', position: 1 },
        { _id: new mongoose.Types.ObjectId(), title: 'Done', position: 2 },
      ],
      cards: cards,
    });

    const saved = await board.save();
    console.log('Created board:', saved);
    res.json({ board: saved });
  } catch (err) {
    console.error('Error creating board:', err);
    if (err.code === 11000) {
      return res.status(400).json({ error: 'A board with this name already exists' });
    }
    res.status(400).json({ error: 'Failed to create board' });
  }
});

// GET /api/boards/:username/:slug - Get a board by username and slug
router.get('/:username/:slug', auth, async (req, res) => {
  try {
    const { username, slug } = req.params;
    console.log('Fetching board:', { username, slug });

    const board = await Board.findOne({
      ownerUsername: username.toLowerCase(),
      slug: slug,
      $or: [
        { owner: req.user._id },
        { sharedWith: req.user._id }
      ]
    }).populate('owner', 'username email firstName lastName');

    if (!board) {
      return res.status(404).json({ error: 'Board not found' });
    }

    res.json({ board });
  } catch (err) {
    console.error('Error fetching board by username/slug:', err);
    res.status(404).json({ error: 'Board not found' });
  }
});

// GET /api/boards/slug/:slug - Get a board by its slug (legacy route)
router.get('/slug/:slug', auth, async (req, res) => {
  try {
    const board = await Board.findOne({
      slug: req.params.slug,
      $or: [
        { owner: req.user._id },
        { sharedWith: req.user._id }
      ]
    }).populate('owner', 'username email firstName lastName');

    if (!board) {
      return res.status(404).json({ error: 'Board not found' });
    }

    res.json({ board });
  } catch (err) {
    console.error('Error fetching board by slug:', err);
    res.status(404).json({ error: 'Board not found' });
  }
});

// GET /api/boards/:boardId - Get one board and its cards (legacy route)
router.get('/:boardId', auth, async (req, res) => {
  try {
    const board = await Board.findOne({
      _id: req.params.boardId,
      $or: [
        { owner: req.user._id },
        { sharedWith: req.user._id }
      ]
    }).populate('owner', 'username email firstName lastName');

    if (!board) {
      return res.status(404).json({ error: 'Board not found' });
    }

    res.json({ board });
  } catch (err) {
    console.error('Error fetching board:', err);
    res.status(404).json({ error: 'Board not found' });
  }
});

// POST /api/boards/create-default - Create default board for new user
router.post('/create-default', auth, async (req, res) => {
  try {
    console.log('Creating default board for user:', req.user._id);

    // Check if user already has a "my-first-board"
    const existingBoard = await Board.findOne({
      owner: req.user._id,
      slug: 'my-first-board'
    });

    if (existingBoard) {
      return res.json({ board: existingBoard });
    }

    // Sample cards for the default board
    const sampleCards = [
      {
        _id: new mongoose.Types.ObjectId(),
        columnId: 'todo',
        title: 'Welcome to your first board! 🎉',
        description: 'This is your first card. Click on it to edit or drag it between columns.',
        position: 0
      },
      {
        _id: new mongoose.Types.ObjectId(),
        columnId: 'todo',
        title: 'Create your own cards',
        description: 'Click the "+" button in any column to add new cards.',
        position: 1
      },
      {
        _id: new mongoose.Types.ObjectId(),
        columnId: 'in-progress',
        title: 'Drag and drop cards',
        description: 'Try dragging this card to another column to see it in action!',
        position: 0
      },
      {
        _id: new mongoose.Types.ObjectId(),
        columnId: 'done',
        title: 'Collaborate with others',
        description: 'Share your boards with team members for real-time collaboration.',
        position: 0
      }
    ];

    const todoColumnId = new mongoose.Types.ObjectId();
    const inProgressColumnId = new mongoose.Types.ObjectId();
    const doneColumnId = new mongoose.Types.ObjectId();

    // Update card columnIds to use the actual column IDs
    sampleCards[0].columnId = todoColumnId.toString();
    sampleCards[1].columnId = todoColumnId.toString();
    sampleCards[2].columnId = inProgressColumnId.toString();
    sampleCards[3].columnId = doneColumnId.toString();

    const board = new Board({
      title: 'My First Board',
      slug: 'my-first-board',
      owner: req.user._id,
      ownerUsername: req.user.username,
      columns: [
        { _id: todoColumnId, title: 'To Do', position: 0 },
        { _id: inProgressColumnId, title: 'In Progress', position: 1 },
        { _id: doneColumnId, title: 'Done', position: 2 },
      ],
      cards: sampleCards,
    });

    const saved = await board.save();
    console.log('Created default board:', saved);
    res.json({ board: saved });
  } catch (err) {
    console.error('Error creating default board:', err);
    res.status(400).json({ error: 'Failed to create default board' });
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
      return res.status(404).json({ error: 'Board not found' });
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

// PUT /api/boards/:boardId/columns/:columnId - Update column title
router.put('/:boardId/columns/:columnId', auth, async (req, res) => {
  try {
    const { boardId, columnId } = req.params;
    const { title } = req.body;

    const board = await Board.findOne({
      _id: boardId,
      owner: req.user._id
    });

    if (!board) {
      return res.status(404).json({ error: 'Board not found or unauthorized' });
    }

    // Find and update the specific column
    const columnIndex = board.columns.findIndex(col => col._id.toString() === columnId);
    if (columnIndex === -1) {
      return res.status(404).json({ error: 'Column not found' });
    }

    board.columns[columnIndex].title = title;
    const updatedBoard = await board.save();

    // Emit socket event for real-time updates
    req.app.get('io').to(boardId).emit('columnUpdated', {
      boardId,
      columnId,
      title
    });

    res.json({ column: board.columns[columnIndex], board: updatedBoard });
  } catch (err) {
    console.error('Error updating column:', err);
    res.status(400).json({ error: 'Failed to update column' });
  }
});

// POST /api/boards/:boardId/star - Star a board
router.post('/:boardId/star', auth, async (req, res) => {
  try {
    const { boardId } = req.params;
    
    // Check if board exists and user has access
    const board = await Board.findOne({
      _id: boardId,
      $or: [
        { owner: req.user._id },
        { sharedWith: req.user._id }
      ]
    });

    if (!board) {
      return res.status(404).json({ error: 'Board not found or unauthorized' });
    }

    // Add board to user's starred boards
    await User.findByIdAndUpdate(
      req.user._id,
      { $addToSet: { starredBoards: boardId } }
    );

    res.json({ success: true, message: 'Board starred' });
  } catch (err) {
    console.error('Error starring board:', err);
    res.status(400).json({ error: 'Failed to star board' });
  }
});

// DELETE /api/boards/:boardId/star - Unstar a board
router.delete('/:boardId/star', auth, async (req, res) => {
  try {
    const { boardId } = req.params;
    
    // Remove board from user's starred boards
    await User.findByIdAndUpdate(
      req.user._id,
      { $pull: { starredBoards: boardId } }
    );

    res.json({ success: true, message: 'Board unstarred' });
  } catch (err) {
    console.error('Error unstarring board:', err);
    res.status(400).json({ error: 'Failed to unstar board' });
  }
});

module.exports = router;
