#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

cleanup() {
  if [[ -n "${API_PID:-}" ]]; then kill "$API_PID" >/dev/null 2>&1 || true; fi
  if [[ -n "${WEB_PID:-}" ]]; then kill "$WEB_PID" >/dev/null 2>&1 || true; fi
}
trap cleanup EXIT INT TERM

echo "Starting API on http://127.0.0.1:4000 ..."
(
  cd "$ROOT/apps/api"
  npm run dev
) &
API_PID=$!

echo "Starting Web on http://127.0.0.1:3000 ..."
(
  cd "$ROOT/apps/web"
  npm run dev -- --hostname 127.0.0.1 --port 3000
) &
WEB_PID=$!

echo "\nMVP running:"
echo "- UI:  http://127.0.0.1:3000"
echo "- API: http://127.0.0.1:4000"
echo "Press Ctrl+C to stop both."

wait "$API_PID" "$WEB_PID"
