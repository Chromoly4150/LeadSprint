# UI Screens and Layout Proposal

## Goal

Define the first practical UI surface for LeadSprint so product and engineering can align on what users actually see and do.

---

## Top-level navigation

Initial top-level tabs:
- **Dashboard**
- **Leads**
- **Reports**

Likely account/menu areas outside the top nav:
- organization switcher or org label
- user menu
- settings entry point
- notifications/activity indicator

Future additions may include dedicated tabs for conversations, integrations, campaigns, or settings, but they do not need to be first-class top-nav items on day one.

---

## 1. Dashboard

## Purpose
Give users a high-level operating view of recent lead activity and performance.

## Suggested sections

### KPI row
Examples:
- inbound leads last 7 / 30 days
- hot leads currently awaiting action
- contacted leads
- conversion rate
- average first-response time
- SLA met vs missed

### Trend/summary area
Examples:
- leads by day/week
- conversions over time
- hot lead volume trend
- source breakdown

### Operational widgets
Examples:
- leads needing attention
- SLA-risk leads
- recent conversations
- recent form/webhook intake
- assigned vs unassigned leads

## Interaction ideas
- date range selector
- source filter
- state/region filter
- assigned-user filter

## Role-sensitive behavior
- Owners/Admins may see org-wide metrics
- General/Support users may see team-scoped or assigned-work views

---

## 2. Leads

## Purpose
Primary operational workspace for day-to-day lead handling.

## Layout recommendation

Use a **two-level experience**:
1. lead list/index view
2. lead detail workspace

### Lead list view
A table/list with:
- search
- filters
- sort controls
- bulk actions later if needed

### Suggested default columns
- lead name
- company / account
- contact info summary
- source
- state/location
- lifecycle status
- urgency indicator
- assigned user
- received at
- last contacted at
- last activity at

### Suggested initial sort options
- newest received
- most recently managed/edited
- most recently contacted
- alphabetical

### Suggested initial filters
- state
- lifecycle status
- urgency/indicator status
- source
- assigned user
- date range

### Visual treatment recommendation
Lifecycle status and urgency should be visually separate.

Example:
- `New` as a workflow badge
- `Hot` as a colored urgency chip

That makes the distinction obvious.

---

## Lead detail workspace

A lead should open into a detail page or split-panel workspace.

## Recommended sections

### A. Header / identity block
Show:
- name
- company
- source
- lifecycle status
- urgency indicator
- owner/assignee
- received time
- quick actions

Quick actions might include:
- assign
- change status
- mark hot/warm/cold
- start/take over conversation
- export record

### B. Overview panel
Show:
- contact details
- location/state
- notes
- intake summary
- source metadata
- tags

### C. Activity / timeline panel
Show chronological events such as:
- lead received
- automation triggered
- first response sent
- status changes
- assignment changes
- user notes
- follow-up actions

### D. Conversation panel
This is important enough that it should be built into the lead detail experience from the start.

Show:
- thread/messages
- bot vs human message distinction
- timestamps
- takeover controls
- send box if user has permission

### E. Qualification / workflow panel
Show:
- required follow-up items
- qualification fields
- booking/next-step info
- SLA state
- conversion notes

## Recommendation
Do **not** hide the conversation in a separate product area at first.

For MVP, conversation should live inside the lead detail experience, because the whole product revolves around keeping inbound leads warm and handing them off cleanly.

---

## 3. Reports

## Purpose
Allow users to view/export reporting outputs and operational summaries.

## Recommended starting structure

### Reports list / templates
- saved reports
- common canned reports
- recent exports

### Report builder (simple at first)
Options such as:
- date range
- source
- state/location
- lead status
- assigned user
- conversion stage

### Output actions
- export CSV/spreadsheet
- print-friendly view
- maybe email/download later

## Suggested initial report types
- inbound leads by period
- lead status breakdown
- source performance
- first-response SLA report
- conversion summary
- assigned-user activity summary

---

## Hidden-but-needed settings areas

Not necessarily top tabs yet, but the app will likely still need screens for:
- organization settings
- users & roles
- integrations / sources
- messaging configuration
- permissions

These can live under a settings menu initially.

---

## Design principles

- optimize for speed and clarity
- keep hot-lead urgency visible
- avoid overwhelming users with too many first-release surfaces
- let list views feed directly into action views
- keep the human handoff experience obvious and frictionless

---

## Open UI questions

- should the Leads area use table view only, or offer board/list toggles later?
- what exact badge colors should distinguish urgency from lifecycle?
- should SLA-risk be a separate indicator or part of urgency?
- what should the default lead detail layout be on smaller screens?
- when does Conversations deserve its own top-level tab?
