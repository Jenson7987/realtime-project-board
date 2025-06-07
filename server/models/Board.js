const mongoose = require('mongoose');

const CardSchema = new mongoose.Schema({
  _id: { type: mongoose.Schema.Types.ObjectId, auto: true },
  columnId: { type: String, required: true },
  title: { type: String, required: true },
  description: String,
  position: { type: Number, required: true }
}, { timestamps: true });

const ColumnSchema = new mongoose.Schema({
  _id: { type: mongoose.Schema.Types.ObjectId, auto: true },
  title: { type: String, required: true },
  position: { type: Number, required: true }
});

const BoardSchema = new mongoose.Schema({
  title: { type: String, required: true },
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  sharedWith: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  columns: [ColumnSchema],
  cards: [CardSchema]
}, { timestamps: true });

module.exports = mongoose.model('Board', BoardSchema);
