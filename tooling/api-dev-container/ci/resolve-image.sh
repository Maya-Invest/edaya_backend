#!/usr/bin/env bash
# Resolve the GHCR tag for api-dev integration tests from a git base branch name.
set -euo pipefail

BASE_REF="${1:?base ref required}"

OWNER="${GITHUB_REPOSITORY_OWNER:-maya-invest}"
OWNER="$(echo "$OWNER" | tr '[:upper:]' '[:lower:]')"

case "$BASE_REF" in
  main|master)
    CHANNEL=production
    ;;
  *)
    CHANNEL=staging
    ;;
esac

echo "ghcr.io/${OWNER}/edaya-api-dev:${CHANNEL}"
