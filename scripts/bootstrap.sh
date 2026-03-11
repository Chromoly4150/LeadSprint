#!/usr/bin/env bash
set -euo pipefail

echo "Bootstrapping LeadSprint monorepo..."
cd "$(dirname "$0")/.."

echo "Installing app dependencies..."
( cd apps/web && npm install )
( cd apps/api && npm install )
( cd apps/worker && npm install )

echo "Done."
echo "Run web:   cd apps/web && npm run dev"
echo "Run api:   cd apps/api && npm run dev"
echo "Run worker: cd apps/worker && npm start"
