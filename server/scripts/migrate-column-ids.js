require('dotenv').config();
const mongoose = require('mongoose');
const Board = require('../models/Board');
const Card = require('../models/Card');

async function migrateColumnIds() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    // Get all boards
    const boards = await Board.find();
    console.log(`Found ${boards.length} boards to migrate`);

    for (const board of boards) {
      console.log(`\nMigrating board: ${board.title}`);

      // Add _id to columns if they don't have one
      const updatedColumns = board.columns.map(column => ({
        ...column.toObject(),
        _id: column._id || new mongoose.Types.ObjectId()
      }));

      // Update board with new column IDs
      await Board.findByIdAndUpdate(board._id, { columns: updatedColumns });
      console.log(`Updated columns for board ${board.title}`);

      // Get all cards for this board
      const cards = await Card.find({ boardId: board._id });
      console.log(`Found ${cards.length} cards to migrate`);

      // Create a mapping of column names to IDs
      const columnNameToId = {};
      updatedColumns.forEach(col => {
        columnNameToId[col.name] = col._id;
      });

      // Update each card to use columnId instead of column name
      for (const card of cards) {
        let columnId;
        
        if (!card.column) {
          // If column is undefined, assign to first column
          columnId = updatedColumns[0]._id;
          console.log(`Assigning card ${card._id} to first column (${updatedColumns[0].name})`);
        } else {
          columnId = columnNameToId[card.column];
          if (!columnId) {
            console.warn(`Warning: No column ID found for card ${card._id} with column name "${card.column}"`);
            continue;
          }
        }

        await Card.findByIdAndUpdate(card._id, {
          columnId,
          $unset: { column: 1 } // Remove the old column field
        });
      }
      console.log(`Updated cards for board ${board.title}`);
    }

    console.log('\nMigration completed successfully!');
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

// Run the migration
migrateColumnIds(); 