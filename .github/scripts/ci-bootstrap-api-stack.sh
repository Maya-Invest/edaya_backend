#!/usr/bin/env bash
set -euo pipefail

repo_root="${1:-.}"
cd "$repo_root"

cp -n apps/api/.env.example apps/api/.env
if [ -f .env.example ]; then
  cp -n .env.example .env
fi

bun dev > /tmp/edaya-api-dev.log 2>&1 &
echo $! > /tmp/edaya-api-dev.pid

"$(dirname "$0")/ci-wait-for-url.sh" http://localhost:9999/reference 90

bun seed
