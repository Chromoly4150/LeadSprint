import { auth, currentUser } from '@clerk/nextjs/server';
import { authScaffoldEnabled } from './config';

export async function getCurrentAuthUser() {
  if (!authScaffoldEnabled) return null;
  const { userId } = await auth();
  if (!userId) return null;
  const user = await currentUser();
  if (!user) return null;

  return {
    clerkUserId: user.id,
    email: user.primaryEmailAddress?.emailAddress || null,
    fullName: [user.firstName, user.lastName].filter(Boolean).join(' ') || user.username || 'User',
  };
}
