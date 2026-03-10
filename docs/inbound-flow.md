# Inbound Lead Flow

## Purpose

This document defines the intended inbound lead handling flow for LeadSprint.

The key product promise is:
> if a lead comes in with sufficient submission data, LeadSprint should engage that lead within **5 minutes** so the lead stays hot and conversion likelihood stays high.

This document focuses on that workflow.

---

## Goals

- accept inbound leads from many sources
- normalize submissions into a common lead record
- determine whether the lead is actionable
- trigger fast first-response automation
- keep the lead engaged until a human takes over or the workflow ends
- maintain clear ownership, auditability, and conversation history

---

## Supported inbound sources

LeadSprint should be able to ingest leads from sources such as:
- website forms
- landing page forms
- Google Forms
- webhooks
- ad platform lead submissions
- imports/manual entry
- CRM or third-party integrations
- future custom intake channels

Design principle:
- the source can vary
- the internal workflow should become standardized after ingestion

---

## High-level inbound lifecycle

1. lead arrives from an external or internal source
2. submission is normalized into the LeadSprint schema
3. submission is evaluated for completeness/actionability
4. if sufficient, rapid follow-up automation is triggered
5. the system begins conversation and gathers more context
6. the lead is routed, assigned, or queued for human review
7. a human user can take over when appropriate
8. status, SLA performance, and audit records are preserved

---

## Step-by-step flow

## 1. Intake / capture

A new inbound event enters the system.

Examples:
- someone fills out a website contact form
- someone submits a Google Form
- an ad platform pushes a new lead via webhook
- a staff user manually enters a lead

System actions:
- store raw payload/reference
- record source type and source identifier
- timestamp receipt
- attach source metadata

Outputs:
- raw intake record
- linked or newly created lead source reference

---

## 2. Normalize to internal schema

The system transforms the incoming payload into a standardized lead structure.

Typical extracted fields:
- name
- email
- phone
- company/business name
- message / inquiry text
- service requested
- location
- referral/source info
- campaign/source attribution

System actions:
- map raw fields to internal lead/contact/company structures
- create or update lead/contact/company records
- dedupe when possible
- preserve original raw submission for traceability

Important note:
- normalization should not destroy original payload fidelity

---

## 3. Evaluate submission sufficiency

The system decides whether the lead contains enough information to trigger rapid automated engagement.

This is central to the product promise.

### Concept: sufficient submission
A submission is "sufficient" if it includes enough information to begin a useful conversation.

Possible criteria:
- at least one reliable contact method exists
- some minimum identity information is present
- inquiry appears legitimate / non-spam
- context is enough for a relevant first response
- source passes any trust/spam filters

Examples of likely sufficient submissions:
- name + phone + message
- name + email + service request
- phone + location + requested service

Examples of likely insufficient submissions:
- blank or low-content message
- no valid contact path
- obvious spam/junk
- duplicate submission already being worked

### Output of this step
- `sufficient_submission = true/false`
- quality/confidence score
- reason codes
- urgency/priority score
- recommended SLA path

---

## 4. Determine response path

Once the lead is scored, the system chooses a path.

### Path A: sufficient and eligible for rapid automation
If the lead is actionable and automation is allowed:
- mark lead as hot or actionable
- set first-response target window
- start automated engagement flow

### Path B: insufficient but recoverable
If the lead is incomplete but still useful:
- queue for human review
- optionally send a lighter request-for-details message if policy allows
- flag missing information

### Path C: blocked / spam / duplicate
If the lead should not be worked:
- mark accordingly
- preserve record for audit/history
- avoid unnecessary contact

---

## 5. Start rapid automated engagement

### SLA target
The system should aim to initiate contact within **5 minutes** of receipt for eligible inbound leads.

This is one of the primary product promises.

### Purpose of the first response
The first response should:
- acknowledge the inquiry quickly
- confirm the lead has been received
- create confidence that someone is responding
- gather missing high-value details if needed
- keep the lead engaged until a human can take over

### Channel selection
The initial channel may depend on:
- source channel
- available contact information
- organization preferences
- compliance rules
- lead preferences when known

Potential channels:
- SMS
- email
- web chat
- other supported messaging channels

### System actions
- create conversation if one does not exist
- create/send first message
- log bot/automation run
- mark SLA timers
- record timestamps for target vs actual response

---

## 6. Continue bot-led conversation

After the first response, the bot can continue gathering structured information.

Examples:
- preferred time to talk
- service area/location
- type of service needed
- urgency or timeline
- budget/range
- role/company details in B2B scenarios

The bot should not feel like a dead-end autoresponder.

It should behave like a useful intake/qualification assistant that:
- captures context
- keeps momentum alive
- avoids overcomplicating the conversation
- knows when to stop and hand off

---

## 7. Route, assign, or queue for human handoff

At some point, the lead should either be:
- assigned to a specific user
- routed to a team queue
- escalated based on urgency
- retained in automation until a triggering condition is met

Possible routing factors:
- geography
- campaign/source
- product/service requested
- lead score
- organization rules
- business hours / staff availability

System outputs:
- assigned owner/user
- queue status
- handoff notes or summary

---

## 8. Human takeover

A human should be able to enter the conversation seamlessly.

Requirements:
- see conversation history
- see source/origin details
- see lead/contact/company details
- see automation summary
- continue in the same thread where possible
- override bot behavior when needed

A good handoff should feel like continuity, not a reset.

The customer should not need to repeat everything if the system has already collected it.

---

## 9. Post-engagement outcomes

After initial engagement, the lead may move to outcomes such as:
- qualified
- awaiting callback
- meeting booked
- needs more info
- disqualified
- unresponsive
- converted

The system should preserve:
- timestamps
- messages
- handoff history
- SLA performance
- audit trail

---

## SLA concept

A configurable response policy should define:
- which sources qualify for rapid response
- what counts as sufficient submission
- target first-response window
- allowed channels
- bot vs human handoff rules
- escalation behavior if SLA risk is detected

### Example SLA policy
- source type: website form
- minimum quality: name + phone or name + email + inquiry
- response target: 5 minutes
- first channel: SMS if phone exists, otherwise email
- escalate to team queue if no owner accepts within X minutes

---

## Permission implications

Not every user should be allowed to do every part of the inbound flow.

Relevant permission areas may include:
- view inbound leads
- edit lead/contact details
- assign leads
- manage automation rules
- send SMS
- send email
- take over bot conversations
- manage integrations/webhooks
- view audit logs

This supports the organization-first access model already defined elsewhere.

---

## Audit and traceability requirements

Important events to log:
- lead received
- source identified
- normalization completed
- sufficiency evaluated
- spam/duplicate decision
- automation started
- first response sent
- SLA met or missed
- handoff triggered
- human takeover started
- lead status changed

Why this matters:
- internal accountability
- performance measurement
- compliance and supportability
- understanding conversion bottlenecks

---

## Risks / edge cases

- spam or fake submissions
- duplicate leads across multiple sources
- missing or invalid contact information
- after-hours routing issues
- bot contacting leads who should not be contacted
- channel-specific compliance constraints
- unclear handoff ownership
- users lacking permission to continue a thread

---

## Product insight

The value here is not just automation for automation’s sake.

The value is:
- fast acknowledgment
- preserved buyer intent
- reduced lead decay
- cleaner handoff to humans
- more consistent operational follow-up

That is why the 5-minute response concept matters.

---

## Open questions

- What exact fields define sufficient submission in v1?
- Which inbound source should be implemented first?
- Which response channel should be first-class in MVP?
- Should the bot always engage immediately, or only during business hours unless configured otherwise?
- What should trigger an immediate human handoff?
- How aggressive should the bot be in collecting more information?
