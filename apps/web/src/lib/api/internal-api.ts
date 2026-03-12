import crypto from 'node:crypto';
import { API_BASE } from '../api';
import { getCurrentAuthUser } from '../auth/current-user';

function getInternalAuthSecret() {
  return process.env.INTERNAL_API_AUTH_SECRET || '';
}

function signIdentity(path: string, method: string, clerkUserId: string, email: string, timestamp: string) {
  const secret = getInternalAuthSecret();
  if (!secret) return null;
  const payload = [method.toUpperCase(), path, clerkUserId, email, timestamp].join('\n');
  return crypto.createHmac('sha256', secret).update(payload).digest('hex');
}

async function buildHeaders(path: string, init?: RequestInit) {
  const headers = new Headers(init?.headers || {});
  if (!headers.has('Content-Type') && init?.body) headers.set('Content-Type', 'application/json');

  const currentUser = await getCurrentAuthUser();
  if (currentUser?.email && !headers.has('x-user-email')) headers.set('x-user-email', currentUser.email);
  if (currentUser?.clerkUserId && !headers.has('x-clerk-user-id')) headers.set('x-clerk-user-id', currentUser.clerkUserId);

  if (currentUser?.email && currentUser?.clerkUserId) {
    const timestamp = new Date().toISOString();
    const signature = signIdentity(path, init?.method || 'GET', currentUser.clerkUserId, currentUser.email, timestamp);
    if (signature) {
      headers.set('x-internal-auth-ts', timestamp);
      headers.set('x-internal-auth-signature', signature);
    }
  }

  return headers;
}

export async function internalApiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = await buildHeaders(path, init);
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
