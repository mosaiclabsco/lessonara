#!/usr/bin/env bash
set -euo pipefail
export DEBIAN_FRONTEND=noninteractive
install -d -m 700 /root/lessonara-recovery
cp -an /etc/ssh/sshd_config /root/lessonara-recovery/sshd_config.before
if [ ! -e /root/lessonara-recovery/sshd-effective.before ]; then sshd -T > /root/lessonara-recovery/sshd-effective.before; fi
admin_ip=${SSH_CONNECTION%% *}
test -n "$admin_ip"
ufw allow from "$admin_ip" to any port 22 proto tcp comment 'Lessonara administration'
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 10000/udp
ufw default deny incoming
ufw default allow outgoing
ufw --force enable
printf '%s\n' 'PasswordAuthentication no' 'KbdInteractiveAuthentication no' 'PermitRootLogin prohibit-password' > /etc/ssh/sshd_config.d/00-lessonara.conf
sshd -t
systemctl reload ssh
apt-get update -qq
apt-get install -y -qq ca-certificates curl caddy age fail2ban
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
chmod a+r /etc/apt/keyrings/docker.asc
cat > /etc/apt/sources.list.d/docker.sources <<'EOF'
Types: deb
URIs: https://download.docker.com/linux/ubuntu
Suites: noble
Components: stable
Architectures: amd64
Signed-By: /etc/apt/keyrings/docker.asc
EOF
apt-get update -qq
apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
install -d -m 755 /etc/docker
cat > /etc/docker/daemon.json <<'EOF'
{"log-driver":"local","log-opts":{"max-size":"10m","max-file":"3"},"live-restore":true}
EOF
systemctl restart docker
printf '%s\n' '[sshd]' 'enabled = true' 'backend = systemd' 'maxretry = 5' 'bantime = 1h' > /etc/fail2ban/jail.d/lessonara.local
systemctl enable --now fail2ban
systemctl enable docker caddy
install -d -m 700 /opt/lessonara-classroom
printf '\nBootstrap complete\n'
docker --version
docker compose version
ufw status
