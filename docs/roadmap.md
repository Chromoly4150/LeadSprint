# LeadSprint Roadmap (8 Weeks)

## Phase 0 — Alignment (Day 1)
**Goal:** lock scope and success criteria.

- Choose initial niche + pilot customer profile
- Define required lead fields
- Define KPIs:
  - median first response < 5 minutes
  - lead-to-booked-call conversion lift
- Freeze MVP in/out scope

**Deliverable:** `docs/MVP-SCOPE.md`

---

## Phase 1 — Core Foundation (Week 1)
**Goal:** data in, data stored, data retrievable.

- Add DB schema for:
  - organizations
  - users
  - leads
  - events
  - templates
  - settings
- Implement `POST /api/leads/intake` with validation + persistence
- Add API endpoints for inbox:
  - list leads
  - lead detail
  - update lead status
- Add test seed utilities

**Deliverable:** reliable lead CRUD flow in API.

---

## Phase 2 — Dashboard UI/UX Base (Week 2)
**Goal:** usable browser dashboard.

- Build app shell + nav + route structure
- Build lead inbox list/detail
- Add status transitions: new/contacted/booked/closed
- Build business settings screen (hours, timezone, booking link)
- UX polish pass #1

**Deliverable:** manual lead ops fully usable in UI.

---

## Phase 3 — Auto-Reply Engine v1 (Week 3)
**Goal:** first automation that saves time.

- Template editor (first-response template)
- Auto-reply ON/OFF toggle
- Business-hours logic:
  - immediate reply during business hours
  - after-hours acknowledgment message
- Log all send attempts/events

**Deliverable:** new lead triggers automated first response.

---

## Phase 4 — Digest + Ops Visibility (Week 4)
**Goal:** daily accountability and health visibility.

- Daily digest summary job
- Delivery channel: Discord (or email fallback)
- Include:
  - new leads
  - contacted/booked/closed counts
  - overdue response alerts
- Add minimal diagnostics view

**Deliverable:** daily signal without dashboard login.

---

## Phase 5 — Pilot Hardening (Weeks 5–6)
**Goal:** stability for real-world use.

- Error handling + retries
- Better validation + edge-case handling
- Activity timeline/audit log per lead
- Mobile responsiveness pass
- QA and bug bash

**Deliverable:** pilot-ready reliability baseline.

---

## Phase 6 — Pilot Launch (Weeks 7–8)
**Goal:** prove value and gather conversion evidence.

- Onboard 1–3 pilot businesses
- Run weekly feedback loop with sales director
- Track and review KPIs weekly
- Prioritize top 5 friction/failure fixes

**Deliverable:** pilot case study + v1 launch backlog.
