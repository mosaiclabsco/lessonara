#!/usr/bin/env bash
set -euo pipefail
umask 077
dest=/root/lessonara-recovery
recipient=$(cat "$dest/recipient.txt")
name="lessonara-config-$(date -u +%Y%m%dT%H%M%SZ).tar.gz.age"
paths=(
  opt/lessonara-classroom/.env
  opt/lessonara-classroom/docker-compose.yml
  opt/lessonara-classroom/compose.override.yml
  opt/lessonara-classroom/config/web/custom-config.js
  opt/lessonara-classroom/config/web/custom-interface_config.js
  opt/lessonara-classroom/config/prosody/prosody-plugins-custom
  etc/caddy/Caddyfile
  etc/ssh/sshd_config.d/00-lessonara.conf
  etc/sudoers.d/lessonara-admin home/lessonara-admin/.ssh/authorized_keys
  etc/ufw etc/fail2ban/jail.d/lessonara.local
  usr/local/sbin/lessonara-docker-ingress
  usr/local/sbin/lessonara-cloudflare-firewall
  usr/local/sbin/lessonara-classroom-backup
  usr/local/sbin/lessonara-classroom-health
  etc/systemd/system/lessonara-docker-ingress.service
  etc/systemd/system/lessonara-cloudflare-firewall.service
  etc/systemd/system/lessonara-cloudflare-firewall.timer
  etc/systemd/system/lessonara-classroom-backup.service
  etc/systemd/system/lessonara-classroom-backup.timer
  etc/systemd/system/lessonara-classroom-health.service
  etc/systemd/system/lessonara-classroom-health.timer
  root/lessonara-recovery/recipient.txt
)
for optional in opt/lessonara-classroom/images.lock etc/caddy/lessonara-operations-auth.caddy usr/local/sbin/lessonara-classroom-operations etc/systemd/system/lessonara-classroom-operations.service; do
  test ! -e "/$optional" || paths+=("$optional")
done
trap 'rm -f "$dest/$name.partial"' EXIT
tar -czf - -C / "${paths[@]}" | age -r "$recipient" -o "$dest/$name.partial"
mv "$dest/$name.partial" "$dest/$name"
if test -d /var/lib/lessonara-backup-export; then
  install -o root -g caddy -m 640 "$dest/$name" /var/lib/lessonara-backup-export/latest.age.partial
  mv /var/lib/lessonara-backup-export/latest.age.partial /var/lib/lessonara-backup-export/latest.age
fi
# No storage credential or decryption identity is present on this host.
find "$dest" -maxdepth 1 -name 'lessonara-config-*.tar.gz.age' -mtime +14 -delete
logger -t lessonara-backup 'Encrypted classroom configuration backup completed'
