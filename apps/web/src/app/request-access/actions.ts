'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
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

  if (!currentUser) {
    setDraftCookie({ path: 'individual', payload });
    redirect('/sign-up?approved=1&redirect_url=/request-access?resume=1');
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
  redirect('/dashboard');
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

  if (!currentUser) {
    setDraftCookie({ path: 'business', payload });
    redirect('/sign-up?approved=1&redirect_url=/request-access?resume=1');
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
}
