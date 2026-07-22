import type { Repository } from '../types/dashboard';
import { apiGet } from './client';

export function getRepositories() {
  return apiGet<Repository[]>('/repositories');
}
