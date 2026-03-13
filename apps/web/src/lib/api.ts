import crypto from 'node:crypto';
import { getCurrentAuthUser } from './auth/current-user';

export const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://127.0.0.1:4000';

function signIdentity(path: string, method: string, clerkUserId: string, email: string, timestamp: string) {
  const secret = process.env.INTERNAL_API_AUTH_SECRET || '';
  if (!secret) return null;
  const payload = [method.toUpperCase(), path, clerkUserId, email, timestamp].join('\n');
  return crypto.createHmac('sha256', secret).update(payload).digest('hex');
}

export async function apiFetch<T>(path: string, init?: RequestInit, userEmail = 'owner@leadsprint.local'): Promise<T> {
  const headers = new Headers(init?.headers || {});
  if (!headers.has('Content-Type') && init?.body) headers.set('Content-Type', 'application/json');

  const currentUser = await getCurrentAuthUser();
  const email = currentUser?.email || userEmail;
  if (email && !headers.has('x-user-email')) headers.set('x-user-email', email);

  if (currentUser?.clerkUserId && currentUser?.email) {
    headers.set('x-clerk-user-id', currentUser.clerkUserId);
    const timestamp = new Date().toISOString();
    const signature = signIdentity(path, init?.method || 'GET', currentUser.clerkUserId, currentUser.email, timestamp);
    if (signature) {
      headers.set('x-internal-auth-ts', timestamp);
      headers.set('x-internal-auth-signature', signature);
    }
  }

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
