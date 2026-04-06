#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

# Load .env
if [ -f .env ]; then
  set -a
  source .env
  set +a
else
  echo "ERROR: robot/.env not found. Copy .env.example to .env and fill in your credentials."
  exit 1
fi

if [ -z "${WEB_ADMIN_PASSWORD:-}" ]; then
  echo "ERROR: WEB_ADMIN_PASSWORD is not set in .env"
  exit 1
fi

source .venv/bin/activate

robot \
  --outputdir results \
  --variable BASE_URL:"${BASE_URL:-https://dev.daltime.com}" \
  --variable WEB_ADMIN_EMAIL:"${WEB_ADMIN_EMAIL:-robot-dev@daltime.com}" \
  --variable WEB_ADMIN_PASSWORD:"$WEB_ADMIN_PASSWORD" \
  --variable COGNITO_REGION:"${COGNITO_REGION:-us-east-1}" \
  --variable COGNITO_CLIENT_ID:"${COGNITO_CLIENT_ID:-1nl13tbaqb47s8f0tfc07lc24m}" \
  "$@" \
  tests/
