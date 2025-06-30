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
        { sharedWith: { $in: [req.user._id] } }
      ]
    })
    .populate('owner', 'username email firstName lastName')
    .populate('cards.createdBy', 'username firstName lastName')
    .populate('cards.modifiedBy', 'username firstName lastName')
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

// GET /api/boards/:boardId/collaborators - Get board collaborators
router.get('/:boardId/collaborators', auth, async (req, res) => {
  console.log('=== COLLABORATORS ROUTE CALLED ===');
  console.log('URL:', req.url);
  console.log('Method:', req.method);
  console.log('Params:', req.params);
  
  try {
    const { boardId } = req.params;

    // Get the board
    const board = await Board.findById(boardId);

    if (!board) {
      return res.status(404).json({ error: 'Board not found' });
    }

    // Check if user has access
    const hasAccess = board.owner.toString() === req.user._id.toString() || 
                     board.sharedWith.some(id => id.toString() === req.user._id.toString());
    
    if (!hasAccess) {
      return res.status(404).json({ error: 'Board not found or unauthorized' });
    }

    // Get owner information
    const owner = await User.findById(board.owner).select('username firstName lastName email');

    if (!owner) {
      console.error('Owner not found for board:', boardId);
      return res.status(500).json({ error: 'Owner information not found' });
    }

    // Get all shared users
    const sharedUsers = await User.find({ _id: { $in: board.sharedWith } }).select('username firstName lastName email');

    const response = {
      owner: {
        _id: owner._id,
        username: owner.username,
        firstName: owner.firstName,
        lastName: owner.lastName,
        email: owner.email
      },
      collaborators: sharedUsers.map(user => ({
        _id: user._id,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email
      }))
    };

    res.json(response);
  } catch (err) {
    console.error('Error fetching collaborators:', err);
    res.status(500).json({ error: 'Failed to fetch collaborators' });
  }
});

// GET /api/boards/:username/:slug - Get a board by username and slug
router.get('/:username/:slug', auth, async (req, res) => {
  console.log('=== USERNAME/SLUG ROUTE CALLED ===');
  console.log('URL:', req.url);
  console.log('Method:', req.method);
  console.log('Params:', req.params);
  
  try {
    const { username, slug } = req.params;
    console.log('Fetching board:', { username, slug, userId: req.user._id });

    const board = await Board.findOne({
      ownerUsername: username.toLowerCase(),
      slug: slug,
      $or: [
        { owner: req.user._id },
        { sharedWith: { $in: [req.user._id] } }
      ]
    })
    .populate('owner', 'username email firstName lastName')
    .populate('cards.createdBy', 'username firstName lastName')
    .populate('cards.modifiedBy', 'username firstName lastName');

    console.log('Board query result:', {
      found: !!board,
      boardId: board?._id,
      owner: board?.owner?._id,
      sharedWith: board?.sharedWith,
      userIsOwner: board?.owner?._id?.toString() === req.user._id?.toString(),
      userInSharedWith: board?.sharedWith?.some(id => id.toString() === req.user._id?.toString())
    });

    if (!board) {
      return res.status(404).json({ error: 'Board not found' });
    }

    // Handle backward compatibility for cards without createdBy/modifiedBy fields
    board.cards.forEach(card => {
      if (!card.createdBy) {
        card.createdBy = board.owner;
      }
      if (!card.modifiedBy) {
        card.modifiedBy = board.owner;
      }
    });

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
        { sharedWith: { $in: [req.user._id] } }
      ]
    })
    .populate('owner', 'username email firstName lastName')
    .populate('cards.createdBy', 'username firstName lastName')
    .populate('cards.modifiedBy', 'username firstName lastName');

    if (!board) {
      return res.status(404).json({ error: 'Board not found' });
    }

    res.json({ board });
  } catch (err) {
    console.error('Error fetching board by slug:', err);
    res.status(404).json({ error: 'Board not found' });
  }
});

// POST /api/boards/:boardId/share - Share board with a user
router.post('/:boardId/share', auth, async (req, res) => {
  try {
    const { boardId } = req.params;
    const { username, email } = req.body;

    console.log('Share board request:', { boardId, username, email, requesterId: req.user._id });

    if (!username && !email) {
      return res.status(400).json({ error: 'Username or email is required' });
    }

    // Find the board and ensure user is the owner
    const board = await Board.findOne({
      _id: boardId,
      owner: req.user._id
    });

    console.log('Board found:', {
      found: !!board,
      boardId: board?._id,
      owner: board?.owner,
      currentSharedWith: board?.sharedWith
    });

    if (!board) {
      return res.status(404).json({ error: 'Board not found or unauthorized' });
    }

    // Find the user to share with by username or email
    let userToShare;
    if (username) {
      userToShare = await User.findOne({ username: username.toLowerCase() });
    } else if (email) {
      userToShare = await User.findOne({ email: email.toLowerCase() });
    }

    console.log('User to share with found:', {
      found: !!userToShare,
      userId: userToShare?._id,
      username: userToShare?.username,
      email: userToShare?.email
    });

    if (!userToShare) {
      const searchTerm = username || email;
      return res.status(404).json({ error: `User not found with ${username ? 'username' : 'email'}: ${searchTerm}` });
    }

    // Check if user is trying to share with themselves
    if (userToShare._id.toString() === req.user._id.toString()) {
      return res.status(400).json({ error: 'Cannot share board with yourself' });
    }

    // Check if board is already shared with this user
    const alreadyShared = board.sharedWith.some(id => id.toString() === userToShare._id.toString());
    console.log('Already shared check:', {
      alreadyShared,
      userToShareId: userToShare._id.toString(),
      sharedWithIds: board.sharedWith.map(id => id.toString())
    });

    if (alreadyShared) {
      return res.status(400).json({ error: 'Board is already shared with this user' });
    }

    // Add user to sharedWith array
    board.sharedWith.push(userToShare._id);
    await board.save();

    // Verify the save worked by fetching the board again
    const savedBoard = await Board.findById(boardId);
    console.log('Board after save:', {
      boardId: savedBoard._id,
      sharedWith: savedBoard.sharedWith,
      sharedWithLength: savedBoard.sharedWith.length
    });

    // Emit socket event for real-time updates
    req.app.get('io').to(boardId).emit('boardShared', {
      boardId,
      sharedWith: userToShare._id,
      username: userToShare.username
    });

    res.json({ 
      success: true, 
      message: `Board shared with @${userToShare.username}`,
      sharedWith: {
        _id: userToShare._id,
        username: userToShare.username,
        firstName: userToShare.firstName,
        lastName: userToShare.lastName
      }
    });
  } catch (err) {
    console.error('Error sharing board:', err);
    res.status(500).json({ error: 'Failed to share board' });
  }
});

// DELETE /api/boards/:boardId/share/:userId - Remove collaborator from board
router.delete('/:boardId/share/:userId', auth, async (req, res) => {
  try {
    const { boardId, userId } = req.params;

    // Find the board and ensure user is the owner
    const board = await Board.findOne({
      _id: boardId,
      owner: req.user._id
    });

    if (!board) {
      return res.status(404).json({ error: 'Board not found or unauthorized' });
    }

    // Check if user is in sharedWith array
    if (!board.sharedWith.includes(userId)) {
      return res.status(400).json({ error: 'User is not a collaborator on this board' });
    }

    // Remove user from sharedWith array
    board.sharedWith = board.sharedWith.filter(id => id.toString() !== userId);
    await board.save();

    // Emit socket event for real-time updates
    req.app.get('io').to(boardId).emit('collaboratorRemoved', {
      boardId,
      removedUserId: userId
    });

    res.json({ 
      success: true, 
      message: 'Collaborator removed from board' 
    });
  } catch (err) {
    console.error('Error removing collaborator:', err);
    res.status(500).json({ error: 'Failed to remove collaborator' });
  }
});

// GET /api/boards/:boardId - Get one board and its cards (legacy route)
router.get('/:boardId', auth, async (req, res) => {
  try {
    const board = await Board.findOne({
      _id: req.params.boardId,
      $or: [
        { owner: req.user._id },
        { sharedWith: { $in: [req.user._id] } }
      ]
    }).populate('owner', 'username email firstName lastName');

    if (!board) {
      return res.status(404).json({ error: 'Board not found' });
    }

    // Handle backward compatibility for cards without createdBy/modifiedBy fields
    board.cards.forEach(card => {
      if (!card.createdBy) {
        card.createdBy = board.owner;
      }
      if (!card.modifiedBy) {
        card.modifiedBy = board.owner;
      }
    });

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
        position: 0,
        createdBy: req.user._id,
        modifiedBy: req.user._id
      },
      {
        _id: new mongoose.Types.ObjectId(),
        columnId: 'todo',
        title: 'Create your own cards',
        description: 'Click the "+" button in any column to add new cards.',
        position: 1,
        createdBy: req.user._id,
        modifiedBy: req.user._id
      },
      {
        _id: new mongoose.Types.ObjectId(),
        columnId: 'in-progress',
        title: 'Drag and drop cards',
        description: 'Try dragging this card to another column to see it in action!',
        position: 0,
        createdBy: req.user._id,
        modifiedBy: req.user._id
      },
      {
        _id: new mongoose.Types.ObjectId(),
        columnId: 'done',
        title: 'Collaborate with others',
        description: 'Share your boards with team members for real-time collaboration.',
        position: 0,
        createdBy: req.user._id,
        modifiedBy: req.user._id
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

    console.log('Board object before save:', JSON.stringify(board, null, 2));

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
      $or: [
        { owner: req.user._id },
        { sharedWith: { $in: [req.user._id] } }
      ]
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
      $or: [
        { owner: req.user._id },
        { sharedWith: { $in: [req.user._id] } }
      ]
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
      $or: [
        { owner: req.user._id },
        { sharedWith: { $in: [req.user._id] } }
      ]
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

// PUT /api/boards/:boardId/columns/:columnId - Update column title
router.put('/:boardId/columns/:columnId', auth, async (req, res) => {
  try {
    const { boardId, columnId } = req.params;
    const { title } = req.body;

    const board = await Board.findOne({
      _id: boardId,
      $or: [
        { owner: req.user._id },
        { sharedWith: { $in: [req.user._id] } }
      ]
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
        { sharedWith: { $in: [req.user._id] } }
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
          position: 0,
          createdBy: req.user._id,
          modifiedBy: req.user._id
        },
        {
          _id: new mongoose.Types.ObjectId(),
          columnId: todoColumnId.toString(),
          title: 'Create your own cards',
          description: 'Click the "+" button in any column to add new cards.',
          position: 1,
          createdBy: req.user._id,
          modifiedBy: req.user._id
        },
        {
          _id: new mongoose.Types.ObjectId(),
          columnId: inProgressColumnId.toString(),
          title: 'Drag and drop cards',
          description: 'Try dragging this card to another column to see it in action!',
          position: 0,
          createdBy: req.user._id,
          modifiedBy: req.user._id
        },
        {
          _id: new mongoose.Types.ObjectId(),
          columnId: doneColumnId.toString(),
          title: 'Collaborate with others',
          description: 'Share your boards with team members for real-time collaboration.',
          position: 0,
          createdBy: req.user._id,
          modifiedBy: req.user._id
        }
      ];
      
      console.log('Sample cards created with user info:', cards.map(card => ({
        title: card.title,
        createdBy: card.createdBy,
        modifiedBy: card.modifiedBy
      })));
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

    console.log('Board object before save:', JSON.stringify(board, null, 2));

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

module.exports = router;
