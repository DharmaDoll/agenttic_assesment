#!/usr/bin/env bash
# Check the running UI deployment, without dumping container environments/secrets.
set -euo pipefail
repo_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd)"
cd -- "$repo_root"
compose=(docker compose -p agenttic-artex-ui --env-file var/artex/runtime.env -f src/artex/compose.yaml)
artex_id="$("${compose[@]}" ps -q artex)"
db_id="$("${compose[@]}" ps -q postgres)"
web_id="$("${compose[@]}" ps -q web)"
[[ -n "$artex_id" && -n "$db_id" && -n "$web_id" ]]
docker inspect --format '{{json .NetworkSettings.Ports}}' "$web_id" |
  jq -e '.["8080/tcp"] == [{"HostIp":"127.0.0.1","HostPort":"8787"}] and
    ([to_entries[] | select(.key != "8080/tcp") | .value | select(. != null and . != [])] | length == 0)' >/dev/null
for container_id in "$artex_id" "$db_id"; do
  docker inspect --format '{{json .NetworkSettings.Ports}}' "$container_id" |
    jq -e '[.[] | select(. != null and . != [])] | length == 0' >/dev/null
done
docker inspect --format '{{json .HostConfig}}' "$artex_id" |
  jq -e '.ReadonlyRootfs and (.Privileged == false) and
    (.CapDrop | index("ALL") != null) and
    (.SecurityOpt | any(startswith("no-new-privileges"))) and
    (.RestartPolicy.Name == "no")' >/dev/null
docker inspect --format '{{json .Config.User}}' "$artex_id" |
  jq -e 'test("^[1-9][0-9]*:[0-9]+$")' >/dev/null
for container_id in "$artex_id" "$db_id"; do
  network="$(docker inspect --format '{{json .NetworkSettings.Networks}}' "$container_id" |
    jq -er 'keys | if length == 1 then .[0] else error("unexpected network") end')"
  [[ "$(docker network inspect --format '{{.Internal}}' "$network")" == true ]]
  [[ "$(docker inspect --format '{{.State.Health.Status}}' "$container_id")" == healthy ]]
done
[[ "$(docker inspect --format '{{.State.Health.Status}}' "$web_id")" == healthy ]]
echo 'PASS: healthy services, loopback-only UI, unpublished DB/proxy, internal network and restricted ARTEX process'
