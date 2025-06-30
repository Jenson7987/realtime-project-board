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
        { sharedWith: { $in: [req.user._id] } }
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
      position,
      createdBy: req.user._id,
      modifiedBy: req.user._id
    };

    console.log('Adding card to board:', card);
    board.cards.push(card);
    
    console.log('Saving board...');
    await board.save();
    console.log('Board saved successfully');

    const createdCard = board.cards[board.cards.length - 1];
    console.log('Created card:', createdCard);

    // Populate the createdBy and modifiedBy fields for the response
    await board.populate('cards.createdBy', 'username firstName lastName');
    await board.populate('cards.modifiedBy', 'username firstName lastName');
    const populatedCard = board.cards[board.cards.length - 1];

    // Emit socket event for real-time updates
    console.log('Emitting cardCreated event to room:', boardId);
    const room = req.app.get('io').sockets.adapter.rooms.get(boardId.toString());
    console.log(`Number of clients in room ${boardId}:`, room ? room.size : 0);
    req.app.get('io').to(boardId.toString()).emit('cardCreated', {
      boardId: boardId.toString(),
      card: populatedCard
    });
    console.log('cardCreated event emitted successfully');

    res.json(populatedCard);
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
        { sharedWith: { $in: [req.user._id] } }
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
    card.modifiedBy = req.user._id;

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

    // Populate both createdBy and modifiedBy fields for the response
    await board.populate('cards.createdBy', 'username firstName lastName');
    await board.populate('cards.modifiedBy', 'username firstName lastName');
    const populatedCard = board.cards.id(cardId);

    console.log('Updated card with populated fields:', {
      _id: populatedCard._id,
      title: populatedCard.title,
      createdBy: populatedCard.createdBy,
      modifiedBy: populatedCard.modifiedBy
    });

    // Emit socket event for real-time updates
    console.log('Emitting cardUpdated event to room:', boardId);
    req.app.get('io').to(boardId.toString()).emit('cardUpdated', {
      boardId: boardId.toString(),
      card: populatedCard
    });
    console.log('cardUpdated event emitted successfully');

    res.json(populatedCard);
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
        { sharedWith: { $in: [req.user._id] } }
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
    console.log('Emitting cardDeleted event to room:', boardId);
    req.app.get('io').to(boardId.toString()).emit('cardDeleted', {
      boardId: boardId.toString(),
      cardId
    });
    console.log('cardDeleted event emitted successfully');

    res.json({ message: 'Card deleted' });
  } catch (error) {
    console.error('Error deleting card:', error);
    res.status(500).json({ error: 'Failed to delete card' });
  }
});

module.exports = router;
