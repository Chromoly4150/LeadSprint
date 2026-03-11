# Taskboard (Now / Next / Later)

## NOW (Week 1 execution)

### T1 — Data model + migrations
- [x] Choose DB for local dev + deploy target (SQLite for local MVP)
- [x] Create schema for organizations, users, leads, events, templates, settings
- [x] Add migration + seed scripts
- [x] Document local setup in README

### T2 — Lead intake endpoint (real)
- [x] Add request validation (required fields + formats)
- [x] Persist inbound leads
- [x] Record lead-created event
- [x] Return stable lead id + status

### T3 — Inbox API
- [x] `GET /api/leads` (filters + pagination)
- [x] `GET /api/leads/:id`
- [x] `PATCH /api/leads/:id/status`
- [x] Basic tests for happy path + invalid input

### T4 — Script customization (MVP-critical)
- [x] `GET /api/templates/first-response`
- [x] `PUT /api/templates/first-response`
- [x] `POST /api/templates/first-response/preview`
- [x] Template version history endpoint
- [x] Template restore from version

### T5 — Dev ergonomics
- [ ] One-command local start script
- [ ] Sample curl/Postman collection for intake testing
- [x] Seed script for realistic test leads

## NEXT (Week 2–3)

### N1 — Inbox UI
- [x] List view with status chips
- [x] Detail panel with contact info + notes
- [x] Fast status update controls
- [x] Edit existing lead fields + save
- [x] Manual contact log panel + lead timeline

### N2 — Business settings UI
- [x] Business name, timezone, working hours
- [x] Booking link and reply settings
- [x] Minimal preferences menu/tab for demo

### N3 — Auto-reply v1
- [ ] First-response template editor
- [ ] Auto-reply toggle
- [ ] Business-hours + after-hours logic
- [ ] Outbound send event logging

### N4 — Team roles + user management (MVP basics)
- [x] Mandatory organization owner bootstrap
- [x] Add team members (admin, agent)
- [x] Deactivate/suspend/remove non-owner users
- [x] Owner/admin route gating via auth-context shim (`x-user-email`)
- [x] Permission matrix scaffold for per-feature access (API)
- [ ] Granular permission management UX + audit trail (phase 2)
- [ ] External channel credentials per org/user (Twilio/email) (phase 2)

## LATER (Week 4+)

### T8 — Daily digest
- [ ] Daily summary job
- [ ] Discord/email delivery
- [ ] Overdue response alerts

### T9 — Pilot hardening
- [ ] Retry strategy
- [ ] Audit timeline
- [ ] Mobile polish
- [ ] QA checklist and bug triage cadence

### T10 — Pilot launch
- [ ] Pilot onboarding script
- [ ] KPI dashboard (response time + conversion)
- [ ] Weekly feedback loop with sales director

---

## MVP Acceptance Criteria
- [ ] New lead can be ingested and appears in inbox in under 5s
- [ ] User can move lead through statuses from UI
- [ ] Auto-reply sends correctly when enabled
- [ ] Daily digest sends once/day with accurate counts
- [ ] Median first response time < 5 minutes in pilot
