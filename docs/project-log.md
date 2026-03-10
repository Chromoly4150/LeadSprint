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
