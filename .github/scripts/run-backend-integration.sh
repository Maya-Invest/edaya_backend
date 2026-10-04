#!/usr/bin/env bash
set -euo pipefail
pg_bin="$(pg_config --bindir)"
test -x "$pg_bin/initdb"
test -x "$pg_bin/pg_ctl"
export PATH="$pg_bin:$PATH"
failed=0
for suite in test:integration test:integration:seed test:integration:native; do
  if bun run "$suite"; then :; else failed=1; fi
done
exit "$failed"
