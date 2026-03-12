# LeadSprint Temporary Deployment Notes

This branch (`port-from-openclaw-sync`) is the current best candidate for a temporary partner-testable deployment.

## What works now

Partner-testable routes in `apps/web`:
- `/dashboard`
- `/leads`
- `/inbox`
- `/reports`
- `/settings`

Usable flows:
- browse the lead queue
- open a lead workspace
- update lead status / urgency
- add internal notes
- log communications
- create email drafts
- queue outbox items
- browse inbox threads

## Minimum deployment shape

You need two running services:

1. **API** (`apps/api`)
   - Node/Express
   - default port: `4000`

2. **Web** (`apps/web`)
   - Next.js
   - default port: `3000`

## Environment

### apps/web

Required:
- `NEXT_PUBLIC_API_BASE`
- `NEXT_PUBLIC_APP_URL`
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `CLERK_SECRET_KEY`
- `INTERNAL_API_AUTH_SECRET`

Example:

```bash
NEXT_PUBLIC_API_BASE=https://your-api-host.example.com
NEXT_PUBLIC_APP_URL=https://your-web-host.example.com
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_...
CLERK_SECRET_KEY=sk_...
INTERNAL_API_AUTH_SECRET=choose-a-long-random-secret
```

### apps/api

Required:
- `INTERNAL_API_AUTH_SECRET`

It must exactly match the `INTERNAL_API_AUTH_SECRET` used by `apps/web`.

Current branch uses the local SQLite-backed setup already in the repo.
For temporary testing, initialize once before first run:

```bash
cd apps/api
npm install
npm run db:init
npm run db:seed
```

## Local smoke-test commands

```bash
# API
cd apps/api
npm install
npm run db:init
npm run db:seed
npm run dev

# Web (new shell)
cd apps/web
npm install
NEXT_PUBLIC_API_BASE=http://127.0.0.1:4000 npm run dev -- --hostname 127.0.0.1 --port 3000
```

## Pre-share smoke test

Before sending to a partner, verify:
- dashboard loads
- leads page loads
- selecting a lead works
- adding a note works
- logging a communication works
- creating an email draft works
- queueing an outbox item works
- inbox page loads
- inbox thread page loads

## Important limitations

This is a **semi-functional test build**, not production-ready software.

Known caveats:
- Clerk auth is now scaffolded and requires Render env configuration to work in hosted environments
- onboarding/admin UX is rough but functional rather than polished
- temporary hosting setup is manual
- inbox is built on top of current lead communications, not a final dedicated conversation model
- duplicate detection is present in the API intake flow, but import hygiene still needs more polish in the remote-main architecture
- Render env values should be checked against the actual assigned service URLs if Render gives you names other than `leadsprint-api` / `leadsprint-web`

## Recommended hosting approach

For the fastest temporary shareable deployment:
- host `apps/api` on a simple Node host
- host `apps/web` on a Next-compatible host
- point `NEXT_PUBLIC_API_BASE` at the API URL
- seed once
- share the web URL
