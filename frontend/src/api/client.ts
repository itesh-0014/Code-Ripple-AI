import { useAuthStore } from '../store/authStore';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

export async function apiGet<T>(path: string): Promise<T> {
  return apiRequest<T>(path, { method: 'GET' });
}

export async function apiPost<T>(path: string, body?: unknown): Promise<T> {
  return apiRequest<T>(path, {
    method: 'POST',
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

async function apiRequest<T>(path: string, init: RequestInit): Promise<T> {
  const token = useAuthStore.getState().token;
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      ...(init.body ? { 'content-type': 'application/json' } : {}),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
  });
  const body = await response.json() as ApiResponse<T>;

  if (!response.ok) {
    if (response.status === 401) useAuthStore.getState().logout();
    throw new Error(body.message || 'Unable to load GitSense data.');
  }

  return body.data;
}

export function githubLoginUrl() {
  return `${API_BASE_URL}/auth/github`;
}

export function githubCallbackUrl(search: string) {
  return `${API_BASE_URL}/auth/github/callback${search}`;
}
