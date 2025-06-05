const express = require('express');
const router = express.Router();
const Card = require('../models/Card');

// POST create card
router.post('/', async (req, res) => {
  const card = new Card(req.body);
  const saved = await card.save();
  res.json(saved);
});

// PUT update card
router.put('/:cardId', async (req, res) => {
  const updated = await Card.findByIdAndUpdate(req.params.cardId, req.body, { new: true });
  res.json(updated);
});

// DELETE card
router.delete('/:cardId', async (req, res) => {
  await Card.findByIdAndDelete(req.params.cardId);
  res.json({ message: 'Card deleted' });
});

module.exports = router;
