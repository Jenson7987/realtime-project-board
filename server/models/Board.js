const mongoose = require('mongoose');

const ColumnSchema = new mongoose.Schema({
  _id: { type: mongoose.Schema.Types.ObjectId, required: true, auto: true },
  name: { type: String, required: true },
  position: { type: Number, required: true },
});

const BoardSchema = new mongoose.Schema({
  title: String,
  columns: [ColumnSchema],
});

module.exports = mongoose.model('Board', BoardSchema);
