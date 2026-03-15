ALTER TABLE organizations ADD COLUMN slug TEXT;

WITH normalized AS (
  SELECT
    id,
    CASE
      WHEN trim(lower(replace(replace(replace(replace(replace(name, ' ', '-'), '&', 'and'), '/', '-'), '.', ''), '--', '-'))) = ''
        THEN id
      ELSE trim(lower(replace(replace(replace(replace(replace(name, ' ', '-'), '&', 'and'), '/', '-'), '.', ''), '--', '-')))
    END AS base_slug,
    ROW_NUMBER() OVER (
      PARTITION BY lower(trim(replace(replace(replace(replace(replace(name, ' ', '-'), '&', 'and'), '/', '-'), '.', ''), '--', '-')))
      ORDER BY created_at, id
    ) AS slug_rank
  FROM organizations
)
UPDATE organizations
SET slug = (
  SELECT CASE
    WHEN normalized.slug_rank = 1 THEN normalized.base_slug
    ELSE normalized.base_slug || '-' || normalized.slug_rank
  END
  FROM normalized
  WHERE normalized.id = organizations.id
)
WHERE slug IS NULL;

UPDATE organizations
SET slug = id
WHERE slug IS NULL OR slug = '';

CREATE UNIQUE INDEX IF NOT EXISTS idx_organizations_slug ON organizations(slug);
