# LeadSprint Auth & Onboarding Product Spec

## Status
Draft for implementation.

## Purpose
Define how authentication, onboarding, org creation, org joining, and access approval should work in LeadSprint.

This spec intentionally separates:
- **Authentication**: proving who someone is
- **Provisioning / Access**: deciding what workspace/org they belong to and whether they should be allowed into the app
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

## Core Product Principles

1. Authentication should be easy and low-friction.
2. Authentication alone does **not** grant product access.
3. Users may be trying to:
   - create a new organization/workspace
   - join an existing organization/workspace
4. LeadSprint must control org provisioning and role assignment.
5. The product should support a very small team operating approvals manually at first.
6. The system should be extensible later for:
   - request-access mode changes
   - better pricing/plan qualification
   - Apple/passkeys/MFA

---

## User States

Every person should be in one of these states:

### 1. Unauthenticated
- Not signed in with Clerk
- Can access public auth routes only

### 2. Authenticated, not onboarded
- Has a Clerk identity/session
- Has not yet submitted a completed onboarding/access request
- Cannot access the main app

### 3. Pending review
- Submitted onboarding/access request
- Awaiting manual review/provisioning
- Cannot access the main app

### 4. Needs follow-up
- Request needs clarification or more info
- Cannot access the main app until resolved

### 5. Rejected
- Request denied
- Cannot access the main app

### 6. Approved / Provisioned
- Mapped to a LeadSprint org and user record
- Assigned a role
- Allowed into main app

---

## Public Experience

### Authentication entry
Users should be able to:
- Sign in with email/password
- Sign in with Google
- Create an account with email/password
- Continue with Google for new account creation

The auth page should remain simple and non-technical.

Suggested framing:
- "Sign in to LeadSprint"
- "Create your account"

---

## Access Model

### Important rule
A successful Clerk sign-in does **not** automatically create a fully active LeadSprint workspace or membership.

Instead, after auth, the system must determine whether the person:
- already belongs to an approved org/workspace
- needs to request creation of a new org
- needs to request access to join an existing org

---

## Onboarding / Access Request Flow

### Entry condition
If a user is authenticated with Clerk but is not yet provisioned in LeadSprint, they are sent into the onboarding/access flow.

### Primary branching question
The user must choose one of:
- **Create a new organization**
- **Join an existing organization**

---

## Request Form: Create a New Organization

### Required / recommended fields
- Full name
- Work email
- Organization name
- Line of business / industry

### Helpful optional or near-required fields
- Organization website
- Team size
- What services/features they need
- Notes / special requests

### Possible feature selection examples
- Lead intake
- Inbox / communications
- Outbound email
- Reporting
- Automation
- Team collaboration

### Purpose of this data
Used to:
- create the correct org/workspace
- understand usage and needs
- support future pricing/plan design
- avoid provisioning bad-fit or incomplete accounts blindly

---

## Request Form: Join an Existing Organization

### Required / recommended fields
- Full name
- Work email
- Organization name

### Helpful optional fields
- Name/email of person they work with or who invited them
- Expected role (owner/admin/agent/not sure)
- Notes

### Purpose of this data
Used to:
- identify target org
- avoid duplicate org creation
- determine appropriate role and approval path

---

## Request Submission Outcomes

After submission, the user should see a clear confirmation state.

### Confirmation page should communicate
- request received
- whether request is for org creation or org joining
- what email was used
- that access will be activated after review

---

## Pending State UX

If the user comes back before approval, show:
- request status = pending
- request type = create org / join org
- organization name
- submitted date
- optional ability to update limited fields later

The product should avoid vague "access denied" messaging.

---

## Needs Follow-up State UX

If the request needs more info, show:
- clear explanation that additional information is needed
- optional prompt to edit/resubmit request
- no main app access until resolved

---

## Rejected State UX

If the request is rejected, show:
- a clean explanation that access was not approved
- optionally a support/contact path

No generic crash or confusing auth loop.

---

## Approval / Provisioning Rules

### If request type = Create New Organization
Approval should:
1. create organization/workspace
2. create LeadSprint user record
3. assign role = `owner`
4. connect the Clerk user to that LeadSprint user
5. mark request approved

### If request type = Join Existing Organization
Approval should:
1. identify existing org
2. create or attach LeadSprint user record
3. assign appropriate role (likely `agent` by default unless manually changed)
4. connect the Clerk user to that LeadSprint user
5. mark request approved

---

## Main App Access Rule

A user may enter the main LeadSprint app only if:
- they are authenticated with Clerk
- they are provisioned as a LeadSprint user
- that LeadSprint user is active

Otherwise they should be routed to:
- sign-in
- request access
- pending status
- follow-up state
- rejected state

depending on their current status.

---

## Authorization Model

LeadSprint authorization remains application-owned.

### LeadSprint continues to own
- users
- organizations
- roles
- statuses
- permission overrides
- feature/business access

### Existing roles
- owner
- admin
- agent

### Existing statuses
- active
- deactivated
- suspended

Authentication should not replace this role/permission system.

---

## Admin / Review Workflow (V1)

### Manual review is acceptable in V1
Given the team size, approvals can be handled manually at first.

### Reviewer actions needed
- approve request as new org owner
- approve request into existing org
- reject request
- mark request as needs follow-up

### Reviewer information needed
- full name
- email
- request type
- org name
- line of business
- requested features/services
- team size
- notes

This can begin as a simple internal/admin workflow rather than a polished full-featured dashboard.

---

## Pricing / Plan Considerations

The request form may capture information that is useful later for:
- plan qualification
- service tiering
- sales qualification
- support expectations

However, the V1 request form should avoid becoming overly long or intimidating.

### Recommendation
Collect enough data to make provisioning and commercial decisions later, but keep the initial form concise.

---

## Signup Mode Strategy

The product should be designed so signup mode can evolve later.

### Likely future modes
- `request_access` (recommended initial product behavior)
- `open_org_creation` (possible later)
- `invite_only` (possible later)

For this current plan, users can authenticate publicly, but app access is gated by provisioning and request review.

---

## Out of Scope for V1

- Apple login
- passkeys
- magic links
- linked multiple auth methods per account
- MFA enforcement
- self-service org creation without review
- automated pricing assignment
- self-serve org joining without review

---

## V1 Success Criteria

V1 is successful when:
- users can sign in/sign up with email/password or Google using Clerk
- unprovisioned users are routed into a clear onboarding/access request flow
- create-org and join-org requests are both supported
- approved users are provisioned correctly into orgs and roles
- only approved/provisioned users enter the main app
- existing LeadSprint permissions still govern app behavior after access is granted
