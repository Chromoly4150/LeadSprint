# Project Log

## 2026-03-11

- Replaced the static mock-data-only app behavior with a lightweight real data layer backed by SQLite (`data/leadsprint.sqlite`) and Drizzle.
- Added concrete tables for organizations, users, leads, notes, communications, activities, inbound events, and outbound jobs.
- Seeded the app with demo org/user/lead records so the product can boot into a realistic operational state without manual setup.
- Updated Dashboard and Leads to read from the live database rather than in-memory arrays.
- Added server actions so lead detail now supports real workflow operations: assignment changes, lifecycle changes, internal note creation, and manual contact logging.
- Added a unified lead timeline that combines activities, notes, and communications.
- Implemented the first inbound MVP endpoint at `POST /api/inbound`.
- Defined the current inbound behavior so normalized intake creates a lead, records the inbound event, starts the SLA window, and queues a placeholder first-response outbound job when the submission is actionable.
- Confirmed the app builds successfully after the data/workflow changes.
- Confirmed the inbound endpoint works with a live test payload that created a new lead record in the app.
- Replaced the placeholder Reports screen with live reporting summaries and a CSV export endpoint at `GET /api/reports/leads`.
- Removed the now-obsolete `src/lib/mock-data.ts` scaffold because the app is now backed by the real SQLite data layer.
- Added live lead filtering/search on the Leads screen (query, lifecycle, urgency, assignee).
- Added an operator dispatch workflow for queued outbound jobs so jobs can be marked sent or failed from the lead detail screen and write back into communications/activity state.

## 2026-03-10

- Confirmed the project should be thought of as a **platform/service** rather than just an internal one-off lead list effort.
- Clarified that while mortgage is a strong starting point, the product ambition is broader: a **general-purpose lead contact application**.
- Clarified that the likely customer in mortgage is often the **brokerage/team**, not an individual loan officer, because individual LOs may not be able to use unapproved software on their own.
- Added `docs/project-memory.md` and this log file so project context persists inside the repository.
- Agreed that relying only on assistant/session memory is not sufficient; the repo itself should carry durable project context.
- Defined an initial **organization-first access model**:
  - every account belongs to an organization
  - every organization requires an owner
  - initial roles: Owner, Admin, General User, Support User
- Noted that permissions should likely evolve toward **role templates plus granular overrides** so companies can separate operational helpers from messaging authority.
- Added a first-pass `docs/data-model.md` covering organizations, users, roles, permissions, leads, contacts, campaigns, conversations, messages, integrations, audit logs, and SLA/automation concepts.
- Captured a key product promise: the system should both **generate leads** and **ingest leads from external sources** such as Google Forms or website submissions.
- Captured a core conversion-focused workflow: when an inbound lead has sufficient submission data, a chatbot/automation flow should engage that lead within **5 minutes** so the lead stays hot.
- Added `docs/product-brief.md` to define the product vision, problem, core value proposition, target users, MVP direction, and differentiators.
- Added `docs/inbound-flow.md` to define the end-to-end hot inbound lead workflow: intake, normalization, sufficiency evaluation, rapid response, bot engagement, routing, handoff, and SLA/audit considerations.
- Added `docs/mvp.md` to define the smallest buildable version of LeadSprint focused on organization support, inbound intake, rapid response, conversation continuity, and role-aware operation.
- Added `docs/permissions.md` to define the first-pass role and permission model for Owner, Admin, General User, and Support User, including sensitive messaging controls.
- Chose a **modular monolith** as the current architectural direction.
- Added `docs/ui-map.md` and `docs/architecture.md` capturing the first UI/navigation shape.
- Defined initial top-level tabs as **Dashboard**, **Leads**, and **Reports**.
- Captured Dashboard direction around overview metrics such as recent inbound leads and conversion metrics.
- Captured Leads direction around sortable/filterable lead lists, including separation between lifecycle status and urgency/indicator status (such as Hot).
- Captured Reports direction around exports, printable views, and operational reporting.
- Added `docs/technical-architecture.md` with a concrete modular-monolith stack proposal: Next.js, PostgreSQL, auth/authorization layering, Redis-backed jobs, provider adapters, and event/job-driven hot-lead handling.
- Added `docs/ui-screens.md` with a concrete screen/layout proposal for Dashboard, Leads, Reports, and the embedded lead-detail conversation workflow.
- Expanded the model/UI direction so each lead supports internal org-only notes and a full timestamped communication log.
- Captured the need for privileged users to review recent communication context across email, SMS, and calls, with notes attachable directly to call records.
- Added `docs/database-schema.md` translating the conceptual model into a first-pass relational schema with core tables, indexes, controlled values, and migration order.
- Scaffolded the initial Next.js application shell in the repo with a first-pass Dashboard / Leads / Reports UI and verified it builds successfully.
- Captured a UI-direction constraint that the interface should remain easy to adjust through reusable components, tokens, and modular layout structure.
- Captured a future product direction around gamification/achievements to reinforce useful behaviors like fast follow-up, throughput, and consistent lead handling.
- Added `docs/roadmap.md` as a business-facing roadmap summarizing the product vision, current progress, and proposed phased path forward for partner sharing.
- Reinforced the project operating rule that the LeadSprint repo docs should act as the durable source of truth so future conversations do not lose project context.
- Identified an older project folder at `~/Documents/lead gen` containing substantial prior materials (architecture, PRD, roadmap, positioning, integrations, sprint/taskboard docs) that should likely be reviewed/imported rather than left as stranded context.
