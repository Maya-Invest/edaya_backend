#!/usr/bin/env bash
set -euo pipefail

if [ -f /tmp/edaya-api-dev.pid ]; then
  kill "$(cat /tmp/edaya-api-dev.pid)" 2>/dev/null || true
  rm -f /tmp/edaya-api-dev.pid
fi
