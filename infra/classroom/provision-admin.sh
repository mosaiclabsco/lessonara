#!/usr/bin/env bash
set -euo pipefail
umask 077
admin=lessonara-admin
id "$admin" >/dev/null 2>&1 || useradd --create-home --shell /bin/bash "$admin"
install -d -m 700 -o "$admin" -g "$admin" "/home/$admin/.ssh"
# Retain the already authorized VPS key; no other identity is introduced.
install -m 600 -o "$admin" -g "$admin" /root/.ssh/authorized_keys "/home/$admin/.ssh/authorized_keys"
printf '%s\n' "$admin ALL=(ALL) NOPASSWD: ALL" > /etc/sudoers.d/lessonara-admin
chmod 440 /etc/sudoers.d/lessonara-admin
visudo -cf /etc/sudoers.d/lessonara-admin
printf 'Administration account prepared; root SSH remains unchanged until the new session is verified.\n'
