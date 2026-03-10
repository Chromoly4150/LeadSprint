# LeadSprint

A working repo for lead generation research, prospect list building, enrichment, and outreach assets.

## Goals

- collect and organize target accounts
- track ICPs, niches, and sourcing rules
- store repeatable research/enrichment scripts
- produce clean outreach-ready exports

## Suggested workflow

1. Define target market and ICP in `docs/`
2. Add raw lead sources to `data/`
3. Use scripts in `src/` to clean, enrich, and dedupe
4. Write outreach copy in `outreach/`
5. Export final lists for campaign use

## Repo structure

```text
LeadSprint/
├── data/
│   ├── samples/          # safe sample inputs you can commit
│   └── schemas/          # column definitions / import templates
├── docs/
│   ├── icp.md            # ideal customer profile
│   ├── pipeline.md       # lead flow and operating notes
│   └── sourcing.md       # sources, search patterns, exclusions
├── outreach/
│   ├── email/
│   └── linkedin/
├── src/
│   └── README.md         # scripts and automation entrypoints
└── templates/
    └── lead-list.csv     # starter CSV schema
```

## Notes

- Keep secrets in local `.env` files, not in git.
- Put only safe sample data in the repo.
- Treat real prospect exports as working data unless you explicitly want them versioned.
