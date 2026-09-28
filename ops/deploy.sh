#!/usr/bin/env bash
# Deploys one commit of Xovê to this checkout, using the images the pipeline
# already built and published. If the new version doesn't come up healthy, it
# rolls back to the version that was running before and exits with an error.
#
# The pipeline reaches it over SSH with a key that can run nothing else
# (a forced command in authorized_keys), so the request arrives in
# $SSH_ORIGINAL_COMMAND. You can also run it by hand from the checkout:
#
#   ops/deploy.sh deploy <full-commit-sha>   deploy that commit
#   ops/deploy.sh rollback                   go back to the previous deploy
#   ops/deploy.sh status                     what's running and what ran before
#
# Settings and secrets aren't kept here: before every deploy or rollback, the
# environment's .env is built from infra/config/<env>.yaml and 1Password with
# infra's ops/build-env (spec 0043). The environment is this checkout's folder
# name (xove-stage → stage, xove → prod), or XOVE_ENV.
#
# State lives next to the checkout, outside git:
#   .deploy/image.env    IMAGE_TAG=<tag> of the running images
#   .deploy/history      one line per healthy deploy: <date> <commit> <tag>
set -euo pipefail

IMAGE_PREFIX="ghcr.io/hbrauveres/xove"
HEALTH_TIMEOUT=180
INFRA_DIR="${INFRA_DIR:-/srv/infra}"

# Everything lives in main(), called on the last line: bash reads the whole
# function before running it, so updating this file with git mid-run is safe.
main() {
  APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
  cd "$APP_DIR"
  mkdir -p .deploy
  touch .deploy/history .deploy/image.env

  ENVIRONMENT="${XOVE_ENV:-$(basename "$APP_DIR" | sed -n 's/^xove-//p')}"
  ENVIRONMENT="${ENVIRONMENT:-prod}"
  # Every docker compose call below (and in ops/healthcheck.sh) reads these.
  export COMPOSE_ENV_FILES="$INFRA_DIR/generated/$ENVIRONMENT.env,.deploy/image.env"

  local request="${SSH_ORIGINAL_COMMAND:-$*}"
  local action commit extra
  read -r action commit extra <<<"$request" || true

  if [[ -n "${extra:-}" ]]; then
    fail "unexpected arguments: $request"
  fi

  case "${action:-}" in
    deploy)
      [[ "${commit:-}" =~ ^[0-9a-f]{40}$ ]] || fail "deploy needs a full 40-character commit sha"
      deploy "$commit"
      ;;
    rollback) rollback_to_previous ;;
    status) status ;;
    *) fail "usage: deploy <commit-sha> | rollback | status" ;;
  esac
}

log() { echo "[deploy $(date -u +%H:%M:%S)] $*"; }
fail() { echo "[deploy] error: $*" >&2; exit 1; }

tag_for() { echo "sha-${1:0:12}"; }

# The running tag; before the first deploy with the vault, it was kept in .env.
current_tag() {
  local tag
  tag="$(sed -n 's/^IMAGE_TAG=//p' .deploy/image.env | tail -n 1)"
  if [[ -z "$tag" && -f .env ]]; then
    tag="$(sed -n 's/^IMAGE_TAG=//p' .env | tail -n 1)"
  fi
  echo "$tag"
}

set_tag() { printf 'IMAGE_TAG=%s\n' "$1" > .deploy/image.env; }

# Builds this environment's .env from infra/config and 1Password. Fails, and
# changes nothing, if a setting or secret is missing.
build_env() {
  log "building the $ENVIRONMENT settings from infra/config and 1Password"
  "$INFRA_DIR/ops/build-env" "$ENVIRONMENT" || fail "couldn't build the $ENVIRONMENT settings; nothing was changed"
}

# Puts the checkout on <commit> and runs the images tagged <tag>.
# Each line checks itself: `set -e` doesn't apply inside a function that is
# called as an `if` condition, which is how deploy() uses this one.
switch_to() {
  local commit="$1" tag="$2"
  git fetch --quiet origin || return 1
  git reset --quiet --hard "$commit" || return 1
  set_tag "$tag" || return 1
  docker compose pull --quiet web api || return 1
  docker compose up -d --no-build --remove-orphans || return 1
}

deploy() {
  local commit="$1" tag
  tag="$(tag_for "$commit")"
  local previous_commit previous_tag
  previous_commit="$(git rev-parse HEAD)"
  previous_tag="$(current_tag)"

  build_env
  log "deploying ${commit:0:12} as $tag (was ${previous_tag:-nothing} at ${previous_commit:0:12})"
  if switch_to "$commit" "$tag" && ops/healthcheck.sh "$HEALTH_TIMEOUT"; then
    echo "$(date -u +%FT%TZ) $commit $tag" >> .deploy/history
    docker image prune -f >/dev/null
    log "ok: $tag is live"
    return 0
  fi

  log "new version is not healthy; last logs:"
  docker compose logs --tail 40 api web || true

  if [[ -z "$previous_tag" || "$previous_tag" == "local" ]]; then
    fail "no earlier pipeline deploy to roll back to; fix forward"
  fi
  log "rolling back to $previous_tag"
  if switch_to "$previous_commit" "$previous_tag" && ops/healthcheck.sh "$HEALTH_TIMEOUT"; then
    fail "deploy of ${commit:0:12} failed; rolled back to $previous_tag"
  fi
  fail "deploy failed AND rollback failed; check 'docker compose ps' and the logs"
}

rollback_to_previous() {
  local line
  line="$(tail -n 2 .deploy/history | head -n 1)"
  [[ "$(wc -l < .deploy/history)" -ge 2 ]] || fail "no previous deploy in .deploy/history"
  local commit tag
  commit="$(awk '{print $2}' <<<"$line")"
  tag="$(awk '{print $3}' <<<"$line")"
  build_env
  log "rolling back to $tag (${commit:0:12})"
  switch_to "$commit" "$tag"
  ops/healthcheck.sh "$HEALTH_TIMEOUT"
  echo "$(date -u +%FT%TZ) $commit $tag rollback" >> .deploy/history
  log "ok: $tag is live again"
}

status() {
  echo "checkout: $(git rev-parse --short=12 HEAD) on $(git rev-parse --abbrev-ref HEAD)"
  echo "running:  $(current_tag)"
  echo "settings: $INFRA_DIR/generated/$ENVIRONMENT.env"
  echo "images:   ${IMAGE_PREFIX}-api, ${IMAGE_PREFIX}-web"
  echo "last deploys:"
  tail -n 5 .deploy/history | sed 's/^/  /'
  docker compose ps --format 'table {{.Name}}\t{{.Status}}'
}

main "$@"
exit
