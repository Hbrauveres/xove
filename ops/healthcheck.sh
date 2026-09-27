#!/usr/bin/env bash
# Waits until the api and web containers of this compose project answer.
# Used by the pipeline ("2 · Validate build") and by ops/deploy.sh.
#
# Usage: ops/healthcheck.sh [timeout-seconds]   (run from the repo root)
set -euo pipefail

timeout="${1:-120}"
deadline=$(( SECONDS + timeout ))

api_up() {
  docker compose exec -T api wget -qO- http://localhost:8080/api/health 2>/dev/null | grep -q '"status":"UP"'
}

web_up() {
  docker compose exec -T web wget -qO- http://localhost/ 2>/dev/null | grep -qi '<div id="root">'
}

until api_up && web_up; do
  if (( SECONDS >= deadline )); then
    echo "healthcheck: not healthy after ${timeout}s" >&2
    echo "  api: $(api_up && echo up || echo down)   web: $(web_up && echo up || echo down)" >&2
    exit 1
  fi
  sleep 3
done

echo "healthcheck: api and web are up"
