#!/usr/bin/env bash
# Local, model-free ARTEX UI lifecycle. Never source runtime.env (it is data).
set -euo pipefail
umask 077

repo_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd)"
cd -- "$repo_root"
# This lock is reviewed repository code, not downloaded input.
source src/artex/source.lock
work_dir="$repo_root/var/artex"
compose=(docker compose --project-name agenttic-artex-ui
  --env-file "$work_dir/runtime.env" -f "$repo_root/src/artex/compose.yaml")

setup() {
  for dependency in curl tar sha256sum openssl docker; do
    command -v "$dependency" >/dev/null || { echo "Missing: $dependency" >&2; exit 1; }
  done
  mkdir -p -- "$work_dir" "$work_dir/data" "$work_dir/keys" "$work_dir/evidence"
  if [[ -e "$work_dir/source" ]]; then
    if [[ ! -f "$work_dir/source-revision" ]] || [[ "$(cat "$work_dir/source-revision")" != "$ARTEX_REV" ]]; then
      echo 'Existing source has no matching revision record; refusing to replace it.' >&2
      exit 1
    fi
  else
    local archive="$work_dir/source.tar.gz"
    curl --fail --location --proto '=https' --tlsv1.2 --retry 2 \
      "https://codeload.github.com/BaaRai/ARTEX/tar.gz/$ARTEX_REV" --output "$archive"
    printf '%s  %s\n' "$ARTEX_ARCHIVE_SHA256" "$archive" | sha256sum --check --status
    local stage
    stage="$(mktemp -d "$work_dir/source-staging.XXXXXX")"
    # Preserve executable/read bits inside the private parent. Applying umask 077
    # to upstream files makes root-owned COPY results unreadable to the runtime UID.
    tar --extract --gzip --file "$archive" --directory "$stage" --strip-components=1 --no-same-owner --same-permissions
    mv -- "$stage" "$work_dir/source"
    printf '%s\n' "$ARTEX_REV" > "$work_dir/source-revision"
  fi
  if [[ ! -e "$work_dir/runtime.env" ]]; then
    local db_password
    db_password="$(openssl rand -hex 32)"
    (set -o noclobber
      printf 'POSTGRES_PASSWORD=%s\nARTEX_REV=%s\nARTEX_UID=%s\nARTEX_GID=%s\n' \
        "$db_password" "$ARTEX_REV" "$(id -u)" "$(id -g)" > "$work_dir/runtime.env")
    unset db_password
  fi
  "${compose[@]}" config --quiet
  echo 'Setup ready. Credentials and runtime state are under ignored var/artex/.'
}

case "${1:-help}" in
  setup) setup ;;
  config) "${compose[@]}" config --quiet ;;
  build) "${compose[@]}" build artex ;;
  up) "${compose[@]}" up -d --no-build --wait --wait-timeout 180 ;;
  status) "${compose[@]}" ps --all ;;
  stop) "${compose[@]}" stop -t 10 ;;
  *) echo 'Usage: bash src/artex/artex.sh {setup|config|build|up|status|stop}'; exit 2 ;;
esac
