'use server';

import { redirect } from 'next/navigation';
import { internalApiFetch } from '../../lib/api/internal-api';
import { getCurrentAuthUser } from '../../lib/auth/current-user';

export async function createIndividualWorkspace(formData: FormData) {
  const currentUser = await getCurrentAuthUser();
  if (!currentUser) redirect('/sign-in');

  const payload = {
    fullName: String(formData.get('fullName') || currentUser.fullName || '').trim(),
    email: String(formData.get('email') || currentUser.email || '').trim(),
    workspaceName: String(formData.get('workspaceName') || '').trim(),
    lineOfBusiness: String(formData.get('lineOfBusiness') || '').trim(),
    useCase: String(formData.get('useCase') || '').trim(),
    notes: String(formData.get('notes') || '').trim(),
  };

  await internalApiFetch('/api/access/individual', {
    method: 'POST',
    body: JSON.stringify(payload),
  });

  redirect('/dashboard');
}

export async function submitBusinessRequest(formData: FormData) {
  const currentUser = await getCurrentAuthUser();
  if (!currentUser) redirect('/sign-in');

  const requestedFeatures = formData.getAll('requestedFeatures').map((v) => String(v));
  const payload = {
    fullName: String(formData.get('fullName') || currentUser.fullName || '').trim(),
    email: String(formData.get('email') || currentUser.email || '').trim(),
    roleTitle: String(formData.get('roleTitle') || '').trim(),
    organizationName: String(formData.get('organizationName') || '').trim(),
    website: String(formData.get('website') || '').trim(),
    lineOfBusiness: String(formData.get('lineOfBusiness') || '').trim(),
    teamSize: String(formData.get('teamSize') || '').trim(),
    requestedFeatures,
    authorityAttestation: formData.get('authorityAttestation') === 'on',
    notes: String(formData.get('notes') || '').trim(),
  };

  await internalApiFetch('/api/access/business-request', {
    method: 'POST',
    body: JSON.stringify(payload),
  });

  redirect('/access-status');
}
