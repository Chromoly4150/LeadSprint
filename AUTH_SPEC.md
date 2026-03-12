# LeadSprint Auth & Onboarding Product Spec

## Status
Draft for implementation.

## Purpose
Define how authentication, onboarding, workspace creation, business verification, user invitations, and access approval should work in LeadSprint.

This spec intentionally separates:
- **Authentication**: proving who someone is
- **Provisioning / Access**: deciding what type of workspace they get and whether they should be allowed into the app
- **Authorization**: what they can do after access is granted

---

## V1 Decisions

### Authentication provider
- **Clerk**

### V1 sign-in methods
- Email + password
- Google

### Not in V1
- Apple Sign In
- Passkeys
- Magic links
- MFA enforcement
- Multi-provider account linking

### Account method rule
Each account has **one active auth method at a time**.

Examples:
- password account
- Google account

Switching auth methods later should be supported intentionally in settings, but is **not required for initial V1**.

---

## Workspace Classes

LeadSprint should support two different workspace classes.

### 1. Individual workspace
For:
- sole proprietors
- solo operators
- one-person use

Rules:
- does **not** require formal business verification to start
- intended for one user only
- cannot invite/add teammates
- may later need a manual migration or a new workspace/account if upgrading to a verified business workspace

### 2. Verified business workspace
For:
- LLCs
- corporations
- formal business entities
- teams
- businesses represented by an authorized person

Rules:
- requires manual review
- requires proof the business exists
- requires proof the requester is authorized to act on behalf of the business
- can invite/add users after approval

---

## Core Product Principles

1. Authentication should be easy and low-friction.
2. Authentication alone does **not** grant product access.
3. Users may be trying to:
   - create an individual workspace for themselves
   - request creation of a verified business workspace
4. Existing business org members should not self-join publicly.
5. LeadSprint must control workspace provisioning and role assignment.
6. Team expansion should be handled by the workspace itself, via invitations.
7. The product should support a very small team operating approvals manually at first.
8. The system should be extensible later for:
   - Apple/passkeys/MFA
   - richer billing/plan logic
   - more polished approval workflows

---

## User States

Every person should be in one of these states:

### 1. Unauthenticated
- Not signed in with Clerk
- Can access public auth routes only

### 2. Authenticated, not onboarded
- Has a Clerk identity/session
- Has not yet completed setup or submitted a business request
- Cannot access the main app

### 3. Pending review
- Submitted a verified business workspace request
- Awaiting manual review/provisioning
- Cannot access the main app for that business workspace yet

### 4. Needs follow-up
- Business request needs clarification or additional documentation
- Cannot access the main app for that business workspace until resolved

### 5. Rejected
- Business request denied
- Cannot access the requested business workspace

### 6. Approved / Provisioned
- Mapped to a LeadSprint workspace and user record
- Assigned a role
- Allowed into main app

---

## Public Experience

### Public website entry
The public site should expose:
- Home
- About
- Support / Contact
- Request Access
- Sign In

It should **not** treat generic product sign-up as the main public CTA.

### Authentication entry
Users should be able to:
- Sign in with email/password
- Sign in with Google

Account creation should be framed as a controlled path for:
- approved users
- invited users

The auth page should remain simple and non-technical.

Suggested framing:
- "Sign in to LeadSprint"
- "Request access"

---

## Access Model

### Important rule
A successful Clerk sign-in does **not** automatically create a fully active LeadSprint team workspace.

After auth, the system must determine whether the person:
- already belongs to an approved workspace
- should create an individual workspace
- should request creation of a verified business workspace

### Important rule for employees / teammates
Users who are joining an existing verified business workspace should **not** go through a public join request flow.

They should only gain access by:
- invite from an owner/admin
- later, approved bulk import/invite by an owner/admin

---

## Public Onboarding Paths

### Path 1: Individual workspace request
A public visitor can request or begin setup for an **individual workspace** for solo use.

### Path 2: Verified business workspace request
A public visitor can request creation of a **verified business workspace**.
This requires manual review.

### Not a public path in V1
- public self-service joining of an existing org/workspace
- generic unrestricted account sign-up as a public marketing CTA

If a person works for a company that already uses LeadSprint, they should be told:
- ask your workspace owner/admin for an invite

If a person is not yet approved or invited, they should be directed to:
- request access first

---

## Individual Workspace Onboarding

### Purpose
Allow solo users and sole proprietors to start quickly without heavy business verification.

### Rules
- one user only
- no team invites
- no adding employees/users
- can use LeadSprint personally/solo

### Suggested setup fields
- Full name
- Email
- Workspace / business name (can be individual-facing)
- Line of business
- What they want to use LeadSprint for
- Optional note

### Important product note
If an individual later wants to become a verified business workspace with multiple users, that upgrade path is **not guaranteed to be seamless in V1**.
It may require manual migration or a new workspace/account setup.

---

## Verified Business Workspace Request

### Purpose
Allow a real business or organization to request a multi-user workspace.

### Business verification requirement
The requester must provide enough information for LeadSprint to determine:
1. the business/entity is real
2. the requester is authorized to act on its behalf

### This does NOT require literal ownership only
A valid requester could be:
- owner/founder
- manager
- operations/admin lead
- delegated representative
- another person authorized to set up software on behalf of the organization

### Suggested request fields
#### Identity / requester
- Full name
- Work email
- Role/title

#### Organization
- Organization name
- Website
- Line of business / industry
- Team size
- Brief description of intended use

#### Feature / plan signals
- What services/features they need
  - Lead intake
  - Inbox / communications
  - Outbound email
  - Reporting
  - Automation
  - Team collaboration

#### Verification / authority
- Confirmation that they are authorized to set up the workspace on behalf of the business
- Supporting documentation upload or submission details
- Optional supporting contact or note

### Examples of acceptable verification/supporting evidence
- articles of incorporation
- LLC formation docs
- business registration documents
- official business documentation
- other supporting material showing business existence and authority to act

V1 review can remain fully manual.

---

## Request Submission Outcomes

After a verified business request is submitted, the user should see a clear confirmation state.

### Confirmation page should communicate
- request received
- business/workspace name
- email used
- that access will be activated after review

For individual workspace setup, if no review is required, the user can proceed directly into their solo workspace after creation.

---

## Pending State UX

If the user comes back before a business request is approved, show:
- request status = pending
- business/workspace name
- submitted date
- optional ability to update limited fields later

The product should avoid vague "access denied" messaging.

---

## Needs Follow-up State UX

If the business request needs more info, show:
- clear explanation that additional information is needed
- optional prompt to edit/resubmit request
- no main app access for that workspace until resolved

---

## Rejected State UX

If the business request is rejected, show:
- a clean explanation that access was not approved
- optionally a support/contact path

No generic crash or confusing auth loop.

---

## Approval / Provisioning Rules

### Individual workspace approval/creation
If the user chooses an individual workspace path and no manual review is required:
1. create individual workspace
2. create LeadSprint user record
3. assign role = `owner`
4. connect the Clerk user to that LeadSprint user
5. mark workspace type = `individual`
6. enforce no-user-invite restriction

### Verified business workspace approval
Approval should:
1. confirm business exists
2. confirm requester is authorized to act on behalf of the business
3. create business workspace/org
4. create LeadSprint user record
5. assign role = `owner`
6. connect the Clerk user to that LeadSprint user
7. mark workspace type = `business_verified`
8. mark request approved

---

## Employee / Team Member Access

### Rule
Employees or teammates should not create access through the public onboarding flow.

### Entry path
They must be brought in by a verified business workspace via:
- individual invite
- later, bulk invite/import

### First invited-user capability target
Owners/admins should be able to invite a single user by email.

### Later capability target
Owners/admins should be able to bulk onboard users by:
- pasting a list of emails
- CSV/spreadsheet upload

---

## Main App Access Rule

A user may enter the main LeadSprint app only if:
- they are authenticated with Clerk
- they are provisioned as a LeadSprint user
- that LeadSprint user is active

Otherwise they should be routed to:
- sign-in
- individual setup
- business request flow
- pending status
- follow-up state
- rejected state

depending on their current status.

---

## Authorization Model

LeadSprint authorization remains application-owned.

### LeadSprint continues to own
- users
- workspaces / organizations
- roles
- statuses
- permission overrides
- feature/business access
- workspace type restrictions

### Existing roles
- owner
- admin
- agent

### Existing statuses
- active
- deactivated
- suspended

Authentication should not replace this role/permission system.

### Workspace-type capability rule
- individual workspaces cannot add/invite users
- verified business workspaces can invite/manage users after approval

---

## Admin / Review Workflow (V1)

### Manual review is acceptable in V1
Given the team size, business-workspace approvals can be handled manually at first.

### Reviewer actions needed
- approve verified business request
- reject request
- mark request as needs follow-up

### Reviewer information needed
- full name
- email
- role/title
- business/workspace name
- line of business
- requested features/services
- team size
- notes
- submitted verification materials / supporting docs

This can begin as a simple internal/admin workflow rather than a polished full-featured dashboard.

---

## Pricing / Plan Considerations

The business request form may capture information that is useful later for:
- plan qualification
- service tiering
- sales qualification
- support expectations

However, the V1 request form should avoid becoming overly long or intimidating.

### Recommendation
Collect enough data to make provisioning and commercial decisions later, but keep the initial form concise.

---

## Future Signup Mode Strategy

The product should be designed so onboarding policy can evolve later.

### Possible future modes
- `individual_open_business_request`
- `request_access_only`
- `invite_only`
- `open_org_creation` (less likely / more risky)

For this current plan:
- individuals may start as solo users
- verified business workspaces require review
- teammates join by invite only

---

## Out of Scope for V1

- Apple login
- passkeys
- magic links
- linked multiple auth methods per account
- MFA enforcement
- fully automated business verification
- public self-service joining of existing orgs
- seamless guaranteed individual→business upgrade
- automated pricing assignment
- bulk spreadsheet onboarding in the first cut unless time allows

---

## V1 Success Criteria

V1 is successful when:
- users can sign in/sign up with email/password or Google using Clerk
- a solo user can create an individual workspace
- a business requester can submit a verified business workspace request
- verified business requests can be manually approved based on business existence + authority to act
- approved business requesters are provisioned correctly into business workspaces as owners
- only verified business workspaces can invite/add users
- employees/team members enter existing workspaces by invite, not public join request
- only approved/provisioned users enter the main app
- existing LeadSprint permissions still govern app behavior after access is granted
