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
  slug: { type: String, required: true },
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  ownerUsername: { type: String, required: true },
  sharedWith: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  columns: [ColumnSchema],
  cards: [CardSchema]
}, { timestamps: true });

// Create a compound index to ensure slug is unique per user
BoardSchema.index({ ownerUsername: 1, slug: 1 }, { unique: true });

// Pre-save middleware to generate slug from title
BoardSchema.pre('save', function(next) {
  // Always generate slug if title exists and slug is not set
  if (this.title && (!this.slug || this.slug === '')) {
    this.slug = this.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  }
  next();
});

// Pre-validate middleware to ensure slug is set
BoardSchema.pre('validate', function(next) {
  if (this.title && (!this.slug || this.slug === '')) {
    this.slug = this.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  }
  next();
});

module.exports = mongoose.model('Board', BoardSchema);
