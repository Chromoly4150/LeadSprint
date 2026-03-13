'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { ApiFetchError, apiFetch } from '../../lib/api';
import { internalApiFetch } from '../../lib/api/internal-api';
import { getCurrentAuthUser } from '../../lib/auth/current-user';

const DRAFT_COOKIE = 'leadsprint_request_access_draft';

type RequestAccessDraft = {
  path: 'individual' | 'business';
  payload: Record<string, string | string[] | boolean>;
};

function normalize(value: FormDataEntryValue | null) {
  return String(value || '').trim();
}

function setDraftCookie(draft: RequestAccessDraft) {
  cookies().set(DRAFT_COOKIE, JSON.stringify(draft), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60,
  });
}

function redirectWithRequestError(kind: 'individual' | 'business', draft: RequestAccessDraft, error: unknown) {
  setDraftCookie(draft);
  const message = error instanceof ApiFetchError
    ? error.message
    : 'LeadSprint hit a temporary server issue while saving your request. Please try again in a few seconds.';
  redirect(`/request-access?resume=1&error=${encodeURIComponent(message)}#${kind}-request`);
}

export async function submitIndividualAccessRequest(formData: FormData) {
  const currentUser = await getCurrentAuthUser();
  const payload = {
    fullName: normalize(formData.get('fullName')),
    email: normalize(formData.get('email')),
    workspaceName: normalize(formData.get('workspaceName')),
    lineOfBusiness: normalize(formData.get('lineOfBusiness')),
    useCase: normalize(formData.get('useCase')),
    notes: normalize(formData.get('notes')),
  };
  const draft = { path: 'individual' as const, payload };

  try {
    if (!currentUser) {
      await apiFetch('/api/public/access/individual', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      cookies().delete(DRAFT_COOKIE);
      redirect('/request-access?submitted=individual');
    }

    await internalApiFetch('/api/access/individual', {
      method: 'POST',
      body: JSON.stringify({
        ...payload,
        fullName: payload.fullName || currentUser.fullName || '',
        email: payload.email || currentUser.email || '',
      }),
    });

    cookies().delete(DRAFT_COOKIE);
    redirect('/access-status');
  } catch (error) {
    redirectWithRequestError('individual', draft, error);
  }
}

export async function submitBusinessAccessRequest(formData: FormData) {
  const currentUser = await getCurrentAuthUser();
  const requestedFeatures = formData.getAll('requestedFeatures').map((value) => String(value));
  const payload = {
    fullName: normalize(formData.get('fullName')),
    email: normalize(formData.get('email')),
    roleTitle: normalize(formData.get('roleTitle')),
    organizationName: normalize(formData.get('organizationName')),
    website: normalize(formData.get('website')),
    lineOfBusiness: normalize(formData.get('lineOfBusiness')),
    teamSize: normalize(formData.get('teamSize')),
    requestedFeatures,
    authorityAttestation: formData.get('authorityAttestation') === 'on',
    notes: normalize(formData.get('notes')),
  };
  const draft = { path: 'business' as const, payload };

  try {
    if (!currentUser) {
      await apiFetch('/api/public/access/business-request', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      cookies().delete(DRAFT_COOKIE);
      redirect('/request-access?submitted=business');
    }

    await internalApiFetch('/api/access/business-request', {
      method: 'POST',
      body: JSON.stringify({
        ...payload,
        fullName: payload.fullName || currentUser.fullName || '',
        email: payload.email || currentUser.email || '',
      }),
    });

    cookies().delete(DRAFT_COOKIE);
    redirect('/access-status');
  } catch (error) {
    redirectWithRequestError('business', draft, error);
  }
}
