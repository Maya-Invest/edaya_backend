#!/usr/bin/env bash
set -euo pipefail

IMAGE="${EDAYA_API_DEV_IMAGE:?EDAYA_API_DEV_IMAGE is required}"
CONTAINER_NAME="${EDAYA_API_DEV_CONTAINER:-edaya-api-dev}"
WAIT_SCRIPT="${WAIT_SCRIPT:-tooling/api-dev-container/wait-for-url.sh}"

docker rm -f "$CONTAINER_NAME" 2>/dev/null || true
docker pull "$IMAGE"
docker run \
  --name "$CONTAINER_NAME" \
  --detach \
  --rm \
  --publish 127.0.0.1:9999:9999 \
  --publish 127.0.0.1:9200:9200 \
  --memory 4g \
  "$IMAGE"

bash "$WAIT_SCRIPT" http://127.0.0.1:9999/reference 120
echo "API dev container ready: $IMAGE"
