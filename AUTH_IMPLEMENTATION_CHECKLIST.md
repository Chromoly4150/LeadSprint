# LeadSprint Auth Implementation Checklist

## Goal
Implement Clerk-based authentication plus gated onboarding/provisioning for LeadSprint.

This checklist follows the current product decisions:
- Clerk for auth
- V1 auth methods: email/password + Google
- authenticated users do not get app access automatically
- onboarding supports:
  - individual workspace creation
  - verified business workspace requests
- existing org/team members do not self-join publicly
- only verified business workspaces can invite/add users

---

## Phase 0 — Freeze scope
- [ ] Review and accept `AUTH_SPEC.md`
- [ ] Confirm V1 auth methods: email/password + Google
- [ ] Confirm workspace classes:
  - [ ] individual
  - [ ] business_verified
- [ ] Confirm business verification rule:
  - [ ] verify business exists
  - [ ] verify requester is authorized to act on behalf of business
- [ ] Confirm employee/team-member onboarding rule: invite-only
- [ ] Confirm manual approval in V1 for business workspaces

---

## Phase 1 — Clerk platform setup
- [ ] Create Clerk application/project
- [ ] Enable email/password auth in Clerk
- [ ] Enable Google auth in Clerk
- [ ] Configure local development URLs
- [ ] Configure Render production URLs
- [ ] Record required Clerk environment variables

### Expected env vars (web)
- [ ] `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- [ ] `CLERK_SECRET_KEY`

### Internal bridge env vars
- [ ] `INTERNAL_API_AUTH_SECRET` in web
- [ ] `INTERNAL_API_AUTH_SECRET` in api

---

## Phase 2 — Database schema changes

### Users table
- [ ] Add migration to `users` table:
  - [ ] `clerk_user_id TEXT UNIQUE NULL`

### Organizations / workspace metadata
- [ ] Add workspace/org type support if not already present
  - [ ] `workspace_type` or equivalent
  - expected values:
    - [ ] `individual`
    - [ ] `business_verified`

### Business workspace requests table
- [ ] Add migration for `access_requests` or `business_workspace_requests`

Suggested fields:
- [ ] `id`
- [ ] `clerk_user_id`
- [ ] `email`
- [ ] `full_name`
- [ ] `role_title`
- [ ] `organization_name`
- [ ] `website`
- [ ] `line_of_business`
- [ ] `requested_features_json`
- [ ] `team_size`
- [ ] `authority_attestation`
- [ ] `verification_notes` or `verification_materials_json`
- [ ] `notes`
- [ ] `status`
- [ ] `review_notes`
- [ ] `reviewed_by_user_id`
- [ ] `reviewed_at`
- [ ] `created_at`
- [ ] `updated_at`

### Invitation table (if not already present)
- [ ] add user invitation model/table for future or immediate use

Suggested fields:
- [ ] `id`
- [ ] `organization_id`
- [ ] `email`
- [ ] `role`
- [ ] `status`
- [ ] `invited_by_user_id`
- [ ] `accepted_by_user_id` nullable
- [ ] `created_at`
- [ ] `updated_at`
- [ ] `expires_at` optional

### Optional indexes / constraints
- [ ] index `clerk_user_id`
- [ ] index `email`
- [ ] index `status`

---

## Phase 3 — Clerk integration in web
- [ ] Install Clerk packages in `apps/web`
- [ ] Wrap app with Clerk provider
- [ ] Add Clerk middleware / route protection entry point
- [ ] Add sign-in route/page
- [ ] Add sign-up route/page
- [ ] Add sign-out flow

### Files likely involved
- [ ] `apps/web/src/app/layout.tsx`
- [ ] `apps/web/src/middleware.ts` (or Clerk equivalent)
- [ ] `apps/web/src/app/sign-in/[[...sign-in]]/page.tsx`
- [ ] `apps/web/src/app/sign-up/[[...sign-up]]/page.tsx`

---

## Phase 4 — Provisioning status resolution
- [ ] Create helper in web to get current Clerk user
- [ ] Create helper to ask API for provisioning status
- [ ] Define user states in code:
  - [ ] unauthenticated
  - [ ] authenticated_not_onboarded
  - [ ] individual_ready
  - [ ] business_request_pending
  - [ ] business_request_needs_follow_up
  - [ ] business_request_rejected
  - [ ] approved
- [ ] Route users based on those states

### New files likely
- [ ] `apps/web/src/lib/auth/clerk-user.ts`
- [ ] `apps/web/src/lib/auth/provisioning.ts`

---

## Phase 5 — Onboarding UI
- [ ] Build onboarding choice page
- [ ] Add path for:
  - [ ] create individual workspace
  - [ ] request verified business workspace
- [ ] Add clear messaging that joining an existing business workspace requires an invite
- [ ] Build individual workspace setup form
- [ ] Build verified business request form
- [ ] Build submission confirmation page
- [ ] Build pending status page
- [ ] Build needs-follow-up page
- [ ] Build rejected page

### Routes/pages likely
- [ ] `/onboarding`
- [ ] `/onboarding/individual`
- [ ] `/onboarding/business`
- [ ] `/pending-access`
- [ ] `/access-status`

---

## Phase 6 — Onboarding / provisioning API endpoints

### Authenticated but unprovisioned endpoints
These should be usable by Clerk-authenticated users even if they are not yet full LeadSprint users.

- [ ] `GET /api/access/me`
  - returns provisioning/request status for current Clerk user
- [ ] `POST /api/access/individual`
  - creates individual workspace + owner user
- [ ] `POST /api/access/business-request`
  - create or submit verified business workspace request
- [ ] `PATCH /api/access/business-request/:id`
  - update editable request fields before final review (optional if useful)
- [ ] `GET /api/access/business-request/:id`
  - fetch request details/status

### API changes
- [ ] Add onboarding-aware auth logic for authenticated-but-unprovisioned users
- [ ] Support Clerk-backed identity even before app provisioning is complete

---

## Phase 7 — Admin review / business provisioning endpoints
- [ ] `GET /api/admin/access-requests`
- [ ] `GET /api/admin/access-requests/:id`
- [ ] `POST /api/admin/access-requests/:id/approve-business`
- [ ] `POST /api/admin/access-requests/:id/reject`
- [ ] `POST /api/admin/access-requests/:id/needs-follow-up`

### Approval logic
#### Individual workspace creation
- [ ] create individual workspace
- [ ] create LeadSprint user
- [ ] assign role `owner`
- [ ] attach `clerk_user_id`
- [ ] mark workspace type `individual`
- [ ] enforce no-user-invite restriction

#### Verified business approval
- [ ] confirm business exists
- [ ] confirm requester is authorized to act for business
- [ ] create organization
- [ ] create LeadSprint user
- [ ] assign role `owner`
- [ ] attach `clerk_user_id`
- [ ] mark workspace type `business_verified`
- [ ] mark request approved

---

## Phase 8 — Invitation flow for verified business workspaces

### V1 minimum
- [ ] owners/admins can invite a single user by email
- [ ] invited user can authenticate with Clerk and be attached to the org

### V1.1 / later
- [ ] bulk invite by pasted emails
- [ ] CSV/spreadsheet import

### Invitation endpoints / routes
- [ ] `POST /api/organizations/:id/invitations`
- [ ] `GET /api/organizations/:id/invitations`
- [ ] `POST /api/invitations/:id/accept`

### Enforcement rules
- [ ] only `business_verified` workspaces can invite users
- [ ] individual workspaces cannot invite/add users
- [ ] owners/admins can invite users

---

## Phase 9 — Web → API trusted identity bridge
- [ ] Create internal signed request helper in web
- [ ] Sign requests with `INTERNAL_API_AUTH_SECRET`
- [ ] Include trusted identity headers such as:
  - [ ] Clerk user id
  - [ ] email
  - [ ] timestamp
  - [ ] signature
- [ ] Add signature verification middleware in API

### Likely files
- [ ] `apps/web/src/lib/api/internal-api.ts`
- [ ] `apps/api/src/internal-auth.js`

---

## Phase 10 — Replace fake owner auth
- [ ] Remove hardcoded `owner@leadsprint.local` fallback from web fetches
- [ ] Remove hardcoded owner injection from server actions
- [ ] Update API actor resolution away from arbitrary `x-user-email`
- [ ] Keep local dev fallback only behind an explicit env flag if needed

### Files to change
- [ ] `apps/web/src/lib/api.ts`
- [ ] `apps/web/src/app/leads/actions.ts`
- [ ] `apps/api/src/index.js`

---

## Phase 11 — App route protection
- [ ] Protect `/dashboard`
- [ ] Protect `/leads`
- [ ] Protect `/inbox`
- [ ] Protect `/reports`
- [ ] Protect `/settings`
- [ ] Ensure authenticated but unprovisioned users are redirected away from main app shell

---

## Phase 12 — Authorization audit
- [ ] Audit all API endpoints for correct auth level

### Categories to verify
- [ ] public unauthenticated endpoints
- [ ] authenticated-but-unprovisioned endpoints
- [ ] provisioned individual workspace endpoints
- [ ] provisioned verified-business endpoints
- [ ] admin-only endpoints

### Specific audit goals
- [ ] no sensitive route should rely on raw user email headers in production
- [ ] individual workspaces cannot invite/manage users
- [ ] only verified business workspaces can manage team invites

---

## Phase 13 — Minimal admin workflow surface
Choose one for initial implementation:
- [ ] rough admin UI inside app
- [ ] internal-only page
- [ ] admin script / CLI flow

### Minimum capability required
- [ ] view business requests
- [ ] approve verified business workspace
- [ ] reject
- [ ] mark needs follow-up

---

## Phase 14 — UX polish
- [ ] current-user display in app shell
- [ ] logout control
- [ ] humane messaging for pending/rejected/follow-up states
- [ ] humane messaging for invited-user flow
- [ ] avoid generic crashes for access-state mismatches

---

## Phase 15 — Render / deployment updates
### Web env vars
- [ ] add Clerk publishable key
- [ ] add Clerk secret key
- [ ] add internal API auth secret

### API env vars
- [ ] add internal API auth secret

### Config verification
- [ ] verify Clerk redirect URLs match Render domains
- [ ] verify local development URLs match Clerk setup

---

## Phase 16 — Validation checklist
- [ ] Email/password sign-up works
- [ ] Email/password sign-in works
- [ ] Google sign-in works
- [ ] Authenticated new user lands in onboarding flow
- [ ] Individual workspace creation works
- [ ] Verified business request can be submitted
- [ ] Pending state renders correctly
- [ ] Business approval creates correct org/user mapping
- [ ] Approved verified business owner reaches app successfully
- [ ] Individual workspace reaches app successfully
- [ ] Individual workspace cannot invite/add users
- [ ] Verified business workspace can invite users
- [ ] Invited user can authenticate and join workspace
- [ ] Existing permissions still work after provisioning
- [ ] Hardcoded owner auth path is no longer used in production flow

---

## Suggested implementation order
1. Clerk setup
2. schema changes
3. web auth integration
4. onboarding model and pages
5. individual workspace creation flow
6. business request flow
7. admin approval path
8. invitation flow for verified business workspaces
9. trusted web→API bridge
10. remove fake owner auth
11. route/access audit
12. Render deployment update
