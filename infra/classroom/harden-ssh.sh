#!/usr/bin/env bash
set -euo pipefail
umask 077
backup=/root/lessonara-recovery/hardening-before
install -d -m 700 "$backup"
cp -an /etc/ssh/sshd_config.d/00-lessonara.conf "$backup/00-lessonara.conf"
cat > "$backup/rollback-ssh.sh" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
cp /root/lessonara-recovery/hardening-before/00-lessonara.conf /etc/ssh/sshd_config.d/00-lessonara.conf
sshd -t
systemctl reload ssh
EOF
chmod 700 "$backup/rollback-ssh.sh"
systemd-run --unit=lessonara-ssh-rollback --on-active=5m "$backup/rollback-ssh.sh"
cat > /etc/ssh/sshd_config.d/00-lessonara.conf <<'EOF'
PasswordAuthentication no
KbdInteractiveAuthentication no
PubkeyAuthentication yes
AuthenticationMethods publickey
PermitRootLogin no
AllowUsers lessonara-admin
MaxAuthTries 3
LoginGraceTime 30
MaxStartups 10:30:30
AllowAgentForwarding no
AllowTcpForwarding no
AllowStreamLocalForwarding no
X11Forwarding no
PermitTunnel no
PermitUserEnvironment no
EOF
sshd -t
systemctl reload ssh
printf 'SSH hardened; rollback stays armed until an independent sudo session succeeds.\n'
