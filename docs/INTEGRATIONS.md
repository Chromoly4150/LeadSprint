# Integrations Strategy (CRM / LOS / POS)

## Product principle
Be a **performance layer** on top of existing systems.

- Existing CRM/LOS/POS remains system of record
- LeadSprint handles speed-to-lead + conversion automation
- Key events sync back to customer stack

## Integration phases

## Phase 1 (Post-MVP): Webhook + CSV bridge
- Inbound webhook intake from existing systems/forms
- Scheduled CSV import/export for low-tech customers
- Manual field mapping config

## Phase 2: Native CRM connectors
- HubSpot connector
- Salesforce connector
- Common SMB CRM connector set

Capabilities:
- Pull new leads/events
- Push lead status updates (contacted/booked/closed)
- Push notes and activity timeline summaries

## Phase 3: LOS/POS ecosystem connectors
- Target top LOS/POS by pilot niche first
- Build one generic connector SDK adapter
- Add prebuilt templates per vertical

## Technical architecture (target)
1. **Connector Adapters**
   - Provider-specific auth and API clients
2. **Unified Lead Event Model**
   - Normalize provider payloads into internal schema
3. **Sync Orchestrator**
   - Inbound and outbound sync jobs
   - Retry/backoff + idempotency keys
4. **Field Mapping Layer**
   - User-configurable mappings
   - Transform rules (enum/date/text)
5. **Conflict Resolution**
   - Last-write-wins default
   - Optional source priority rules

## Data model additions (future)
- `integrations`
- `integration_connections`
- `integration_mappings`
- `sync_runs`
- `sync_events`

## MVP-safe design decisions to make now
- Use stable internal lead IDs
- Record external source IDs on lead/event records
- Keep event log append-only
- Make status transitions explicit and timestamped

## Security requirements
- OAuth token encryption at rest
- Least-privilege scopes
- Sync audit trails
- Per-tenant data isolation
