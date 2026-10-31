#!/usr/bin/env bash
set -euo pipefail
umask 077
backup=/root/lessonara-recovery/hardening-before
test -d "$backup"
test -d "$backup/ufw" || cp -a /etc/ufw "$backup/ufw"
test -e "$backup/Caddyfile" || cp /etc/caddy/Caddyfile "$backup/Caddyfile"
cat > "$backup/rollback-network.sh" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
cp -a /root/lessonara-recovery/hardening-before/ufw/. /etc/ufw/
ufw reload
cp /root/lessonara-recovery/hardening-before/Caddyfile /etc/caddy/Caddyfile
caddy validate --config /etc/caddy/Caddyfile >/dev/null
systemctl reload caddy
EOF
chmod 700 "$backup/rollback-network.sh"
systemd-run --unit=lessonara-network-rollback --on-active=5m "$backup/rollback-network.sh"
/usr/local/sbin/lessonara-cloudflare-firewall
# Remove only the previous unrestricted HTTPS rules, after the allowlist is in place.
ufw --force delete allow 443/tcp
# The bridge publishes IPv4 only. Preserve IPv4 media while removing the unused IPv6 rule.
ufw --force delete allow proto udp from ::/0 to any port 10000 || true
python3 - <<'PY'
from pathlib import Path
p=Path('/etc/caddy/Caddyfile')
s=p.read_text()
if 'protocols h1 h2' not in s:
 s=s.replace('admin localhost:2019','admin localhost:2019\n    servers {\n        protocols h1 h2\n    }')
p.write_text(s)
PY
caddy validate --config /etc/caddy/Caddyfile >/dev/null
systemctl reload caddy
cat > /etc/systemd/system/lessonara-cloudflare-firewall.service <<'EOF'
[Unit]
Description=Refresh validated Cloudflare HTTPS origin allowlist
After=network-online.target
[Service]
Type=oneshot
ExecStart=/usr/local/sbin/lessonara-cloudflare-firewall
EOF
cat > /etc/systemd/system/lessonara-cloudflare-firewall.timer <<'EOF'
[Unit]
Description=Weekly Cloudflare origin allowlist refresh
[Timer]
OnCalendar=weekly
RandomizedDelaySec=1h
Persistent=true
[Install]
WantedBy=timers.target
EOF
systemctl daemon-reload
systemctl enable --now lessonara-cloudflare-firewall.timer
ufw status verbose
printf 'Network hardened; rollback stays armed until public HTTPS and separate SSH are verified.\n'
