#!/usr/bin/env bash
# Idempotent dependency setup for the Jalur APEXGP monorepo (backend + frontend).
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

# The default image ships Python 3.12 but not the venv/ensurepip module.
if ! dpkg -s python3-venv >/dev/null 2>&1; then
  sudo apt-get update -qq
  sudo apt-get install -y -qq python3-venv
fi

echo "==> Backend: virtualenv + dependencies"
cd "$REPO_ROOT/backend"
if [ ! -d venv ]; then
  python3 -m venv venv
fi
# shellcheck disable=SC1091
source venv/bin/activate
python -m pip install --upgrade pip -q
pip install -r requirements.txt
[ -f .env ] || cp .env.example .env
deactivate

echo "==> Frontend: npm dependencies"
cd "$REPO_ROOT/frontend"
if [ -f package-lock.json ]; then
  npm ci
else
  npm install
fi
[ -f .env.local ] || cp .env.example .env.local

echo "==> Install complete"
