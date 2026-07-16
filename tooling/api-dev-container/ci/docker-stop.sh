#!/usr/bin/env bash
set -euo pipefail

CONTAINER_NAME="${EDAYA_API_DEV_CONTAINER:-edaya-api-dev}"
docker rm -f "$CONTAINER_NAME" 2>/dev/null || true
