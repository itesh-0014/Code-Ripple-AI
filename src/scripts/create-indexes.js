import { connectToDatabase, disconnectFromDatabase } from '../config/database.js';
import { REVIEW_HISTORY_COLLECTION } from '../services/history/reviewHistoryService.js';

const USERS_COLLECTION = 'users';

async function createIndexes() {
  console.log('Starting database index creation...');
  try {
    const connection = await connectToDatabase();
    if (!connection?.db) {
      throw new Error('Database connection is not available');
    }

    const db = connection.db;

    // Indexes for review history
    console.log(`Creating indexes on '${REVIEW_HISTORY_COLLECTION}' collection...`);
    const historyCol = db.collection(REVIEW_HISTORY_COLLECTION);
    
    await historyCol.createIndex(
      { repository: 1, prNumber: -1 },
      { name: 'idx_repository_prNumber' }
    );
    console.log(' - Created index: { repository: 1, prNumber: -1 }');

    await historyCol.createIndex(
      { createdAt: -1 },
      { name: 'idx_createdAt' }
    );
    console.log(' - Created index: { createdAt: -1 }');

    // Indexes for users
    console.log(`Creating indexes on '${USERS_COLLECTION}' collection...`);
    const usersCol = db.collection(USERS_COLLECTION);

    await usersCol.createIndex(
      { provider: 1, githubId: 1 },
      { name: 'idx_provider_githubId', unique: true }
    );
    console.log(' - Created unique index: { provider: 1, githubId: 1 }');

    await usersCol.createIndex(
      { login: 1 },
      { name: 'idx_login' }
    );
    console.log(' - Created index: { login: 1 }');

    console.log('All indexes created successfully!');
  } catch (error) {
    console.error('Error creating database indexes:', error);
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

createIndexes();
