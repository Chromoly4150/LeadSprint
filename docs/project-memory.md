# Project Memory

This file is the persistent working memory for LeadSprint.

Purpose:
- preserve product decisions across sessions
- avoid losing project direction when assistant memory/tools are unavailable
- keep a durable record inside the repo itself

How to use:
- append dated notes when the project direction changes
- record decisions, assumptions, open questions, and rejected ideas
- prefer concise factual updates over long transcripts

## Current understanding

### Product direction
LeadSprint is being developed as a **general-purpose lead contact application / platform** that can be sold as a service to businesses.

### Market starting point
Mortgage is the most natural starting point because the user has a mortgage background.

### Important constraint
In many cases, the practical customer is the **full brokerage**, not an individual loan officer, because an individual LO often cannot adopt unapproved software independently.

### Implication
The product should not be designed only for solo operators. It should be able to support team/brokerage use cases and eventually broader local-business or business-team use cases.

### Broader ambition
Although mortgage is a strong starting wedge, the project may expand into a more general-purpose platform for rapid lead discovery, qualification, contact preparation, and outreach support.

### Current selling point
A major near-term selling point is that the app will not only generate leads, but also **ingest leads from any source** (for example Google Form submissions, website submissions, and similar intake channels). If the submission contains sufficient information, a chatbot/automation layer should engage the lead within **5 minutes** so the lead stays hot and conversion likelihood remains high.

## Working hypotheses
- Start from a vertical where domain knowledge is strong.
- Avoid overfitting the product to a single solo-user workflow.
- Design toward organization-level usage, approval, and repeatable processes.
- Keep room for expansion beyond mortgage into other business categories.

## Access model / tenant model

### Organization-first design
The platform should be designed so that **any company type** can use it, not just mortgage firms.

### Core tenancy rule
- Every account belongs to an **Organization**.
- No Organization can exist without an **Owner**.
- The Owner has full privileges over organizational settings.

### Initial roles
- **Owner**
  - required for every organization
  - full access to organization settings
  - can add/remove users
  - can configure permissions
  - cannot be removed by admins
- **Admin**
  - broad organizational permissions similar to Owner
  - can manage users/settings within allowed scope
  - cannot remove or supersede the Owner
- **General User**
  - elevated permissions relative to Support User
  - intended for normal day-to-day platform usage
- **Support User**
  - more limited baseline permissions
  - intended for assisting with parts of the workflow
  - should be configurable so it can approach General User capabilities where needed, while still allowing specific restrictions

### Permission philosophy
Permissions will be defined later, but role separation matters because organizations may want some users to help operate the system without allowing sensitive actions like messaging leads.

### Architecture direction
The current preferred architecture is a **modular monolith**.

### Initial UI navigation
The initial top-level tabs should be:
- Dashboard
- Leads
- Reports

### Dashboard direction
The Dashboard should provide general overview metrics such as inbound leads over recent time windows (for example 30 days), conversion metrics, and other high-level summaries with sorting/time options.

### Leads direction
The Leads tab should show a sortable/filterable lead list.

Within each lead, there should be:
- internal org-only notes
- a full timestamped communication log
- visibility into the most recent discussion context for channels like email or SMS
- support for attaching notes to calls so call context is preserved

Initial sort options include:
- most recently received
- most recently managed/edited
- most recently contacted
- alphabetical

Initial filters should include:
- state
- lead status

The product should distinguish between:
- lifecycle status (for example New, Contacted, etc.)
- urgency/indicator status (for example Hot)

This separation matters because urgency is not the same as workflow state.

### Reports direction
The Reports tab should support reporting workflows such as export to spreadsheet, printable outputs, and other reporting needs to be refined later.

Example permission areas:
- user management
- organization settings
- lead/contact visibility
- lead editing
- campaign management
- integrated messaging (SMS, email, other)
- export/import actions
- billing or subscription access
- audit / reporting access

## Open questions
- Is the first sellable version an internal service tool, customer-facing software, or hybrid?
- What exact workflow is most valuable at the brokerage/team level?
- What parts of contact/outreach should be automated vs human-reviewed?
- What compliance/approval constraints matter for mortgage brokerages specifically?
- Should permissions be strictly role-based, custom permission-based, or hybrid (roles + overrides)?
