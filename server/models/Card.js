const mongoose = require('mongoose');

const CardSchema = new mongoose.Schema({
  boardId: { type: mongoose.Schema.Types.ObjectId, ref: 'Board', required: true },
  columnId: { type: mongoose.Schema.Types.ObjectId, required: true },
  title: { type: String, required: true },
  description: String,
  position: { type: Number, required: true },
}, { timestamps: true });

module.exports = mongoose.model('Card', CardSchema);
