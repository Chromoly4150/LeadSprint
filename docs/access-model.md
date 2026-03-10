# Access Model

## Goal

LeadSprint should support many company types through an organization-first access model.

## Tenancy

- Every user belongs to exactly one **Organization** (initial assumption; can evolve later if multi-org membership becomes necessary).
- No Organization can exist without an **Owner**.
- Organization is the top-level container for users, settings, permissions, campaigns, leads, messaging configuration, and other account-level resources.

## Roles

### Owner

The required top-level organizational role.

Responsibilities / powers:
- full access to organization settings
- manage users
- configure permissions
- manage integrations
- access billing/subscription settings
- full visibility into campaigns, leads, and messaging

Constraints:
- an organization must always have an owner
- admins cannot remove the owner

### Admin

High-trust operational role.

Likely capabilities:
- manage most organization settings
- manage users within policy limits
- manage campaigns and workflows
- review leads, messages, and system activity

Constraints:
- cannot remove or replace the owner
- may have some sensitive actions restricted depending on future policy

### General User

Standard working role for most day-to-day users.

Likely capabilities:
- work leads
- edit records
- run campaigns
- use messaging if granted
- operate normal workflows

### Support User

Limited or specialized operational role.

Purpose:
- allow assistance with parts of the workflow without granting full operational authority
- useful for assistants, support staff, contractors, or narrowly scoped operators

Likely capabilities:
- view or update limited lead/workflow data
- assist with admin or support tasks
- optionally receive near-General-User capabilities if configured

Likely restrictions:
- messaging may be disabled
- user-management actions may be limited
- sensitive settings may be hidden

## Why separate General vs Support users?

This separation supports organizations that need users who can participate in operations without receiving all communication or system powers.

Example:
- a support user may be allowed to add or edit certain data
- but not contact leads via email/SMS
- or not access certain organizational controls

## Permission model direction

Recommended direction: **role templates plus granular permission overrides**.

Why:
- pure RBAC may be too rigid
- fully custom permissions from day one may be too complex
- role templates with overrides gives a practical middle ground

## Example permission domains

- organization.manage
- organization.view
- users.invite
- users.remove
- roles.assign
- permissions.manage
- leads.view
- leads.edit
- campaigns.create
- campaigns.manage
- messaging.send_email
- messaging.send_sms
- messaging.send_other
- integrations.manage
- exports.run
- imports.run
- billing.manage
- audit.view

## Open design questions

- Should the owner role be transferable?
- Should organizations support multiple owners later?
- Should users ever belong to multiple organizations?
- Which permissions are dangerous enough to require special approval or audit logging?
- Which actions should be disabled by default for support users?
