export function isClerkConfigured() {
  return Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && process.env.CLERK_SECRET_KEY);
}

export const authScaffoldEnabled = isClerkConfigured();

export function getAppBaseUrl() {
  return process.env.NEXT_PUBLIC_APP_URL || '';
}

export function getOnboardingRedirectUrl() {
  const base = getAppBaseUrl().replace(/\/$/, '');
  return base ? `${base}/onboarding` : '/onboarding';
}
