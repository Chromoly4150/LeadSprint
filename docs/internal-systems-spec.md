# LeadSprint Internal Systems Spec

## Status
Draft v1.

## Purpose
Define the three internal employee systems LeadSprint should operate with:
- **Sandbox**
- **Staging**
- **Admin**

Also define:
- internal employee roles
- support access / "View As" workflow
- approval and audit requirements
- implementation order

This spec exists because LeadSprint is no longer only a customer-facing app. It now also needs an internal operational layer for support, provisioning, troubleshooting, and safe testing.

---

## Core Principle
LeadSprint should treat internal testing and internal live operations as **different trust zones**.

These are not just different UI modes.
They should be treated as separate environments and separate risk levels.

---

# 1. Internal Environment Model

## 1.1 Sandbox

### Purpose
Safe UX testing for LeadSprint employees.

### Characteristics
- looks and feels like the real product
- contains fake workspaces, fake users, fake leads, fake inbox threads, fake reports
- no live customer accounts
- no live email or SMS sending
- no live provider side effects
- no production data

### Use cases
- onboarding flow testing
- UI/UX review
- QA regression testing
- employee training
- demoing product behavior internally
- reproducing bugs that do not depend on real integrations

### Rules
- should be impossible to impact real customers from Sandbox
- integrations should be stubbed or fully simulated
- all users in Sandbox are internal/test identities only
- clear environment banner required

### Recommended labeling
- “Sandbox — fake data / no live effects”

---

## 1.2 Staging

### Purpose
High-fidelity end-to-end testing using test identities with real infrastructure paths.

### Characteristics
- employee/test accounts only
- fake/test business accounts only
- real auth stack
- real provider connections where appropriate
- real delivery paths may be enabled in controlled ways
- no real customer data
- intended for integration validation rather than casual exploration

### Use cases
- email integration testing
- SMS integration testing
- webhook testing
- auth flow validation
- provider credential debugging
- pre-release smoke tests
- “does the entire chain work?” verification

### Rules
- staging is not production, but it is not toy-safe either
- employees must understand that real infrastructure may be active
- any live-channel sends should be restricted to approved test destinations
- clear environment banner required
- test accounts only; no customer production accounts mirrored here

### Recommended labeling
- “Staging — real systems, test identities only”

---

## 1.3 Admin

### Purpose
Internal live operations against production customer accounts and workspaces.

### Characteristics
- access to real request queues
- access to real customer accounts and workspace state
- support and troubleshooting actions
- provisioning and invitation repair
- request approval and follow-up workflow
- highest trust and highest risk internal surface

### Use cases
- review access requests
- approve/reject/follow-up on requests
- inspect account/workspace state
- repair broken provisioning
- resend or revoke invites
- troubleshoot user settings and account issues
- support-assisted “View As” access
- limited emergency operations

### Rules
- all actions must be authenticated, authorized, and audited
- high-risk actions should require stronger permissions
- destructive actions should be rare, separately gated, and explicitly logged
- this should be a separate internal product surface, not buried long-term inside customer settings

### Recommended labeling
- “Admin — live customer operations”

---

# 2. Product Surface Model

LeadSprint should think in terms of at least two product surfaces:

## 2.1 Customer-facing app
For customers and invited workspace members.

Examples:
- request access
- sign in
- sign up / activation flow
- leads workspace
- inbox
- reports
- customer settings

## 2.2 Internal admin surface
For LeadSprint employees only.

Examples:
- access request review queue
- account lookup
- workspace lookup
- provisioning debugger
- invite management
- support access request workflow
- audit logs
- internal operational controls

### Recommendation
In the near term, Admin can live in the same repo and deployment family.
Long term, it should become a clearly separated route group or subdomain.

Suggested examples:
- `/admin`
- `admin.leadsprint.com`

---

# 3. Internal Employee Roles

LeadSprint should not give all employees identical internal powers.
The internal admin system should use role-based permissions.

## 3.1 Support Agent

### Responsibilities
- search for users and workspaces
- inspect account state
- inspect request state
- inspect invite state
- perform low-risk support actions
- request “View As” access when needed

### Allowed examples
- view account/workspace metadata
- view request and invite history
- resend invite
- update limited non-sensitive user/workspace settings
- create support notes
- request impersonation / support access

### Not allowed by default
- approve or reject high-impact requests without policy
- delete users
- delete workspaces
- access provider secrets
- access deep auth/provider logs
- unrestricted impersonation

---

## 3.2 Support Admin

### Responsibilities
- handle escalated support operations
- manage request review queue
- approve some support access requests
- perform broader account repair

### Allowed examples
- approve/reject/follow-up access requests
- activate/deactivate certain accounts
- repair invite state
- repair provisioning state
- approve eligible “View As” sessions
- edit broader support-relevant settings

### Not allowed by default
- unrestricted platform operations
- secret management
- highly destructive account deletion without extra permission

---

## 3.3 Ops Admin

### Responsibilities
- investigate platform/integration issues
- support auth/provider troubleshooting
- handle deeper operational incidents

### Allowed examples
- inspect Clerk linkage/debug state
- inspect provider integration state
- inspect internal system diagnostics
- repair broken auth/provisioning mappings
- assist with staging/production integration issues

### Not allowed by default
- automatic unrestricted destructive actions unless also granted separately

---

## 3.4 Super Admin

### Responsibilities
- highest-risk operational access
- emergency support and repair
- exceptional destructive or bypass operations

### Allowed examples
- approve any support access request
- impersonate any allowed account type
- perform destructive recovery actions
- force-fix broken mappings
- access sensitive operational logs
- manage internal employee permissions

### Requirements
- must be heavily audited
- should be very limited in count
- should use stronger authentication controls over time

---

# 4. Permission Categories

Internal permissions should be separated by risk type, not just feature area.

## 4.1 Support Read Permissions
Examples:
- view user account
- view workspace
- view access request
- view invitations
- view non-sensitive settings
- view customer-visible state

## 4.2 Support Write Permissions
Examples:
- resend invite
- update limited settings
- repair request status
- mark follow-up needed
- add internal support note

## 4.3 Provisioning Permissions
Examples:
- approve request
- reject request
- activate/deactivate account
- repair workspace linkage
- repair invite acceptance state

## 4.4 Sensitive Platform Permissions
Examples:
- inspect Clerk linkage/logs
- inspect provider connection state
- access system diagnostics
- debug integration failures
- manage internal provider settings

## 4.5 Dangerous Permissions
Examples:
- delete user
- delete workspace
- force role reassignment
- bypass normal approval flow
- unrestricted live impersonation
- perform irreversible operations

### Recommendation
Dangerous permissions should be rare, explicit, and never implied by basic support access.

---

# 5. Support “View As” Workflow

## 5.1 Purpose
Allow LeadSprint employees to inspect or operate within a customer account context for support and troubleshooting.

## 5.2 Principle
“View As” should not be a casual toggle.
It should be a governed support-access workflow.

## 5.3 Required inputs
Before a support employee can start a “View As” session, they must provide:
- target user or workspace
- ticket URL
  - e.g. Zendesk or Freshdesk
- reason for access
- expected duration

### Standard operating procedure
Default expectation:
- employee includes the support ticket link they are actively handling
- reason should explain what is being diagnosed or verified

Example reasons:
- reproduce customer-reported onboarding failure
- verify workspace setting mismatch
- inspect broken invite acceptance flow
- confirm issue after support-side repair

---

## 5.4 Approval model

### Default recommendation
Support access requests should be policy-backed and approval-driven.

Possible rules:
- low-risk “View As” for standard support accounts may be auto-approved for Support Admins
- higher-risk access requires explicit approval from Support Admin or Super Admin
- sensitive accounts or high-privilege targets require stricter approval

### Approval record should capture
- requester
- approver
- target account/workspace
- ticket URL
- reason
- time granted
- expiration time

---

## 5.5 Session constraints
All “View As” sessions should be:
- time-limited
- clearly visible
- fully audited

### Recommended defaults
- duration: 15–30 minutes
- auto-expire after time limit
- explicit re-request required after expiration

### UX requirements
- persistent banner such as:
  - “Support View As active — viewing as [user/workspace]”
- obvious exit control
- visible ticket reference when possible

---

## 5.6 Mode variants

### Read-only support view
Lower-risk mode.
Recommended as default.

Use for:
- inspecting configuration
- reproducing display/state bugs
- checking request/invite state

### Elevated support action mode
Higher-risk mode.
Should require stronger permission and possibly additional approval.

Use for:
- making changes while in user context
- testing user-visible settings changes
- reproducing action-specific bugs

### Recommendation
Start with read-only support view as the default implementation.
Layer elevated in-context actions later.

---

## 5.7 Audit requirements
Every “View As” event must be logged.

### Must log
- requester employee id
- approver employee id if applicable
- target user/workspace
- ticket URL
- reason
- start time
- end time / expiration time
- actions taken during session

### Important
The audit trail should make it possible to answer:
- who accessed the account
- why they accessed it
- under what ticket
- what they did while access was active

---

# 6. Admin App Functional Scope

## 6.1 V1 Admin capabilities

### Access request queue
- pending
- needs follow-up
- approved
- rejected
- request details and notes
- request history

### Account and workspace lookup
- search by email
- search by workspace name
- search by request id
- view user/workspace/request linkage

### Provisioning debugger
- Clerk user id
- internal user id
- workspace id
- request status
- invite status
- role/status mapping
- recent provisioning-related actions

### Invite management
- view invites
- resend invite
- revoke invite
- inspect acceptance failures

### Support actions
- limited account repair
- limited settings repair
- support notes / operational notes
- request “View As” access

### Audit view
- approvals
- request state changes
- invite changes
- support access requests
- impersonation sessions
- destructive actions

---

## 6.2 Later Admin capabilities
- internal employee permission management
- provider troubleshooting console
- auth linkage repair tools
- system diagnostics dashboard
- manual job replay tools
- customer communication history debugging

---

# 7. Environment Safety Requirements

## 7.1 Visual separation
Every environment should have a clear banner/color scheme so employees cannot confuse:
- Sandbox
- Staging
- Admin / live production

## 7.2 Data separation
Sandbox and Staging should not share production customer data.

## 7.3 Credential separation
Each environment should have separate:
- auth config where appropriate
- provider credentials
- API secrets
- databases
- storage buckets if used

## 7.4 Delivery controls
In Staging, real channel delivery should be constrained to approved test destinations whenever possible.

---

# 8. Recommended Implementation Order

## Phase A — Formalize Admin as a first-class surface
1. create `/admin` route group
2. move access request review out of customer Settings
3. add internal-only gating
4. add basic audit logging for admin actions

## Phase B — Build internal support lookup and provisioning tools
1. account/workspace search
2. request/invite search
3. provisioning debugger view
4. limited support actions

## Phase C — Add support access request workflow
1. create “View As request” object/model
2. require ticket URL + reason + target + duration
3. build approval workflow
4. add session banners and expiration
5. log all access sessions

## Phase D — Environment hardening
1. define Sandbox and Staging standards
2. separate credentials/config cleanly
3. add strong environment labeling
4. restrict live-like deliveries in staging to approved test targets

## Phase E — Internal role hardening
1. define employee permission matrix in code
2. separate support read, support write, provisioning, sensitive, dangerous permissions
3. restrict Super Admin access to a small set of trusted employees

---

# 9. Explicit Decisions From This Discussion

The following decisions are now proposed as current direction:

- LeadSprint should operate with **three internal systems**:
  - Sandbox
  - Staging
  - Admin
- LeadSprint should continue to own workspace/org logic internally rather than relying on Clerk Organizations as the product source of truth
- “Support View As” should exist, but it must be:
  - requested
  - reasoned
  - ticket-linked
  - time-limited
  - audited
- Internal employees should have tiered permissions rather than universal admin powers
- Customer Settings should not become the long-term home for internal operational tooling; a dedicated Admin surface should exist

---

# 10. Summary
LeadSprint should be built as:
- a customer-facing app
- an internal admin/support app
- supported by separate Sandbox and Staging environments

This is not unnecessary complexity.
It is the normal structure of a product that now has:
- customer onboarding
- approvals
- support operations
- internal troubleshooting
- live account intervention
- integration testing needs

The next practical move is to begin a dedicated `/admin` surface and move request review there first.
