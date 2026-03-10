# LeadSprint

LeadSprint is an organization-first lead contact platform for generating leads, ingesting leads from external sources, and engaging hot inbound leads quickly.

## Current status

This repo now contains:
- product and architecture docs in `docs/`
- an initial Next.js application scaffold in `src/`
- a first-pass UI shell for Dashboard, Leads, and Reports

## Getting started

```bash
npm install
npm run dev
```

Then open <http://localhost:3000>.

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
