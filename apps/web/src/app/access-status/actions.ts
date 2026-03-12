'use server';

import { redirect } from 'next/navigation';
import { internalApiFetch } from '../../lib/api/internal-api';

export async function acceptInvitationAction(formData: FormData) {
  const invitationId = String(formData.get('invitationId') || '').trim();
  if (!invitationId) return;
  await internalApiFetch(`/api/invitations/${invitationId}/accept`, {
    method: 'POST',
  });
  redirect('/dashboard');
}
