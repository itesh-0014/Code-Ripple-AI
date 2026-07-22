import type {
  Analytics,
  ArchitectureInsights,
  DependencyResponse,
} from '../types/dashboard';
import { apiGet } from './client';

export function getAnalytics() {
  return apiGet<Analytics>('/analytics');
}

export function getArchitectureInsights() {
  return apiGet<ArchitectureInsights>('/architecture');
}

export function getDependencyGraph(repository?: string) {
  const query = repository ? `?repository=${encodeURIComponent(repository)}` : '';
  return apiGet<DependencyResponse>(`/dependency-graph${query}`);
}
