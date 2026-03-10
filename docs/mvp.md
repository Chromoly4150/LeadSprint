# MVP Definition

## Purpose

This document defines the recommended MVP scope for LeadSprint.

The goal is to identify the smallest version of the product that proves the core value proposition without overbuilding.

---

## Core hypothesis

Organizations will pay for a system that helps them:
- capture or ingest leads from multiple sources
- respond to hot inbound leads within minutes
- keep conversations moving until a human takes over
- manage access and workflows across a team

The MVP should prove this core hypothesis first.

---

## MVP objective

Build a first version of LeadSprint that can:
1. support an organization-based account model
2. ingest inbound leads from at least one real external source
3. determine whether a lead is actionable
4. trigger a rapid first-response workflow
5. preserve a unified conversation and handoff experience
6. allow teams to manage access based on role/permission boundaries

---

## Recommended MVP scope

### 1. Organization and user management
Include:
- organization creation
- required owner role
- invite/add users
- initial roles: Owner, Admin, General User, Support User
- basic role assignment

Why it matters:
- the product is organization-first, not solo-user-first

---

### 2. Permission-aware access control
Include:
- baseline role permissions
- ability to restrict sensitive messaging actions
- permission checks around user management, messaging, and integrations

Why it matters:
- teams need different access boundaries
- this is part of the product’s business readiness

---

### 3. Lead intake from external sources
Include at least:
- one first-class inbound integration path (for example webhook-backed web form intake)
- manual lead creation
- CSV import

Nice-to-have if simple:
- Google Form ingestion

Why it matters:
- “take leads from anywhere” is part of the product promise

---

### 4. Lead normalization and record view
Include:
- normalized lead record
- contact details
- source attribution
- status/state
- timeline/activity view
- assignment info

Why it matters:
- users need a single place to understand each lead

---

### 5. Sufficient-submission evaluation
Include:
- first-pass rules for whether an inbound lead should receive rapid follow-up
- visible status/reason codes
- spam/duplicate/basic validation handling

Why it matters:
- rapid response should happen intentionally, not blindly

---

### 6. Automated first response
Include:
- at least one messaging channel for first-response automation
- SLA target tracking for first response
- bot/system acknowledgment and follow-up prompts
- conversation creation tied to the lead

Why it matters:
- this is the central product hook

---

### 7. Conversation view and human handoff
Include:
- conversation history
- distinction between bot/system and human messages
- human takeover capability
- assignment/reassignment

Why it matters:
- the bot is not the whole product; handoff continuity is crucial

---

### 8. Basic audit trail
Include logging for:
- inbound lead received
- automated first response sent
- assignment changes
- status changes
- sensitive user/permission actions

Why it matters:
- useful for trust, debugging, and operational visibility

---

## MVP should probably NOT include

Avoid building these too early unless one becomes absolutely necessary:
- advanced analytics/reporting suites
- highly complex workflow builders
- fully custom RBAC UI from day one
- many messaging channels at once
- complex billing/subscription engine
- deep CRM sync in multiple directions
- enterprise SSO
- mobile apps
- overengineered AI orchestration
- broad outbound lead generation automation before inbound flow works

---

## Recommended MVP wedge

If we need a focused narrative for testing:

> LeadSprint helps organizations capture inbound leads and engage them within 5 minutes before they go cold.

That does not eliminate outbound/generation from the product vision, but it keeps the MVP sharp.

---

## Suggested MVP user journey

1. organization owner creates the account
2. owner invites team members
3. organization connects or configures an inbound lead source
4. a lead arrives
5. LeadSprint normalizes and evaluates it
6. eligible lead receives automated first response within SLA
7. conversation appears in the system
8. human user takes over when appropriate
9. organization can review status/history and continue follow-up

---

## MVP success criteria

The MVP is successful if it can demonstrate:
- real inbound leads being ingested
- first-response automation reliably happening within target window
- human handoff without conversation loss
- organizations being able to operate with multiple user roles
- users perceiving reduced lead leakage / better speed-to-lead

---

## MVP open decisions

- what is the first inbound source to support?
- what is the first messaging channel to support?
- what exact sufficiency rules should be used?
- should role overrides be in MVP or just baseline roles?
- how much outbound/generation belongs in MVP versus later phases?

---

## Practical build guidance

If tradeoffs are needed, optimize for:
1. inbound lead intake reliability
2. speed-to-first-response
3. conversation continuity
4. clear permissions for team usage
5. operational simplicity

This is more important than broad feature count in v1.
