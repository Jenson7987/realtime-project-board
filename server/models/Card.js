const mongoose = require('mongoose');

const CardSchema = new mongoose.Schema({
  boardId: { type: mongoose.Schema.Types.ObjectId, ref: 'Board' },
  column: String,
  title: String,
  description: String,
  position: Number,
});

module.exports = mongoose.model('Card', CardSchema);
