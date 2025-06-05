const mongoose = require('mongoose');

const ColumnSchema = new mongoose.Schema({
  name: String,
  position: Number,
});

const BoardSchema = new mongoose.Schema({
  title: String,
  columns: [ColumnSchema],
});

module.exports = mongoose.model('Board', BoardSchema);
