# LeadSprint

LeadSprint is an organization-first lead contact platform focused on lead intake, rapid follow-up, communication workflow, and conversion.

## Current state

This repo now combines:
- the **working prototype implementation** (web app + API + data model work)
- the newer **product / architecture / roadmap documentation**

The app is being built as professional-grade software that businesses can eventually buy and teams can operate.

## Product direction

Core themes:
- organization-first account model
- fast inbound lead response
- structured lead workspace
- team roles and permissions
- internal notes and communication history
- reporting and operational visibility
- Gmail/email sending through an internal outbox pipeline

## Repo structure

- `apps/web` — main application UI (Next.js)
- `apps/api` — backend API (Node + Express)
- `apps/worker` — background automation jobs / future worker logic
- `docs` — product, architecture, roadmap, and implementation docs
- `scripts` — local helper scripts
- `Assets` — branding / design assets (local working files)

## Local development

```bash
# install app dependencies
(cd apps/api && npm install)
(cd apps/web && npm install)

# initialize + seed local API database
(cd apps/api && npm run db:init && npm run db:seed)

# start API + web locally
./scripts/dev.sh
```

Then open:
- UI: `http://127.0.0.1:3000`
- API: `http://127.0.0.1:4000`

## Key docs

- `docs/project-memory.md`
- `docs/project-log.md`
- `docs/product-brief.md`
- `docs/roadmap.md`
- `docs/data-model.md`
- `docs/database-schema.md`
- `docs/inbound-flow.md`
- `docs/technical-architecture.md`
- `docs/ui-screens.md`
- `docs/OPENCLAW-CONSOLIDATION.md`

## Current implementation highlights

Working/partially working areas include:
- lead inbox/workspace
- lifecycle status + urgency status
- internal notes
- structured communications
- team management UI
- assignment and ownership
- email drafts
- email outbox pipeline
- Gmail OAuth groundwork and live Gmail send through the outbox

## Important notes

- Keep secrets out of git.
- Do **not** commit downloaded Google OAuth client secret JSON files.
- Treat `docs/project-memory.md` and `docs/project-log.md` as durable project context.
- This product is intended to become a professional-grade lead operations platform, not just a one-off demo.
