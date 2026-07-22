import type { UserProfile } from '../types/dashboard';
import { apiGet, githubLoginUrl } from './client';

export function getProfile() {
  return apiGet<UserProfile>('/user/profile');
}

export { githubLoginUrl };
