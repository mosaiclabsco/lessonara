#!/usr/bin/env bash
set -euo pipefail
cd /opt/lessonara-classroom
test "$(docker compose ps --status running --services | wc -l)" -eq 4
curl --fail --silent --show-error --max-time 10 -o /dev/null http://127.0.0.1:8000/
curl --fail --silent --show-error --max-time 10 -o /dev/null http://127.0.0.1:8080/about/health
systemctl is-active --quiet caddy
logger -t lessonara-health 'Classroom local health checks passed'
