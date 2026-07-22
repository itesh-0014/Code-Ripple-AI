import type { PaginatedReviews, ReviewDetail, ReviewJob } from '../types/dashboard';
import { apiGet, apiPost } from './client';

export interface ReviewFilters {
  search?: string;
  severity?: string;
  repository?: string;
  from?: string;
  to?: string;
  page?: number;
}

export function getReviews(filters: ReviewFilters = {}) {
  const query = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== '') query.set(key, String(value));
  });
  return apiGet<PaginatedReviews>(`/reviews?${query}`);
}

export function getReview(id: string) {
  return apiGet<ReviewDetail>(`/reviews/${id}`);
}

export function reanalyzeReview(id: string) {
  return apiPost<ReviewJob>(`/reviews/${id}/reanalyze`);
}
