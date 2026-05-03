#!/usr/bin/env bash

set -euo pipefail

FRONTEND_DIR="${FRONTEND_DIR:-/workspace/frontend}"
FRONTEND_PORT="${FRONTEND_PORT:-5173}"

cd "${FRONTEND_DIR}"

if [[ ! -x node_modules/.bin/vite || "${FORCE_FRONTEND_INSTALL:-0}" == "1" ]]; then
  echo "Installing frontend dependencies..."
  npm install --no-package-lock --include=dev
fi

exec npm run dev -- --host 0.0.0.0 --port "${FRONTEND_PORT}"
