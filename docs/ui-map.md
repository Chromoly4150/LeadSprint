# UI Map

## Initial top-level tabs

The initial app should start with these top-level tabs:
- **Dashboard**
- **Leads**
- **Reports**

More tabs can be added later as the product expands.

---

## 1. Dashboard

Purpose:
- give users a general overview of organizational lead activity and performance

Initial ideas:
- inbound leads for the last 30 days
- conversion metrics
- summary activity views
- sortable/high-level time windows

Notes:
- exact metrics and widgets can be refined later
- dashboard should prioritize quick situational awareness, not deep workflow management

---

## 2. Leads

Purpose:
- primary working area for lead operations

Core view:
- a lead list/table
- sortable and filterable
- supports moving from list view into lead detail / conversation work

### Initial sort options
- most recently received
- most recently managed/edited
- most recently contacted
- alphabetical

Additional sort options can be added later.

### Initial filters
- state
- lead status
- other filters to be defined later

### Status concepts
Need at least two layers of status thinking:

#### A. Workflow / lifecycle status
Examples:
- New
- Contacted
- In Progress
- Qualified
- Unresponsive
- Converted
- Closed / Disqualified

#### B. Urgency / indicator status
Examples:
- Hot
- Warm
- Cold
- Needs Attention
- SLA Risk

Reason:
A lead can be in one lifecycle state while separately having an urgency indicator.

Example:
- a lead could be `Contacted` and still be `Hot`
- a lead could be `New` but not urgent

This separation should be preserved in the product model and UI.

---

## 3. Reports

Purpose:
- create and review reporting outputs
- support data export and printable/reportable views

Initial ideas:
- export data as spreadsheet
- print data/report views
- generate summary reporting based on lead and conversion activity

Notes:
- reporting requirements can be refined later
- initial reports should likely focus on practical operational outputs before complex analytics

---

## Open UI questions

- Should conversation activity appear directly inside the Leads area, or eventually deserve its own tab?
- Should the Dashboard be role-sensitive (different views for Owner/Admin vs General/Support)?
- What default columns should appear in the lead list?
- How should hot/SLA-risk leads be visually highlighted?
- Should reports be mostly saved exports, or also interactive dashboards?
