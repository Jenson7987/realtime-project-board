const mongoose = require('mongoose');
const Board = require('../server/models/Board');

// Use your existing MongoDB connection string or .env
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/YOUR_DB_NAME'; // <-- update if needed

mongoose.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });

async function migrate() {
  const boards = await Board.find({});
  for (const board of boards) {
    let changed = false;
    for (const col of board.columns) {
      if (col.name && !col.title) {
        col.title = col.name;
        changed = true;
      }
      if (col.name) {
        delete col.name;
        changed = true;
      }
    }
    if (changed) {
      await board.save();
      console.log(`Migrated board: ${board._id}`);
    }
  }
  mongoose.disconnect();
}

migrate(); 