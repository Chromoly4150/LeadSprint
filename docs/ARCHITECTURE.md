# Architecture

## Frontend
- Next.js App Router
- Tailwind + shadcn/ui

## Backend
- Node.js + Express
- PostgreSQL (Supabase)
- Redis (optional queue)

## Automation
- Worker polls queue/events
- Rules engine for reply timing and follow-up cadence

## Data Model (high-level)
- organizations
- users
- leads
- conversations
- templates
- automations
- events
- subscriptions
