import { config } from '../../config/env.js';
import { connectToDatabase, disconnectFromDatabase } from '../../config/database.js';

const COLLECTION_NAME = 'review_history';

class ReviewHistoryService {
  constructor({ mongoUri = config.mongo.uri, databaseName = config.mongo.database } = {}) {
    this.mongoUri = mongoUri;
    this.databaseName = databaseName;
  }

  isConfigured() {
    return Boolean(this.mongoUri);
  }

  async recordReviewHistory({
    prNumber,
    repository,
    riskScore,
    confidence,
    severity,
    summary,
    details = {},
  }) {
    const document = {
      prNumber,
      repository,
      riskScore,
      confidence,
      severity,
      summary,
      ...details,
      createdAt: new Date(),
    };

    if (!this.isConfigured()) {
      return {
        skipped: true,
        reason: 'MONGODB_URI is not configured',
        document,
      };
    }

    const collection = await this.getCollection();
    const query = details.headSha
      ? { repository, prNumber, headSha: details.headSha }
      : { repository, prNumber };
    const result = await collection.findOneAndUpdate(
      query,
      {
        $set: document,
        $setOnInsert: {
          firstSeenAt: new Date(),
        },
      },
      {
        upsert: true,
        returnDocument: 'after',
      }
    );

    return {
      skipped: false,
      id: result._id.toString(),
      document: result,
    };
  }

  async getCollection() {
    const connection = await connectToDatabase({
      mongoUri: this.mongoUri,
      databaseName: this.databaseName,
    });

    if (!connection?.db) {
      throw new Error('MongoDB connection is not available.');
    }

    return connection.db.collection(COLLECTION_NAME);
  }

  async listReviews({ query = {}, sort = { createdAt: -1 }, limit = 100 } = {}) {
    if (!this.isConfigured()) {
      return [];
    }

    const collection = await this.getCollection();
    return collection.find(query).sort(sort).limit(limit).toArray();
  }

  async close() {
    await disconnectFromDatabase();
  }
}

export const reviewHistoryService = new ReviewHistoryService();
export { COLLECTION_NAME as REVIEW_HISTORY_COLLECTION, ReviewHistoryService };
