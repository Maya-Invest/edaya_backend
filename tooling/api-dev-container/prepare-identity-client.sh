#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
IDENTITY_SRC="${EDAYA_IDENTITY_SRC:-$REPO_ROOT/../edaya_identity}"
DEST="$REPO_ROOT/.ci/edaya_identity"

if [ ! -f "$IDENTITY_SRC/package/identity-client/package.json" ]; then
  echo "edaya_identity not found at $IDENTITY_SRC" >&2
  echo "Check out the sibling repo or set EDAYA_IDENTITY_SRC." >&2
  exit 1
fi

src_real="$(cd "$IDENTITY_SRC" && pwd)"
if [ -d "$DEST" ]; then
  dest_real="$(cd "$DEST" && pwd)"
  if [ "$src_real" = "$dest_real" ]; then
    echo "Identity checkout is already at $DEST"
    exit 0
  fi
fi

rm -rf "$DEST"
mkdir -p "$DEST"
tar -C "$IDENTITY_SRC" \
  --exclude=node_modules \
  --exclude=.data \
  --exclude=.git \
  --exclude=.turbo \
  --exclude=.ci \
  -cf - . | tar -C "$DEST" -xf -
