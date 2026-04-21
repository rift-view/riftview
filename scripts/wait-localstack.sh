#!/usr/bin/env bash
# Poll LocalStack's health endpoint until it reports ready, up to a timeout.
# Used by `npm run localstack:up`. The CI job uses GHA's built-in --health-*
# options instead — this script is for local dev only.
#
# Usage: scripts/wait-localstack.sh [port] [timeout_seconds]
# Defaults: port=4566, timeout=60
set -euo pipefail

PORT="${1:-4566}"
TIMEOUT="${2:-60}"
URL="http://localhost:${PORT}/_localstack/health"

printf 'waiting for LocalStack at %s (timeout %ss)...\n' "$URL" "$TIMEOUT"

start=$(date +%s)
while true; do
  if curl -sf "$URL" >/dev/null 2>&1; then
    printf 'LocalStack is up.\n'
    exit 0
  fi
  now=$(date +%s)
  elapsed=$((now - start))
  if (( elapsed >= TIMEOUT )); then
    printf 'error: LocalStack did not become healthy within %ss\n' "$TIMEOUT" >&2
    printf 'check `docker compose -f .localstack/compose.yml logs`\n' >&2
    exit 1
  fi
  sleep 2
done
