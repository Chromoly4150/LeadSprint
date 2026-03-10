# Technical Architecture

## Recommended approach

Build LeadSprint as a **modular monolith** with a shared PostgreSQL database, background job processing, and a web-first UI.

## Why this fits

LeadSprint’s main complexity is workflow coordination:
- inbound lead intake
- normalization
- lead qualification
- automated first response
- conversation continuity
- human handoff
- org/user/permission controls

Those are tightly connected concerns. A modular monolith keeps them close while still allowing clean internal boundaries.

---

## Proposed stack

### Frontend
- **Next.js** web app
- app-router style layout
- server-rendered pages where useful, client components where interaction matters

Why:
- good fit for dashboard/admin product UI
- easy full-stack integration in a monolith
- flexible enough for realtime-ish views and form-heavy admin screens

### Backend
- **Next.js server routes / server actions** or a clearly separated server layer inside the same repo
- internal module boundaries by domain

Possible internal modules:
- `organizations`
- `users`
- `permissions`
- `leads`
- `contacts`
- `companies`
- `inbound`
- `conversations`
- `messaging`
- `automation`
- `reports`
- `integrations`
- `audit`

Why:
- one codebase and one deployable
- easier end-to-end development early on
- preserves room to extract components later if necessary

### Database
- **PostgreSQL**

Why:
- strong relational model for orgs/users/roles/leads/conversations
- good fit for filtering, reporting, and audit history
- mature and boring in a good way

### ORM / schema layer
- **Prisma** or **Drizzle**

My bias:
- Prisma if you want fast productivity and clear schema workflows
- Drizzle if you want more SQL-ish control early

Either is fine; don’t overthink this part.

### Auth
- app-level auth with session support
- organization-aware authorization layer on top
- role + permission checks enforced server-side

Important principle:
- authentication answers “who are you?”
- authorization answers “what can you do in this org?”

### Background jobs / async work
- **Redis-backed queue + worker processes**

Use this for:
- inbound intake processing
- lead normalization
- bot-response scheduling
- SLA timers
- retries for messaging/integrations
- report/export generation
- webhooks and external syncs

Why:
- the 5-minute hot-lead promise depends on reliable async execution
- background work should not depend on a user keeping a page open

### Realtime / live updates
- start simple with polling or light realtime updates
- add websockets/SSE for conversation and lead status updates if needed

My recommendation:
- avoid overbuilding realtime at first
- use selective realtime for conversation updates and hot-lead activity only

### File/export storage
- object storage or equivalent for:
  - exports
  - uploaded CSVs
  - raw intake payload archives if needed
  - generated report files

### Messaging/integration layer
- create a provider abstraction for channels like:
  - SMS
  - email
  - web chat
  - future channels

Important rule:
- channel-specific behavior should be behind adapters/interfaces
- business workflow should not be hardcoded directly to one provider

### AI / automation layer
- bot logic should be treated as an internal module, not as the entire product
- automation should be event-driven and policy-aware

Responsibilities:
- decide whether automation is allowed
- generate/send first response
- collect structured follow-up information
- trigger handoff when conditions are met
- log automation actions for auditability

---

## Architectural modules

## 1. Organizations / Users / Permissions
Handles:
- org creation
- owner/admin/general/support roles
- invitations
- permission checks
- org settings

## 2. Leads domain
Handles:
- lead records
- statuses
- urgency indicators
- assignment
- lead timelines
- dedupe logic

## 3. Contacts / Companies domain
Handles:
- person/company records
- relationship to leads
- enrichment-ready fields

## 4. Inbound intake domain
Handles:
- form/webhook/Google Form intake
- raw payload capture
- normalization pipeline
- sufficient-submission evaluation

## 5. Conversations / Messaging domain
Handles:
- threads
- inbound/outbound messages
- channel adapters
- send state / delivery state
- human takeover support

## 6. Automation domain
Handles:
- first-response rules
- SLA timers
- bot engagement runs
- escalation/handoff triggers

## 7. Reports / Exports domain
Handles:
- report generation
- CSV/spreadsheet exports
- print-friendly outputs
- operational summaries

## 8. Audit domain
Handles:
- user/system action logging
- sensitive event history
- compliance/support visibility

---

## Suggested request/event flow

### Hot inbound lead flow
1. source submits lead
2. inbound module stores raw event
3. normalization job maps to internal lead/contact/company records
4. evaluation job marks lead as sufficient / insufficient
5. if sufficient, automation job schedules first response
6. messaging adapter sends first message
7. conversation thread is updated
8. UI reflects new lead state
9. human user takes over when needed

This should be mostly event/job driven after the initial intake.

---

## Suggested database shape

Core tables/models likely include:
- organizations
- users
- roles
- permission_assignments
- leads
- contacts
- companies
- lead_sources
- campaigns
- conversations
- messages
- automation_runs
- integrations
- audit_logs
- reports
- imports/exports

---

## Deployment shape

For v1, keep it simple:
- one web app
- one postgres database
- one redis instance
- one or more worker processes

This is enough to support:
- authenticated app usage
- async intake/automation
- reporting/export jobs
- growth without premature complexity

---

## Design rules worth keeping

- keep domain logic out of UI components
- enforce permissions on the server, not only in the UI
- preserve raw inbound payloads for debugging/audit
- model lifecycle status separately from urgency status
- keep messaging provider logic isolated behind adapters
- make async jobs idempotent where possible
- log important automation and handoff actions

---

## What not to do yet

- no microservices yet
- no giant event-sourcing rewrite fantasy
- no deeply custom workflow builder in v1
- no overengineered realtime everywhere
- no channel/provider-specific spaghetti mixed into core domain code

---

## Recommended first build slice

Build one end-to-end slice:
- create org + owner
- invite a user
- ingest a lead from a form/webhook
- normalize it
- classify it as hot/actionable
- create/send automated first response
- show it in Leads UI
- allow human takeover in lead detail/conversation view

If that works well, the rest of the system has a solid spine.
