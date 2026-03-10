# Permissions Model

## Purpose

This document defines the first-pass permissions model for LeadSprint.

LeadSprint is organization-first software, so permissions are not an afterthought. Different users within the same organization will need different abilities, especially around:
- messaging leads
- managing users
- controlling integrations
- reviewing sensitive information

---

## Design goals

- simple enough to ship in an MVP
- flexible enough for real organizations
- role-driven by default
- expandable to more granular control later

Recommended approach:
> **default roles + permission categories + optional granular overrides**

---

## Baseline roles

### Owner
Highest organizational authority.

Should be able to:
- manage organization settings
- manage users
- assign roles
- configure integrations
- manage permissions
- view and manage all leads/campaigns/conversations
- send messages through allowed channels
- manage billing/subscription settings
- view audit logs

Constraints:
- each organization must have an owner
- owner cannot be removed by admins

---

### Admin
High-trust operational role.

Should usually be able to:
- manage most users (within policy)
- manage most campaigns/leads/conversations
- manage many operational settings
- send messages if allowed
- view audit/operational history

Should usually NOT be able to:
- remove the owner
- take over reserved owner-only account controls

---

### General User
Standard active operator.

Should usually be able to:
- view assigned or accessible leads
- update lead/contact/company data
- work conversations
- send messages if granted
- manage routine campaign activity if allowed

Should usually NOT be able to:
- control organization-wide settings by default
- manage billing
- broadly manage users unless explicitly granted

---

### Support User
Restricted or specialized operational role.

Should usually be able to:
- assist with records or workflow steps
- view relevant lead/conversation context
- perform narrow support or coordination tasks

May or may not be able to:
- send messages
- assign leads
- import/export data
- invite users

Purpose:
- lets an organization include helpers, assistants, contractors, or narrow-scope staff without defaulting them into full operational authority

---

## Permission domains

### 1. Organization permissions
Examples:
- `organization.view`
- `organization.manage`
- `organization.settings.manage`

### 2. User and role management permissions
Examples:
- `users.view`
- `users.invite`
- `users.edit`
- `users.remove`
- `roles.assign`
- `permissions.manage`

### 3. Lead and contact permissions
Examples:
- `leads.view`
- `leads.create`
- `leads.edit`
- `leads.assign`
- `contacts.view`
- `contacts.edit`
- `companies.view`
- `companies.edit`

### 4. Campaign permissions
Examples:
- `campaigns.view`
- `campaigns.create`
- `campaigns.edit`
- `campaigns.manage`

### 5. Conversation, notes, and messaging permissions
Examples:
- `conversations.view`
- `conversations.takeover`
- `notes.view_internal`
- `notes.create_internal`
- `notes.edit_internal`
- `messaging.send_email`
- `messaging.send_sms`
- `messaging.send_other`
- `messaging.approve`
- `messaging.templates.manage`

### 6. Integration permissions
Examples:
- `integrations.view`
- `integrations.manage`
- `webhooks.manage`
- `sources.manage`

### 7. Data movement permissions
Examples:
- `imports.run`
- `exports.run`

### 8. Audit and reporting permissions
Examples:
- `audit.view`
- `reports.view`

### 9. Billing/account permissions
Examples:
- `billing.view`
- `billing.manage`

---

## Initial baseline by role

Below is a rough first-pass matrix.

### Owner
Default: effectively all permissions.

### Admin
Default: nearly all operational permissions, except hard owner-only controls.

Likely allowed:
- users.view
- users.invite
- users.edit
- roles.assign (within policy)
- leads.*
- contacts.*
- companies.*
- campaigns.*
- conversations.*
- messaging.send_* (if enabled by org policy)
- integrations.view/manage
- imports.run
- exports.run
- audit.view

Likely restricted:
- owner removal
- certain subscription/billing authority if reserved
- ultimate permission-system control if reserved to owner

### General User
Likely allowed:
- leads.view/create/edit
- contacts.view/edit
- companies.view/edit
- campaigns.view
- conversations.view
- conversations.takeover (if allowed)
- messaging.send_* (only if granted)

Likely restricted:
- broad user management
- org-wide settings
- integration management by default
- billing management
- full permission administration

### Support User
Likely allowed:
- leads.view
- limited leads.edit
- contacts.view
- conversations.view
- possibly comments/notes/task support actions

Often restricted unless explicitly granted:
- messaging.send_*
- integrations.manage
- users.remove
- permissions.manage
- billing.manage
- high-impact exports

---

## Why messaging permissions need special treatment

Messaging is one of the highest-risk parts of the system because it directly affects external communications with leads.

That means permissions for messaging should probably be more granular than other actions.

Examples:
- one user may be allowed to send SMS but not email
- another may draft but not send
- another may take over a conversation but not initiate one
- support users may be allowed to review conversation history but not contact the lead

This matches the operational model already discussed.

---

## Recommended MVP permission strategy

For MVP, do not build a huge policy engine.

Instead:
1. define baseline permissions for Owner/Admin/General User/Support User
2. support a small number of high-value overrides
3. protect sensitive actions with hard checks

Most important sensitive actions:
- removing users
- changing roles
- changing org settings
- managing integrations
- sending messages externally
- viewing audit logs
- exporting sensitive data

---

## Future-ready direction

After MVP, permissions can evolve toward:
- custom roles
- per-role overrides
- per-user overrides
- approval flows for some actions
- channel-specific policies
- time-based or queue-based access controls

---

## Product implications

A strong permissions model helps LeadSprint sell into real business environments because it supports:
- controlled delegation
- separation of duties
- safer messaging workflows
- multi-user operations
- organization-level trust

This is especially important if the platform will be used by brokerages, local businesses, or other teams that cannot let every user do everything.

---

## Open questions

- should admins be able to manage other admins?
- should support users ever be able to message leads by default?
- should there be a “draft but not send” permission?
- should exports require special approval?
- should some messaging actions require human approval before bot execution?
- what owner-only actions should remain permanently owner-only?
