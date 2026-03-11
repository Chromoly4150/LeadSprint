# LeadSprint

LeadSprint is an organization-first lead contact platform for generating leads, ingesting leads from external sources, and engaging hot inbound leads quickly.

## Current status

This repo now contains:
- product and architecture docs in `docs/`
- a Next.js application in `src/`
- a lightweight SQLite + Drizzle data backbone in `data/leadsprint.sqlite`
- a live Leads workflow with assignment, lifecycle updates, notes, manual contact logging, and queued outbound dispatch controls
- an inbound MVP endpoint at `POST /api/inbound` that creates leads, logs intake events, starts SLA tracking, and queues a first-response job record
- lead filtering/search by query, lifecycle, urgency, and assignee
- a first-pass role/permission scaffold with server-enforced checks, an in-app acting-user session switcher, DB-backed user permission overrides, and persisted audit logs for sensitive actions
- manual lead creation plus CSV import from the Leads workspace, with an API import endpoint at `POST /api/import/leads`
- duplicate detection/hygiene across intake paths, with duplicate lookups exposed at `POST /api/leads/duplicates`
- a first-pass inbox/conversation workspace with `/inbox` and `/inbox/[id]` thread views
- an outbound provider boundary scaffold with dispatchable job metadata, provider adapters, and `POST /api/outbound/dispatch`
- a reports/export path including live summaries and `GET /api/reports/leads` CSV export

## Getting started

```bash
npm install
npm run dev
```

Then open <http://localhost:3000>.

### Inbound MVP test

You can create a lead through the UI or post directly to the ingestion endpoint:

```bash
curl -X POST http://localhost:3000/api/inbound \
  -H 'content-type: application/json' \
  -d '{
    "source": "Webhook",
    "name": "Casey Nguyen",
    "company": "Nguyen Realty",
    "email": "casey@example.com",
    "state": "GA",
    "service": "Refi inquiry",
    "details": "Requested callback before lunch"
  }'
```

This will:
- create the lead
- store an inbound event
- start the first-response SLA window
- queue a placeholder outbound first-response job when enough contact data exists

## Key docs

- `docs/project-memory.md`
- `docs/product-brief.md`
- `docs/data-model.md`
- `docs/database-schema.md`
- `docs/inbound-flow.md`
- `docs/technical-architecture.md`
- `docs/ui-screens.md`

## Repo notes

- Keep secrets in local `.env` files, not in git.
- Put only safe sample data in the repo.
- Treat real prospect exports as working data unless you explicitly want them versioned.
- Use `docs/project-memory.md` and `docs/project-log.md` as the durable source of truth for product direction and key decisions.
