#!/usr/bin/env bash
set -euo pipefail
umask 077
dest=/root/lessonara-recovery
recipient=$(cat "$dest/recipient.txt")
name="lessonara-config-$(date -u +%Y%m%dT%H%M%SZ).tar.gz.age"
tar -czf - -C / \
  opt/lessonara-classroom/.env \
  opt/lessonara-classroom/docker-compose.yml \
  opt/lessonara-classroom/compose.override.yml \
  opt/lessonara-classroom/config/web/custom-config.js \
  opt/lessonara-classroom/config/web/custom-interface_config.js \
  opt/lessonara-classroom/config/prosody/prosody-plugins-custom \
  etc/caddy/Caddyfile etc/ssh/sshd_config.d/00-lessonara.conf \
  usr/local/sbin/lessonara-docker-ingress \
  usr/local/sbin/lessonara-classroom-backup \
  usr/local/sbin/lessonara-classroom-health \
  etc/systemd/system/lessonara-docker-ingress.service \
  etc/systemd/system/lessonara-classroom-backup.service \
  etc/systemd/system/lessonara-classroom-backup.timer \
  etc/systemd/system/lessonara-classroom-health.service \
  etc/systemd/system/lessonara-classroom-health.timer \
  | age -r "$recipient" -o "$dest/$name.partial"
mv "$dest/$name.partial" "$dest/$name"
find "$dest" -maxdepth 1 -name 'lessonara-config-*.tar.gz.age' -mtime +14 -delete
logger -t lessonara-backup 'Encrypted classroom configuration backup completed'
