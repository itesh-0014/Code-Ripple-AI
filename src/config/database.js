import mongoose from 'mongoose';

import { config } from './env.js';

const READY_STATE_LABELS = {
  0: 'disconnected',
  1: 'connected',
  2: 'connecting',
  3: 'disconnecting',
};

let connectionPromise = null;

export async function connectToDatabase({
  mongoUri = config.mongo.uri,
  databaseName = config.mongo.database,
} = {}) {
  if (!mongoUri) {
    const error = new Error(
      'MONGODB_URI is required. Configure MongoDB Atlas before starting GitSense AI.'
    );
    error.code = 'MONGODB_URI_MISSING';
    throw error;
  }

  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  if (!connectionPromise) {
    mongoose.set('strictQuery', true);

    connectionPromise = mongoose
      .connect(mongoUri, {
        dbName: databaseName,
        serverSelectionTimeoutMS: 10000,
        maxPoolSize: 10,
      })
      .then(connection => {
        const host = connection.connection.host || 'MongoDB Atlas';
        console.log(`MongoDB connected successfully: ${databaseName} (${host})`);
        return connection.connection;
      })
      .catch(error => {
        connectionPromise = null;
        console.error('MongoDB connection failed.');
        console.error(`Database: ${databaseName}`);
        console.error(`Error: ${error.message}`);
        throw error;
      });
  }

  return connectionPromise;
}

export function getDatabaseStatus() {
  const { readyState, name, host } = mongoose.connection;

  return {
    connected: readyState === 1,
    state: READY_STATE_LABELS[readyState] || 'unknown',
    database: name || config.mongo.database,
    host: host || null,
  };
}

export async function disconnectFromDatabase() {
  if (mongoose.connection.readyState === 0) {
    connectionPromise = null;
    return;
  }

  await mongoose.disconnect();
  connectionPromise = null;
}
