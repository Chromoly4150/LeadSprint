# Data Model

## Purpose

This document defines the first-pass conceptual data model for LeadSprint.

LeadSprint is being designed as an **organization-first, general-purpose lead contact platform** that can:
- generate leads
- ingest leads from outside sources
- route and manage lead follow-up
- engage hot inbound leads quickly through automated chat/messaging workflows

## Design principles

- multi-tenant from the start
- every resource belongs to an organization
- permissions and auditability matter
- supports both outbound prospecting and inbound lead response
- flexible enough for many industries, not only mortgage

---

## Core entities

## 1. Organization

Top-level tenant/account container.

Fields:
- `id`
- `name`
- `status`
- `ownerUserId`
- `createdAt`
- `updatedAt`
- `settingsJson`
- `subscriptionPlan`

Rules:
- every organization must have an owner
- all users belong to an organization
- all business data is scoped to an organization

---

## 2. User

A person who can log into and use the platform.

Fields:
- `id`
- `organizationId`
- `email`
- `name`
- `status`
- `lastLoginAt`
- `createdAt`
- `updatedAt`

Relationships:
- belongs to one organization
- has one or more roles / permission assignments

---

## 3. Role

Named access role within an organization.

Initial system roles:
- Owner
- Admin
- General User
- Support User

Fields:
- `id`
- `organizationId` (nullable if system-defined)
- `name`
- `type` (`system` or `custom`)
- `description`

---

## 4. Permission Assignment

Maps users/roles to capabilities.

Fields:
- `id`
- `organizationId`
- `subjectType` (`user` or `role`)
- `subjectId`
- `permissionKey`
- `effect` (`allow` or `deny`)

Examples:
- `messaging.send_sms`
- `messaging.send_email`
- `leads.edit`
- `users.invite`
- `organization.manage`

Recommended approach:
- default role templates
- granular permission overrides

---

## 5. Lead

Represents a lead/opportunity entering the system.

A lead may come from:
- generated prospecting
- imported CSV
- web form submission
- Google Form submission
- landing page/webhook submission
- manual entry
- third-party integrations

Fields:
- `id`
- `organizationId`
- `sourceType`
- `sourceId`
- `sourceLabel`
- `status`
- `temperature` (`cold`, `warm`, `hot`)
- `priorityScore`
- `assignedUserId`
- `ownerUserId`
- `createdAt`
- `updatedAt`
- `lastActivityAt`
- `firstResponseDueAt`
- `firstResponseAt`
- `needsRapidFollowUp` (boolean)
- `qualificationNotes`
- `tagsJson`

Important concept:
- inbound leads with sufficient submission data should be eligible for rapid automated engagement, ideally within 5 minutes.

---

## 6. Person / Contact

Represents an individual associated with a lead or company.

Fields:
- `id`
- `organizationId`
- `leadId` (nullable)
- `companyId` (nullable)
- `firstName`
- `lastName`
- `fullName`
- `email`
- `phone`
- `linkedinUrl`
- `title`
- `preferredContactChannel`
- `contactabilityStatus`
- `createdAt`
- `updatedAt`

Notes:
- a lead may have one or more contacts
- a contact may be the primary contact for a lead

---

## 7. Company / Account

Represents the company tied to a lead/contact.

Fields:
- `id`
- `organizationId`
- `name`
- `domain`
- `industry`
- `employeeRange`
- `locationJson`
- `linkedinUrl`
- `websiteUrl`
- `createdAt`
- `updatedAt`

Useful for:
- B2B prospecting
- dedupe
- account-based workflows

---

## 8. Lead Source

Describes where leads came from.

Examples:
- imported CSV
- scraping workflow
- generated list
- Google Form
- website form
- webhook
- Zapier/Make integration
- ad campaign submission

Fields:
- `id`
- `organizationId`
- `name`
- `type`
- `status`
- `configJson`
- `createdAt`
- `updatedAt`

Purpose:
- allows the platform to ingest leads from many sources, not only native generation
- supports source-level routing and automation rules

---

## 9. Campaign

Represents a sourcing, qualification, or outreach initiative.

Fields:
- `id`
- `organizationId`
- `name`
- `type` (`outbound`, `inbound_followup`, `reactivation`, etc.)
- `status`
- `ownerUserId`
- `settingsJson`
- `createdAt`
- `updatedAt`

Examples:
- local referral partner campaign
- inbound lead follow-up campaign
- reactivation campaign

---

## 10. Message

Represents an outbound or inbound communication.

Channels may include:
- SMS
- email
- chat/webchat
- call
- other integrated channels

Fields:
- `id`
- `organizationId`
- `leadId`
- `contactId`
- `campaignId`
- `conversationId`
- `channel`
- `direction` (`inbound`, `outbound`)
- `senderType` (`user`, `system`, `bot`)
- `senderId`
- `subject` (nullable; useful for email)
- `content`
- `summary` (nullable; useful for previews and call summaries)
- `status`
- `sentAt`
- `deliveredAt`
- `readAt`
- `createdAt`

Notes:
- users with sufficient permissions should be able to review communication history with timestamps
- for text/email/chat channels, the system should preserve enough message detail to understand the most recent discussion
- call interactions may store notes and/or summaries tied to the communication record

---

## 11. Conversation

Thread of communication for a lead/contact/channel.

Fields:
- `id`
- `organizationId`
- `leadId`
- `contactId`
- `channel`
- `status`
- `assignedUserId`
- `lastMessageAt`
- `createdAt`
- `updatedAt`

Purpose:
- groups automated and human follow-up in one place
- lets human reps take over from the bot when needed

---

## 12. Internal Note

Represents an internal note visible only to organization users with the right permissions.

Purpose:
- preserve operational context that should not be visible to the lead/contact
- capture follow-up notes, strategy, reminders, and team coordination
- attach notes to a lead generally or to a specific communication event such as a call

Fields:
- `id`
- `organizationId`
- `leadId`
- `contactId` (nullable)
- `conversationId` (nullable)
- `messageId` (nullable; useful for tying a note to a specific email/text/call record)
- `authorUserId`
- `noteType` (`general`, `call_note`, `follow_up`, `internal_comment`, etc.)
- `content`
- `createdAt`
- `updatedAt`

Examples:
- general internal lead note
- note attached to a call interaction
- note explaining recent email context
- next-step reminder after a conversation

---

## 13. Bot Engagement / Automation Run

Represents automated follow-up behavior.

This is central to the current product selling point.

Fields:
- `id`
- `organizationId`
- `leadId`
- `contactId`
- `triggerType`
- `triggeredAt`
- `targetFirstResponseAt`
- `actualFirstResponseAt`
- `responseWithinSla` (boolean)
- `automationStatus`
- `handoffStatus`
- `transcriptRef`
- `summary`
- `createdAt`
- `updatedAt`

Key concept:
- if a lead arrives with sufficient submission detail, an automated agent/chatbot should engage within 5 minutes so the lead stays hot and conversion chances remain high.

---

## 14. Integration

External system connection.

Examples:
- Google Forms
- website/webhook ingestion
- email provider
- SMS provider
- CRM sync

Fields:
- `id`
- `organizationId`
- `type`
- `name`
- `status`
- `configRef`
- `createdAt`
- `updatedAt`

---

## 15. Audit Log

Records important user/system actions.

Fields:
- `id`
- `organizationId`
- `actorType`
- `actorId`
- `action`
- `targetType`
- `targetId`
- `metadataJson`
- `createdAt`

Important for:
- admin accountability
- permission-sensitive actions
- tracing bot/human handoffs

---

## 16. SLA / Response Policy

Defines time-sensitive behavior expectations.

Fields:
- `id`
- `organizationId`
- `name`
- `appliesToSourceType`
- `minimumSubmissionQualityRule`
- `firstResponseTargetMinutes`
- `handoffRulesJson`
- `enabled`

Why this matters:
- the current platform promise includes rapid engagement for hot leads
- a policy object helps make that explicit and configurable

---

## Core relationships

- Organization has many Users
- Organization has many Roles
- Organization has many Leads
- Organization has many Campaigns
- Organization has many Integrations
- Lead may have one primary Company
- Lead may have one or more Contacts
- Lead may belong to a Campaign
- Lead may have one or more Conversations
- Conversation has many Messages
- Lead may have many Internal Notes
- Internal Notes may optionally attach to a Contact, Conversation, or specific Message/Call record
- Lead may have one or more Bot Engagement runs
- Users/Roles have Permissions
- Audit Logs capture sensitive actions across all entities

---

## Product-specific implications

### Outbound side
The system should support lead generation, import, enrichment, qualification, and outreach.

### Inbound side
The system should also support external lead intake from arbitrary sources.

A major product promise is:
> if a new lead arrives with sufficient submission data, the platform should engage that lead quickly — ideally within 5 minutes — to preserve conversion opportunity.

### Human + bot collaboration
The system should support:
- bot-first engagement
- human review
- human takeover / reassignment
- conversation continuity

---

## Open questions

- Should a Lead always be linked to a Contact, or can a lead exist before identity is fully resolved?
- How do we define “sufficient submission” for automated engagement eligibility?
- Should messaging identity be owned by the organization, the user, or both?
- What compliance/audit requirements apply per channel?
- When should the bot stop and hand off to a human?
- Should support users be allowed to view full conversation history by default?
