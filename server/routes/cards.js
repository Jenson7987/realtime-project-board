const express = require('express');
const router = express.Router();
const Board = require('../models/Board');
const auth = require('../middleware/auth');

// POST create card
router.post('/', auth, async (req, res) => {
  try {
    const { boardId, columnId, title, description, position } = req.body;
    console.log('Creating card with data:', { boardId, columnId, title, description, position });
    
    const board = await Board.findOne({
      _id: boardId,
      $or: [
        { owner: req.user._id },
        { sharedWith: req.user._id }
      ]
    });

    if (!board) {
      console.log('Board not found:', boardId);
      return res.status(404).json({ error: 'Board not found' });
    }

    console.log('Found board:', board._id);

    const card = {
      columnId,
      title,
      description,
      position
    };

    console.log('Adding card to board:', card);
    board.cards.push(card);
    
    console.log('Saving board...');
    await board.save();
    console.log('Board saved successfully');

    const createdCard = board.cards[board.cards.length - 1];
    console.log('Created card:', createdCard);

    // Emit socket event for real-time updates
    console.log('Emitting cardCreated event');
    req.app.get('io').to(boardId).emit('cardCreated', {
      boardId,
      card: createdCard
    });

    res.json(createdCard);
  } catch (error) {
    console.error('Error creating card:', error);
    res.status(500).json({ error: 'Failed to create card', details: error.message });
  }
});

// PUT update card
router.put('/:boardId/:cardId', auth, async (req, res) => {
  try {
    const { boardId, cardId } = req.params;
    const { title, description, position, columnId } = req.body;

    const board = await Board.findOne({
      _id: boardId,
      $or: [
        { owner: req.user._id },
        { sharedWith: req.user._id }
      ]
    });

    if (!board) {
      return res.status(404).json({ error: 'Board not found' });
    }

    const card = board.cards.id(cardId);
    if (!card) {
      return res.status(404).json({ error: 'Card not found' });
    }

    const oldColumnId = card.columnId.toString();
    const oldPosition = card.position;

    if (title) card.title = title;
    if (description !== undefined) card.description = description;

    let newColumnId = oldColumnId;
    let newPosition = oldPosition;
    if (columnId) newColumnId = columnId;
    if (position !== undefined) newPosition = position;

    // Adjust positions of cards when column or index changes
    if (newColumnId !== oldColumnId || newPosition !== oldPosition) {
      // Remove gap in old column
      board.cards.forEach(c => {
        if (c.columnId.toString() === oldColumnId && c.position > oldPosition) {
          c.position -= 1;
        }
      });

      // Create space in new column
      board.cards.forEach(c => {
        if (
          c.columnId.toString() === newColumnId &&
          c._id.toString() !== cardId &&
          c.position >= newPosition
        ) {
          c.position += 1;
        }
      });

      card.columnId = newColumnId;
      card.position = newPosition;
    }

    await board.save();

    // Emit socket event for real-time updates
    req.app.get('io').to(boardId).emit('cardUpdated', {
      boardId,
      card
    });

    res.json(card);
  } catch (error) {
    console.error('Error updating card:', error);
    res.status(500).json({ error: 'Failed to update card' });
  }
});

// DELETE card
router.delete('/:boardId/:cardId', auth, async (req, res) => {
  try {
    const { boardId, cardId } = req.params;

    const board = await Board.findOne({
      _id: boardId,
      $or: [
        { owner: req.user._id },
        { sharedWith: req.user._id }
      ]
    });

    if (!board) {
      return res.status(404).json({ error: 'Board not found' });
    }

    const card = board.cards.id(cardId);
    if (!card) {
      return res.status(404).json({ error: 'Card not found' });
    }

    await card.deleteOne();
    await board.save();

    // Emit socket event for real-time updates
    req.app.get('io').to(boardId).emit('cardDeleted', {
      boardId,
      cardId
    });

    res.json({ message: 'Card deleted' });
  } catch (error) {
    console.error('Error deleting card:', error);
    res.status(500).json({ error: 'Failed to delete card' });
  }
});

module.exports = router;
