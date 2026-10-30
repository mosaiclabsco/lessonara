#!/usr/bin/env bash
set -euo pipefail
install -m 750 /root/lessonara-setup/docker-ingress.sh /usr/local/sbin/lessonara-docker-ingress
install -m 750 /root/lessonara-setup/backup.sh /usr/local/sbin/lessonara-classroom-backup
install -m 750 /root/lessonara-setup/health.sh /usr/local/sbin/lessonara-classroom-health
cat > /etc/systemd/system/lessonara-docker-ingress.service <<'EOF'
[Unit]
Description=Limit published Docker ingress to classroom media
After=docker.service
Requires=docker.service
PartOf=docker.service
[Service]
Type=oneshot
ExecStart=/usr/local/sbin/lessonara-docker-ingress
RemainAfterExit=yes
[Install]
WantedBy=docker.service
EOF
cat > /etc/systemd/system/lessonara-classroom-backup.service <<'EOF'
[Unit]
Description=Encrypted classroom configuration backup
After=docker.service
[Service]
Type=oneshot
ExecStart=/usr/local/sbin/lessonara-classroom-backup
EOF
cat > /etc/systemd/system/lessonara-classroom-backup.timer <<'EOF'
[Unit]
Description=Daily encrypted classroom configuration backup
[Timer]
OnCalendar=daily
RandomizedDelaySec=15m
Persistent=true
[Install]
WantedBy=timers.target
EOF
cat > /etc/systemd/system/lessonara-classroom-health.service <<'EOF'
[Unit]
Description=Check classroom containers and local endpoints
After=docker.service
[Service]
Type=oneshot
ExecStart=/usr/local/sbin/lessonara-classroom-health
EOF
cat > /etc/systemd/system/lessonara-classroom-health.timer <<'EOF'
[Unit]
Description=Check classroom health every minute
[Timer]
OnBootSec=2m
OnUnitActiveSec=1m
[Install]
WantedBy=timers.target
EOF
systemctl daemon-reload
systemctl enable --now lessonara-docker-ingress.service
systemctl start lessonara-classroom-health.service lessonara-classroom-backup.service
systemctl enable --now lessonara-classroom-health.timer lessonara-classroom-backup.timer
