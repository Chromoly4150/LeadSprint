# LeadSprint Roadmap

## Purpose

This document is a business-facing roadmap for LeadSprint.

It is intended to summarize:
- the product vision so far
- the core problem being solved
- the progress already made
- the proposed implementation path ahead

This should be shareable with a business partner as a current planning snapshot.

---

## Executive summary

LeadSprint is being developed as an **organization-first lead contact platform**.

The core idea is not just to generate leads, but to help businesses:
- generate leads
- ingest leads from outside sources
- engage hot inbound leads quickly
- maintain full communication context
- coordinate work across a team with role-based permissions

The strongest current product hook is:

> **LeadSprint helps organizations capture or generate leads and respond fast enough to keep those leads hot.**

A particularly important feature direction is the ability to take leads from sources such as website forms, Google Forms, webhooks, and other submissions, then automatically engage qualified inbound leads within **5 minutes**.

---

## Problem being solved

Many businesses lose revenue because lead handling is fragmented and slow.

Common issues include:
- leads coming in from multiple systems with no unified workflow
- slow response times after form submissions or inquiries
- poor internal coordination between team members
- lost context across emails, texts, calls, and notes
- lack of visibility into who contacted a lead and when
- inability to control permissions for different users in the same organization

LeadSprint is being designed to reduce that lead leakage and improve conversion through speed, structure, and context retention.

---

## Product vision

LeadSprint should become a flexible platform that any company type can use for lead intake, follow-up, and lead communication management.

### Core principles
- organization-first, not solo-user-first
- every account belongs to an organization
- every organization requires an owner
- supports teams, admins, operators, and support users
- handles both outbound lead generation and inbound lead response
- preserves full communication history and internal notes
- supports fast automation plus human handoff
- designed to stay easy to adjust as the UI evolves

### Initial market thinking
Mortgage is a natural starting wedge because of domain familiarity, but the product is intentionally being designed as a **general-purpose lead contact application** rather than something limited to mortgage.

That said, one key insight is that in industries like mortgage, the practical customer is often the **brokerage/team/organization**, not the individual producer.

---

## Current product definition

At the moment, the product is defined around these major capabilities:

### 1. Organization-based account model
- every user belongs to an organization
- every organization has an owner
- role types currently include:
  - Owner
  - Admin
  - General User
  - Support User

### 2. Role-aware permissions
The system is expected to support permission boundaries for things like:
- user management
- settings
- messaging leads
- integrations
- exports
- audit visibility
- internal notes

### 3. Lead intake from many sources
LeadSprint should support leads from:
- generated prospecting
- web forms
- Google Forms
- webhook submissions
- CSV imports
- manual entry
- future integrations

### 4. Hot-lead response workflow
A core promise is that when a lead arrives with enough information to act on, the platform should be able to engage that lead within **5 minutes**.

### 5. Human + bot workflow
The system should support:
- bot-driven first response
- follow-up/qualification collection
- seamless human takeover
- preserved conversation continuity

### 6. Communication history + internal context
Each lead should have:
- full timestamped communication history
- recent communication context
- internal org-only notes
- notes tied to specific calls or communication events

### 7. Reporting and exports
The system should support reporting, printing, and spreadsheet export workflows for operational visibility.

### 8. Future gamification
A future direction is to make lead work more engaging through achievements and progress tracking tied to useful behaviors like:
- fast response times
- lead follow-up consistency
- intake and conversion progress

---

## Current UI direction

The initial top-level navigation is currently planned as:
- **Dashboard**
- **Leads**
- **Reports**

### Dashboard
Intended to show overview metrics such as:
- inbound leads over recent windows
- conversion metrics
- hot leads
- SLA / response timing metrics
- general operational visibility

### Leads
This is the main operational workspace and is expected to support:
- lead list/table
- sorting
- filtering
- lifecycle status
- urgency/indicator status
- communication history
- internal notes
- human takeover from automated workflows

### Reports
Expected to support:
- operational reporting
- export to spreadsheet
- printable views
- summary metrics

### UI philosophy
The interface should be easy to adjust over time through reusable components, shared tokens, and modular layouts.

---

## Current architecture direction

The current preferred architecture is a **modular monolith**.

### Why
This fits the project’s current stage because it allows:
- faster iteration
- less operational overhead
- simpler deployment
- easier end-to-end development
- clear domain boundaries without premature microservices complexity

### Proposed technical stack
Current proposed direction:
- **Frontend:** Next.js
- **Backend:** same repo/app, modular server-side architecture
- **Database:** PostgreSQL
- **ORM:** Prisma or Drizzle
- **Jobs / background work:** Redis-backed worker queue
- **Auth:** organization-aware authentication and authorization
- **Messaging:** provider adapter layer
- **Automation:** event/job-driven bot and SLA workflows

---

## Progress made so far

The following major planning work has already been completed and stored in the repository:

### Product / business definition
- product brief
- MVP definition
- roadmap and business direction capture
- project memory and project log for durable context

### Domain / system design
- access model
- permissions model
- conceptual data model
- relational database schema proposal
- inbound hot-lead workflow
- technical architecture direction

### UI / UX planning
- UI map
- screen/layout proposal
- dashboard / leads / reports framing
- lead detail context requirements

### Implementation progress
- repository created and connected to GitHub
- initial project structure established
- Next.js application scaffold added
- first-pass UI shell created
- project builds successfully
- ongoing project context is now stored in-repo so work is not lost between sessions

---

## Key repository documents

Important planning documents currently in the repo include:
- `docs/product-brief.md`
- `docs/mvp.md`
- `docs/access-model.md`
- `docs/permissions.md`
- `docs/data-model.md`
- `docs/database-schema.md`
- `docs/inbound-flow.md`
- `docs/technical-architecture.md`
- `docs/ui-map.md`
- `docs/ui-screens.md`
- `docs/project-memory.md`
- `docs/project-log.md`

---

## Proposed roadmap from here

## Phase 1 — Foundation and product spine

### Goal
Create the first real working application foundation.

### Target outcomes
- establish ORM and database models in code
- create the initial schema/migrations
- implement organization and user foundations
- implement core lead/contact/conversation models
- build the first usable app routes and component structure

### Priority
High

---

## Phase 2 — Inbound lead workflow MVP

### Goal
Prove the central product promise around inbound leads.

### Target outcomes
- ingest a lead from at least one real source (likely webhook/form path first)
- normalize inbound data
- evaluate sufficiency/actionability
- trigger automated first response within SLA
- store conversation history
- support human takeover in the UI

### Why this phase matters
This is the core differentiator and the most compelling business proof point so far.

### Priority
Highest

---

## Phase 3 — Team operations and permissions

### Goal
Support real organizational usage.

### Target outcomes
- owner/admin/general/support user flows
- role assignment
- permission enforcement for messaging, notes, reporting, and management actions
- internal note workflows
- audit logging for sensitive actions

### Priority
High

---

## Phase 4 — Reporting and exports

### Goal
Provide operational visibility and business usefulness.

### Target outcomes
- basic reporting views
- export jobs / downloadable spreadsheets
- print-friendly report outputs
- SLA and conversion reporting

### Priority
Medium

---

## Phase 5 — Lead generation and sourcing expansion

### Goal
Expand beyond inbound handling into broader lead generation workflows.

### Target outcomes
- prospect generation/import workflows
- source tracking and enrichment support
- campaign support
- better qualification / prioritization tools

### Priority
Medium

---

## Phase 6 — Engagement, incentives, and polish

### Goal
Increase usability, retention, and distinctiveness.

### Target outcomes
- gamification / achievement system
- improved UI flexibility and customization
- stronger dashboard views
- better operational insights
- more integrations and automation depth

### Priority
Medium / later-stage

---

## Immediate next steps

The next recommended development steps are:

1. implement ORM/database setup
2. create initial schema models in code
3. build first app routes beyond the placeholder shell
4. implement the core lead detail structure
5. implement the first inbound ingestion path
6. wire up the hot-lead workflow foundation

This sequence keeps the work aligned to the strongest product promise.

---

## Risks and open questions

Important open areas still to define/refine:
- exact v1 messaging channel strategy
- exact “sufficient submission” rules
- detailed lead lifecycle and urgency values
- how much automation vs human review is appropriate in v1
- what the first real customer/test market should be
- how aggressive or lightweight gamification should become
- whether some workflows need compliance/approval rules by industry

---

## Why this is promising

LeadSprint is shaping up as more than a lead database and more than a chatbot.

The opportunity is in combining:
- lead intake
- lead generation
- fast engagement
- internal team coordination
- context preservation
- organization-level permissions

That combination gives the product a stronger story than generic lead software.

The current strongest business message is:

> **LeadSprint helps organizations capture, manage, and rapidly engage leads before they go cold.**

---

## Current status summary

LeadSprint is currently in the **planning + early scaffold stage**.

The product direction, architecture direction, data model, UI direction, and MVP framing are now documented in the repo.

The next step is moving from architecture/planning into actual product implementation, starting with the database/application backbone and then the inbound hot-lead workflow.
