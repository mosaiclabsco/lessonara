#!/usr/bin/env bash
set -euo pipefail
umask 077
drill=${1:?Isolated restore directory required}
case "$drill" in /opt/lessonara-restore-drill.*) ;; *) exit 64 ;; esac
test -d "$drill/opt/lessonara-classroom"
project="lessonara-restore-$(basename "$drill" | tr '[:upper:]' '[:lower:]' | tr -cd 'a-z0-9')"
base="$drill/opt/lessonara-classroom"
cp "$base/.env" "$drill/.env"
cp "$base/docker-compose.yml" "$drill/docker-compose.yml"
cp "$base/compose.override.yml" "$drill/compose.override.yml"
mkdir -p "$drill/config"/{web,prosody/config,prosody/prosody-plugins-custom,jicofo,jvb,storage/prosody,storage/transcripts,storage/web,tmp/web-crontabs,tmp/web-load-test}
cp "$base/config/web/"custom* "$drill/config/web/"
cp -a "$base/config/prosody/prosody-plugins-custom/." "$drill/config/prosody/prosody-plugins-custom/"
chown -R 1000:1000 "$drill/config"
python3 - "$drill" <<'PY'
from pathlib import Path
import secrets,sys
p=Path(sys.argv[1])
overrides={'CONFIG':str(p/'config'),'PUBLIC_URL':'http://lessonara-restore.invalid:8000','HTTP_PORT':'8000','HTTPS_PORT':'8443','JWT_APP_ID':'lessonara-restore-drill','JWT_ACCEPTED_ISSUERS':'lessonara-restore-drill','JWT_APP_SECRET':secrets.token_hex(32),'JICOFO_AUTH_PASSWORD':secrets.token_hex(32),'JVB_AUTH_PASSWORD':secrets.token_hex(32),'JVB_ADVERTISE_IPS':'127.0.0.1','JVB_DISABLE_STUN':'1','DISABLE_AWS_HARVESTER':'true'}
lines=[line for line in (p/'.env').read_text().splitlines() if line.split('=',1)[0] not in overrides]
(p/'.env').write_text('\n'.join(lines+[k+'='+v for k,v in overrides.items()])+'\n')
PY
cat > "$drill/drill.override.yml" <<'YAML'
services:
  web:
    restart: "no"
    ports: !reset []
    mem_limit: 512m
    cpus: 0.75
  prosody:
    restart: "no"
    ports: !reset []
    mem_limit: 512m
    cpus: 0.75
  jicofo:
    restart: "no"
    ports: !reset []
    mem_limit: 1g
    cpus: 1.0
  jvb:
    restart: "no"
    ports: !reset []
    mem_limit: 1g
    cpus: 1.0
networks:
  meet.jitsi:
    internal: true
YAML
compose=(docker compose --env-file "$drill/.env" -f "$drill/docker-compose.yml" -f "$drill/compose.override.yml" -f "$drill/drill.override.yml" -p "$project")
cleanup() {
  "${compose[@]}" down --volumes --remove-orphans >/dev/null 2>&1 || true
  python3 - "$drill" <<'PY'
import shutil,sys
from pathlib import Path
p=Path(sys.argv[1])
if p.parent==Path('/opt') and p.name.startswith('lessonara-restore-drill.'):
 shutil.rmtree(p)
PY
}
trap cleanup EXIT
"${compose[@]}" config --quiet
# Check bind mounts before any container can start. No live deployment volume may be reused.
"${compose[@]}" config --format json | python3 -c 'import json,sys,pathlib; d=json.load(sys.stdin); root=pathlib.Path(sys.argv[1]); assert d["networks"]["meet.jitsi"]["internal"]; [(None if pathlib.Path(v["source"]).is_relative_to(root) or v["source"]=="/etc/localtime" else sys.exit("Unsafe bind mount")) for s in d["services"].values() for v in s.get("volumes",[]) if v["type"]=="bind"]; assert all(not s.get("ports") for s in d["services"].values())' "$drill"
started=$(date +%s)
"${compose[@]}" up -d --pull never --no-build >/dev/null
ready=0
for attempt in $(seq 1 30); do
  if "${compose[@]}" exec -T web curl -fsS --max-time 2 -o /dev/null http://127.0.0.1:8000/ 2>/dev/null && "${compose[@]}" exec -T jvb curl -fsS --max-time 2 -o /dev/null http://127.0.0.1:8080/about/health 2>/dev/null; then ready=1; break; fi
  sleep 2
done
test "$ready" -eq 1
test "$("${compose[@]}" ps --status running --services | wc -l)" -eq 4
printf 'Isolated restored stack healthy: four containers, HTTP and bridge health. Runtime recovery: %ss.\n' "$(( $(date +%s)-started ))"
printf 'No public port, production volume, database or real call used. Cleaning up isolated stack.\n'
