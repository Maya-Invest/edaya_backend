#!/usr/bin/env bash
set -euo pipefail

if ! command -v container >/dev/null 2>&1; then
  cat <<'EOF'
Apple Container CLI not found.

Install (macOS 26, Apple silicon):
  1. Download the signed installer from:
     https://github.com/apple/container/releases/latest
  2. Open container-*-installer-signed.pkg
  3. container system start

Docker is not required — `container build` and `container run` use the same Dockerfile.
EOF
  exit 1
fi

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$REPO_ROOT"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
IMAGE_NAME="${EDAYA_API_DEV_IMAGE:-edaya-api-dev}"
CONTAINER_NAME="${EDAYA_API_DEV_CONTAINER:-edaya-api-dev}"

container system start

action="${1:-up}"

case "$action" in
  build)
    bash "$SCRIPT_DIR/prepare-identity-client.sh"
    container build --tag "$IMAGE_NAME" --file tooling/api-dev-container/Dockerfile .
    ;;
  up)
    bash "$SCRIPT_DIR/prepare-identity-client.sh"
    container build --tag "$IMAGE_NAME" --file tooling/api-dev-container/Dockerfile .
    container stop "$CONTAINER_NAME" 2>/dev/null || true
    container rm "$CONTAINER_NAME" 2>/dev/null || true
    container run \
      --name "$CONTAINER_NAME" \
      --detach \
      --rm \
      --publish 127.0.0.1:9900:9900 \
      --publish 127.0.0.1:9999:9999 \
      --publish 127.0.0.1:9200:9200 \
      --memory 4g \
      "$IMAGE_NAME"
    bash "$SCRIPT_DIR/wait-for-url.sh" http://127.0.0.1:9900/ 120
    bash "$SCRIPT_DIR/wait-for-url.sh" http://127.0.0.1:9999/reference 120
    echo
    echo "Edaya API dev container is up."
    echo "  Identity:   http://localhost:9900"
    echo "  API:        http://localhost:9999"
    echo "  OpenAPI:    http://localhost:9999/reference"
    echo "  Files:      http://localhost:9200"
    echo
    echo "Mobile:  EDAYA_AUTH_URL=http://localhost:9900 EDAYA_API_URL=http://localhost:9999 melos run test:integration"
    echo "Web:     WEBAPP_URL=http://localhost:5173 (run webapp locally; API is containerized)"
    echo "Logs:    $0 logs"
    echo "Stop:    $0 down"
    ;;
  down)
    container stop "$CONTAINER_NAME"
    ;;
  logs)
    container logs "$CONTAINER_NAME" -f
    ;;
  *)
    echo "Usage: $0 {up|build|down|logs}"
    exit 1
    ;;
esac
