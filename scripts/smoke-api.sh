#!/usr/bin/env bash
set -euo pipefail

API_BASE="${API_BASE:-http://127.0.0.1:4000}"

echo "[1/5] health"
curl -fsS "$API_BASE/health" >/dev/null

echo "[2/5] create lead"
LEAD_ID=$(curl -fsS -X POST "$API_BASE/api/leads/intake" \
  -H 'content-type: application/json' \
  -d '{"fullName":"Smoke Test","email":"smoke@example.com","source":"smoke","message":"test"}' \
  | python3 -c 'import sys,json; print(json.load(sys.stdin)["lead"]["id"])')

echo "[3/5] list leads"
curl -fsS "$API_BASE/api/leads?limit=5" >/dev/null

echo "[4/5] update lead status"
curl -fsS -X PATCH "$API_BASE/api/leads/$LEAD_ID/status" \
  -H 'content-type: application/json' \
  -d '{"status":"contacted"}' >/dev/null

echo "[5/5] template preview"
curl -fsS -X POST "$API_BASE/api/templates/first-response/preview" \
  -H 'content-type: application/json' \
  -d '{"body":"Hey {{name}}","name":"Smoke"}' >/dev/null

echo "Smoke test passed ✅"
