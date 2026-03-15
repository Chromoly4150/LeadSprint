import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

const isProtectedRoute = createRouteMatcher(['/dashboard(.*)', '/leads(.*)', '/inbox(.*)', '/reports(.*)', '/settings(.*)', '/onboarding(.*)', '/control(.*)', '/workspace(.*)', '/platform/sign-in(.*)']);
const clerkEnabled = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && process.env.CLERK_SECRET_KEY);

export default clerkMiddleware(async (auth, req) => {
  if (!clerkEnabled) return NextResponse.next();
  if (isProtectedRoute(req)) await auth.protect();
  return NextResponse.next();
});

export const config = {
  matcher: ['/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)', '/(api|trpc)(.*)'],
};
