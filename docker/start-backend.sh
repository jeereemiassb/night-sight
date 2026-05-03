#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="${ROOT_DIR:-/workspace}"
API_HOST="${API_HOST:-0.0.0.0}"
API_PORT="${API_PORT:-8000}"

cd "${ROOT_DIR}"

exec uvicorn backend.main:app \
  --host "${API_HOST}" \
  --port "${API_PORT}" \
  --reload \
  --reload-dir "${ROOT_DIR}/backend"

