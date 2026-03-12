import { API_BASE } from '../api';
import { getCurrentAuthUser } from '../auth/current-user';

async function buildHeaders(init?: RequestInit) {
  const headers = new Headers(init?.headers || {});
  if (!headers.has('Content-Type') && init?.body) headers.set('Content-Type', 'application/json');

  const currentUser = await getCurrentAuthUser();
  if (currentUser?.email && !headers.has('x-user-email')) headers.set('x-user-email', currentUser.email);
  if (currentUser?.clerkUserId && !headers.has('x-clerk-user-id')) headers.set('x-clerk-user-id', currentUser.clerkUserId);
  return headers;
}

export async function internalApiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = await buildHeaders(init);
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers,
    cache: 'no-store',
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Request failed: ${res.status}`);
  }

  return res.json();
}
