# Database Schema Proposal

## Purpose

This document turns the conceptual data model into a first-pass relational schema for LeadSprint.

The goal is not to freeze every detail forever, but to define a practical schema that supports:
- organization-first multi-tenancy
- role/permission-aware access
- inbound lead intake
- communication history
- internal notes
- bot + human collaboration
- reporting and auditability

---

## Schema design principles

- every business record is scoped to an organization
- lifecycle state and urgency are modeled separately
- communication history is first-class
- internal notes are first-class
- automation actions are traceable
- keep room for future custom roles/permissions

---

## Core tables

## 1. organizations

Columns:
- `id` uuid pk
- `name` text not null
- `status` text not null default 'active'
- `owner_user_id` uuid nullable initially, then enforced after owner creation flow
- `subscription_plan` text nullable
- `settings_json` jsonb not null default '{}'
- `created_at` timestamptz not null default now()
- `updated_at` timestamptz not null default now()

Indexes:
- `organizations_status_idx (status)`

Notes:
- owner relationship may need deferred enforcement depending on creation flow

---

## 2. users

Columns:
- `id` uuid pk
- `organization_id` uuid not null fk -> organizations.id
- `email` citext not null
- `name` text not null
- `status` text not null default 'active'
- `last_login_at` timestamptz null
- `created_at` timestamptz not null default now()
- `updated_at` timestamptz not null default now()

Constraints:
- unique `(organization_id, email)`

Indexes:
- `users_org_idx (organization_id)`
- `users_status_idx (status)`

---

## 3. roles

Columns:
- `id` uuid pk
- `organization_id` uuid null fk -> organizations.id
- `name` text not null
- `key` text not null
- `role_type` text not null default 'system'  -- system | custom
- `description` text null
- `created_at` timestamptz not null default now()
- `updated_at` timestamptz not null default now()

Constraints:
- unique `(organization_id, key)`

Notes:
- system roles may use `organization_id = null`
- initial keys: owner, admin, general_user, support_user

---

## 4. user_roles

Columns:
- `id` uuid pk
- `organization_id` uuid not null fk -> organizations.id
- `user_id` uuid not null fk -> users.id
- `role_id` uuid not null fk -> roles.id
- `created_at` timestamptz not null default now()

Constraints:
- unique `(organization_id, user_id, role_id)`

Indexes:
- `user_roles_user_idx (user_id)`
- `user_roles_role_idx (role_id)`

---

## 5. permission_assignments

Columns:
- `id` uuid pk
- `organization_id` uuid not null fk -> organizations.id
- `subject_type` text not null  -- role | user
- `subject_id` uuid not null
- `permission_key` text not null
- `effect` text not null  -- allow | deny
- `created_at` timestamptz not null default now()

Indexes:
- `permission_assignments_org_subject_idx (organization_id, subject_type, subject_id)`
- `permission_assignments_key_idx (permission_key)`

---

## 6. lead_sources

Columns:
- `id` uuid pk
- `organization_id` uuid not null fk -> organizations.id
- `name` text not null
- `source_type` text not null
- `status` text not null default 'active'
- `config_json` jsonb not null default '{}'
- `created_at` timestamptz not null default now()
- `updated_at` timestamptz not null default now()

Indexes:
- `lead_sources_org_idx (organization_id)`
- `lead_sources_type_idx (source_type)`

---

## 7. companies

Columns:
- `id` uuid pk
- `organization_id` uuid not null fk -> organizations.id
- `name` text not null
- `domain` citext null
- `industry` text null
- `employee_range` text null
- `location_json` jsonb not null default '{}'
- `linkedin_url` text null
- `website_url` text null
- `created_at` timestamptz not null default now()
- `updated_at` timestamptz not null default now()

Indexes:
- `companies_org_idx (organization_id)`
- `companies_domain_idx (domain)`
- `companies_name_idx (organization_id, name)`

---

## 8. contacts

Columns:
- `id` uuid pk
- `organization_id` uuid not null fk -> organizations.id
- `company_id` uuid null fk -> companies.id
- `first_name` text null
- `last_name` text null
- `full_name` text null
- `email` citext null
- `phone` text null
- `linkedin_url` text null
- `title` text null
- `preferred_contact_channel` text null
- `contactability_status` text null
- `created_at` timestamptz not null default now()
- `updated_at` timestamptz not null default now()

Indexes:
- `contacts_org_idx (organization_id)`
- `contacts_email_idx (email)`
- `contacts_phone_idx (phone)`
- `contacts_company_idx (company_id)`

---

## 9. campaigns

Columns:
- `id` uuid pk
- `organization_id` uuid not null fk -> organizations.id
- `name` text not null
- `campaign_type` text not null
- `status` text not null default 'draft'
- `owner_user_id` uuid null fk -> users.id
- `settings_json` jsonb not null default '{}'
- `created_at` timestamptz not null default now()
- `updated_at` timestamptz not null default now()

Indexes:
- `campaigns_org_idx (organization_id)`
- `campaigns_status_idx (status)`

---

## 10. leads

Columns:
- `id` uuid pk
- `organization_id` uuid not null fk -> organizations.id
- `company_id` uuid null fk -> companies.id
- `primary_contact_id` uuid null fk -> contacts.id
- `campaign_id` uuid null fk -> campaigns.id
- `lead_source_id` uuid null fk -> lead_sources.id
- `source_type` text not null
- `source_label` text null
- `lifecycle_status` text not null default 'new'
- `urgency_status` text not null default 'warm'
- `priority_score` numeric(10,2) null
- `state_region` text null
- `assigned_user_id` uuid null fk -> users.id
- `owner_user_id` uuid null fk -> users.id
- `received_at` timestamptz not null default now()
- `last_contacted_at` timestamptz null
- `last_activity_at` timestamptz null
- `first_response_due_at` timestamptz null
- `first_response_at` timestamptz null
- `needs_rapid_follow_up` boolean not null default false
- `sufficient_submission` boolean null
- `qualification_notes` text null
- `tags_json` jsonb not null default '[]'
- `created_at` timestamptz not null default now()
- `updated_at` timestamptz not null default now()

Indexes:
- `leads_org_idx (organization_id)`
- `leads_lifecycle_idx (organization_id, lifecycle_status)`
- `leads_urgency_idx (organization_id, urgency_status)`
- `leads_received_idx (organization_id, received_at desc)`
- `leads_last_contacted_idx (organization_id, last_contacted_at desc)`
- `leads_last_activity_idx (organization_id, last_activity_at desc)`
- `leads_state_idx (organization_id, state_region)`
- `leads_assigned_idx (organization_id, assigned_user_id)`

---

## 11. lead_contacts

Join table if a lead needs multiple related contacts.

Columns:
- `id` uuid pk
- `organization_id` uuid not null fk -> organizations.id
- `lead_id` uuid not null fk -> leads.id
- `contact_id` uuid not null fk -> contacts.id
- `relationship_type` text null
- `is_primary` boolean not null default false
- `created_at` timestamptz not null default now()

Constraints:
- unique `(organization_id, lead_id, contact_id)`

---

## 12. conversations

Columns:
- `id` uuid pk
- `organization_id` uuid not null fk -> organizations.id
- `lead_id` uuid not null fk -> leads.id
- `contact_id` uuid null fk -> contacts.id
- `channel` text not null
- `status` text not null default 'open'
- `assigned_user_id` uuid null fk -> users.id
- `last_message_at` timestamptz null
- `created_at` timestamptz not null default now()
- `updated_at` timestamptz not null default now()

Indexes:
- `conversations_org_idx (organization_id)`
- `conversations_lead_idx (lead_id)`
- `conversations_channel_idx (organization_id, channel)`

---

## 13. messages

Columns:
- `id` uuid pk
- `organization_id` uuid not null fk -> organizations.id
- `lead_id` uuid not null fk -> leads.id
- `contact_id` uuid null fk -> contacts.id
- `campaign_id` uuid null fk -> campaigns.id
- `conversation_id` uuid not null fk -> conversations.id
- `channel` text not null
- `direction` text not null
- `sender_type` text not null  -- user | system | bot | contact
- `sender_id` uuid null
- `subject` text null
- `content` text null
- `summary` text null
- `status` text null
- `sent_at` timestamptz null
- `delivered_at` timestamptz null
- `read_at` timestamptz null
- `created_at` timestamptz not null default now()

Indexes:
- `messages_org_idx (organization_id)`
- `messages_conversation_idx (conversation_id, created_at)`
- `messages_lead_idx (lead_id, created_at desc)`
- `messages_channel_idx (organization_id, channel)`

Notes:
- calls can also be stored as communication records here if that simplifies the MVP
- if call-specific fields become richer later, split into a dedicated call_events table

---

## 14. internal_notes

Columns:
- `id` uuid pk
- `organization_id` uuid not null fk -> organizations.id
- `lead_id` uuid not null fk -> leads.id
- `contact_id` uuid null fk -> contacts.id
- `conversation_id` uuid null fk -> conversations.id
- `message_id` uuid null fk -> messages.id
- `author_user_id` uuid not null fk -> users.id
- `note_type` text not null default 'general'
- `content` text not null
- `created_at` timestamptz not null default now()
- `updated_at` timestamptz not null default now()

Indexes:
- `internal_notes_org_idx (organization_id)`
- `internal_notes_lead_idx (lead_id, created_at desc)`
- `internal_notes_message_idx (message_id)`

---

## 15. automation_runs

Columns:
- `id` uuid pk
- `organization_id` uuid not null fk -> organizations.id
- `lead_id` uuid not null fk -> leads.id
- `contact_id` uuid null fk -> contacts.id
- `trigger_type` text not null
- `triggered_at` timestamptz not null
- `target_first_response_at` timestamptz null
- `actual_first_response_at` timestamptz null
- `response_within_sla` boolean null
- `automation_status` text not null
- `handoff_status` text null
- `transcript_ref` text null
- `summary` text null
- `created_at` timestamptz not null default now()
- `updated_at` timestamptz not null default now()

Indexes:
- `automation_runs_org_idx (organization_id)`
- `automation_runs_lead_idx (lead_id, created_at desc)`

---

## 16. integrations

Columns:
- `id` uuid pk
- `organization_id` uuid not null fk -> organizations.id
- `integration_type` text not null
- `name` text not null
- `status` text not null default 'active'
- `config_ref` text null
- `created_at` timestamptz not null default now()
- `updated_at` timestamptz not null default now()

Indexes:
- `integrations_org_idx (organization_id)`
- `integrations_type_idx (organization_id, integration_type)`

---

## 17. audit_logs

Columns:
- `id` uuid pk
- `organization_id` uuid not null fk -> organizations.id
- `actor_type` text not null
- `actor_id` uuid null
- `action` text not null
- `target_type` text not null
- `target_id` uuid null
- `metadata_json` jsonb not null default '{}'
- `created_at` timestamptz not null default now()

Indexes:
- `audit_logs_org_idx (organization_id, created_at desc)`
- `audit_logs_action_idx (organization_id, action)`

---

## 18. reports

Columns:
- `id` uuid pk
- `organization_id` uuid not null fk -> organizations.id
- `name` text not null
- `report_type` text not null
- `config_json` jsonb not null default '{}'
- `last_run_at` timestamptz null
- `created_by_user_id` uuid null fk -> users.id
- `created_at` timestamptz not null default now()
- `updated_at` timestamptz not null default now()

---

## 19. export_jobs

Columns:
- `id` uuid pk
- `organization_id` uuid not null fk -> organizations.id
- `report_id` uuid null fk -> reports.id
- `requested_by_user_id` uuid not null fk -> users.id
- `status` text not null
- `format` text not null
- `filters_json` jsonb not null default '{}'
- `file_url` text null
- `created_at` timestamptz not null default now()
- `updated_at` timestamptz not null default now()

---

## 20. inbound_events

Stores raw inbound payloads for traceability.

Columns:
- `id` uuid pk
- `organization_id` uuid not null fk -> organizations.id
- `lead_source_id` uuid null fk -> lead_sources.id
- `source_type` text not null
- `external_id` text null
- `payload_json` jsonb not null
- `received_at` timestamptz not null default now()
- `processed_at` timestamptz null
- `processing_status` text not null default 'pending'
- `created_lead_id` uuid null fk -> leads.id

Indexes:
- `inbound_events_org_idx (organization_id, received_at desc)`
- `inbound_events_status_idx (organization_id, processing_status)`

---

## Enum-ish values to standardize early

Suggested early controlled values:
- `lifecycle_status`: new, contacted, in_progress, qualified, unresponsive, converted, disqualified
- `urgency_status`: hot, warm, cold, needs_attention, sla_risk
- `channel`: sms, email, chat, call
- `sender_type`: user, system, bot, contact
- `note_type`: general, call_note, follow_up, internal_comment

---

## Recommended first migration order

1. organizations
2. users
3. roles / user_roles / permission_assignments
4. lead_sources
5. companies / contacts
6. campaigns
7. leads / lead_contacts
8. conversations / messages
9. internal_notes
10. automation_runs
11. integrations
12. audit_logs
13. reports / export_jobs
14. inbound_events

---

## Practical v1 schema cut

If we want to trim for implementation speed, the first absolutely essential tables are:
- organizations
- users
- roles
- user_roles
- leads
- contacts
- conversations
- messages
- internal_notes
- inbound_events
- automation_runs

Everything else can be layered in incrementally.
