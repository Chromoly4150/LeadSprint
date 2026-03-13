import crypto from 'node:crypto';
import { getCurrentAuthUser } from './auth/current-user';

export const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://127.0.0.1:4000';
const TRANSIENT_STATUS_CODES = new Set([502, 503, 504]);

export class ApiFetchError extends Error {
  status?: number;
  body?: string;
  responseType?: string;
  transient?: boolean;

  constructor(message: string, options?: { status?: number; body?: string; responseType?: string; transient?: boolean }) {
    super(message);
    this.name = 'ApiFetchError';
    this.status = options?.status;
    this.body = options?.body;
    this.responseType = options?.responseType;
    this.transient = options?.transient;
  }
}

function signIdentity(path: string, method: string, clerkUserId: string, email: string, timestamp: string) {
  const secret = process.env.INTERNAL_API_AUTH_SECRET || '';
  if (!secret) return null;
  const payload = [method.toUpperCase(), path, clerkUserId, email, timestamp].join('\n');
  return crypto.createHmac('sha256', secret).update(payload).digest('hex');
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isHtmlLike(contentType: string | null, body: string) {
  return (contentType || '').includes('text/html') || /<!DOCTYPE html>|<html/i.test(body);
}

export async function apiFetch<T>(path: string, init?: RequestInit, userEmail = ''): Promise<T> {
  const currentUser = await getCurrentAuthUser();
  const email = currentUser?.email || userEmail;
  const retries = init?.method && init.method.toUpperCase() !== 'GET' ? 2 : 1;
  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const headers = new Headers(init?.headers || {});
    if (!headers.has('Content-Type') && init?.body) headers.set('Content-Type', 'application/json');
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

    try {
      const res = await fetch(`${API_BASE}${path}`, {
        ...init,
        headers,
        cache: 'no-store',
      });

      const bodyText = await res.text();
      const contentType = res.headers.get('content-type');
      const transient = TRANSIENT_STATUS_CODES.has(res.status) || isHtmlLike(contentType, bodyText);

      if (!res.ok) {
        if (transient && attempt < retries) {
          await delay(800 * (attempt + 1));
          continue;
        }
        throw new ApiFetchError(
          transient
            ? 'LeadSprint is waking up or temporarily unavailable. Please try again in a few seconds.'
            : bodyText || `Request failed: ${res.status}`,
          { status: res.status, body: bodyText, responseType: contentType || undefined, transient }
        );
      }

      if (isHtmlLike(contentType, bodyText)) {
        if (attempt < retries) {
          await delay(800 * (attempt + 1));
          continue;
        }
        throw new ApiFetchError('LeadSprint is waking up or temporarily unavailable. Please try again in a few seconds.', {
          status: res.status,
          body: bodyText,
          responseType: contentType || undefined,
          transient: true,
        });
      }

      try {
        return JSON.parse(bodyText) as T;
      } catch {
        throw new ApiFetchError('LeadSprint returned an unexpected response. Please try again in a few seconds.', {
          status: res.status,
          body: bodyText,
          responseType: contentType || undefined,
          transient: true,
        });
      }
    } catch (error) {
      lastError = error;
      const transient = error instanceof ApiFetchError ? error.transient : true;
      if (transient && attempt < retries) {
        await delay(800 * (attempt + 1));
        continue;
      }
      throw error;
    }
  }

  throw lastError instanceof Error ? lastError : new ApiFetchError('LeadSprint request failed unexpectedly.');
}
