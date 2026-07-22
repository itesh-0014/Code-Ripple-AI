import { connectToDatabase, disconnectFromDatabase } from '../config/database.js';

async function clearDatabase() {
  console.log('Connecting to database to clear data...');
  try {
    const connection = await connectToDatabase();
    if (!connection?.db) {
      throw new Error('Database connection is not available');
    }

    const db = connection.db;

    // Collections to clear
    const collections = ['users', 'review_history', 'webhook_deliveries'];

    for (const colName of collections) {
      const col = db.collection(colName);
      try {
        const count = await col.countDocuments();
        console.log(`Clearing ${count} documents from collection '${colName}'...`);
        await col.deleteMany({});
        console.log(` - Cleared '${colName}' successfully.`);
      } catch (colError) {
        console.warn(`Could not clear collection '${colName}':`, colError.message);
      }
    }

    console.log('\nDatabase cleared successfully!');
  } catch (error) {
    console.error('Error clearing database:', error);
    process.exitCode = 1;
  } finally {
    try {
      await disconnectFromDatabase();
      console.log('Disconnected from database.');
    } catch (dbError) {
      console.error('Error disconnecting from database:', dbError);
    }
  }
}

clearDatabase();
