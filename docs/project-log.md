# Project Log

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
