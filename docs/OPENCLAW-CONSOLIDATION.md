# OpenClaw Consolidation Notes

This file captures the product requirements and architectural direction that must carry forward as the active implementation base shifts to this repository.

## Active decision

This repository (`~/Documents/lead gen`) is now the active implementation base because it already contains a semi-functional UI, API, database, and core lead-management workflows.

The newer `~/ .openclaw/workspace/LeadSprint` repo contains important planning and product-definition work that must be folded into this implementation rather than rebuilt from scratch in parallel.

## Non-negotiable product requirements to preserve and build toward

### Product scope
LeadSprint is not just a lead list tool. It is an **organization-first lead contact platform** intended to become professional-grade software that businesses can buy and operators can actually use.

### Organization-first model
- every account belongs to an organization
- every organization requires an owner
- role model must support at least:
  - Owner
  - Admin
  - General User
  - Support User
- permissions must be granular enough to separate actions like user management, messaging, exports, integrations, and internal notes

### Hot-lead promise
The product should support rapid inbound response.

Core promise:
- if a lead arrives with sufficient submission data, the system should be able to engage that lead within **5 minutes**
- goal is to keep the lead hot and improve conversion odds

### Lead sources
The platform must be able to:
- generate leads
- ingest leads from external sources such as web forms, Google Forms, webhooks, imports, and similar channels

### Lead workspace requirements
Each lead should support:
- lifecycle status
- urgency / indicator status (separate from lifecycle)
- internal org-only notes
- full timestamped communication history
- recent communication context
- notes tied to calls or specific communication records
- human + bot continuity

### UI direction
Top-level UI should currently center around:
- Dashboard
- Leads
- Reports

The UI should remain easy to adjust through reusable components and shared design patterns.

### Future direction
- stronger reporting/exports
- richer org/permissions management
- gamification / achievements tied to useful behaviors
- broader lead generation and outreach workflows

## Immediate implementation focus

To make fast progress without wasting effort, priority should be:
1. improve the existing working app in this repo
2. preserve and integrate the newer product requirements from the OpenClaw workspace repo
3. avoid parallel rebuilding in multiple repos

## Immediate next implementation goals

- reconcile roles/permissions with the broader org-first model
- evolve lead detail into a more professional lead workspace
- add internal notes / richer communication log structure where missing
- improve navigation toward Dashboard / Leads / Reports
- keep the app presentable enough for partner/customer review
