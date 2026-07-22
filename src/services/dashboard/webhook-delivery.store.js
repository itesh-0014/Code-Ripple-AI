import { config } from '../../config/env.js';
import { connectToDatabase } from '../../config/database.js';

const COLLECTION_NAME = 'webhook_deliveries';
const MAX_MEMORY_DELIVERIES = 100;
const memoryDeliveries = [];

export async function recordWebhookDelivery(delivery) {
  const document = {
    deliveryId: delivery.deliveryId || null,
    event: delivery.event || 'unknown',
    action: delivery.action || null,
    repository: delivery.repository || null,
    status: delivery.status || 'received',
    message: delivery.message || null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  memoryDeliveries.unshift(document);
  memoryDeliveries.splice(MAX_MEMORY_DELIVERIES);

  if (!config.mongo.uri) return document;

  const connection = await connectToDatabase();
  const result = await connection.db.collection(COLLECTION_NAME).findOneAndUpdate(
    { deliveryId: document.deliveryId || `${document.event}:${document.createdAt.getTime()}` },
    { $set: document },
    { upsert: true, returnDocument: 'after' }
  );

  return result;
}

export async function listWebhookDeliveries({ limit = 50 } = {}) {
  if (!config.mongo.uri) {
    return memoryDeliveries.slice(0, limit);
  }

  const connection = await connectToDatabase();
  return connection.db
    .collection(COLLECTION_NAME)
    .find({})
    .sort({ createdAt: -1 })
    .limit(limit)
    .toArray();
}

export { COLLECTION_NAME as WEBHOOK_DELIVERY_COLLECTION };
