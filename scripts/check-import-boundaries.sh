#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$root"

failures=0

check_pattern() {
  local label="$1"
  local pattern="$2"
  local search_path="$3"

  if matches="$(rg -n "$pattern" "$search_path" --glob '!node_modules' --glob '!dist' --glob '!.svelte-kit' 2>/dev/null || true)"; then
    if [[ -n "$matches" ]]; then
      echo "Boundary violation: $label"
      echo "$matches"
      echo
      failures=$((failures + 1))
    fi
  fi
}

# Runtime must not depend on HTTP transport.
check_pattern \
  "runtime imports http" \
  "from [\"']@/http" \
  "apps/api/src/runtime"

# Core package must stay infrastructure-free.
check_pattern \
  "core imports integrations" \
  "from [\"']@edaya/(neon-migrations|betterauth-d1-migrations)" \
  "packages/core/src"

check_pattern \
  "core imports apps" \
  "from [\"']@/" \
  "packages/core/src"

# Packages must not depend on integrations.
check_pattern \
  "packages import integrations" \
  "from [\"']@edaya/(neon-migrations|betterauth-d1-migrations)" \
  "packages"

if [[ "$failures" -gt 0 ]]; then
  echo "$failures boundary check(s) failed."
  exit 1
fi

echo "Import boundary checks passed."
