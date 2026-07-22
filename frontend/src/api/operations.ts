import type { ReviewJob, ReviewSettings, WebhookDelivery } from '../types/dashboard';
import { apiGet } from './client';

export function getReviewJobs() {
  return apiGet<ReviewJob[]>('/review-jobs');
}

export function getWebhookDeliveries() {
  return apiGet<WebhookDelivery[]>('/webhook-deliveries');
}

export function getReviewSettings() {
  return apiGet<ReviewSettings>('/settings/review');
}
