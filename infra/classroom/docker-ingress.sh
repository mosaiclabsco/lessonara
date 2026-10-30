#!/usr/bin/env bash
set -euo pipefail
iptables -N LESSONARA-INGRESS 2>/dev/null || true
iptables -F LESSONARA-INGRESS
iptables -A LESSONARA-INGRESS -m conntrack --ctstate ESTABLISHED,RELATED -j RETURN
iptables -A LESSONARA-INGRESS -p udp --dport 10000 -j RETURN
iptables -A LESSONARA-INGRESS -j DROP
iptables -C DOCKER-USER -i eth0 -j LESSONARA-INGRESS 2>/dev/null || iptables -I DOCKER-USER 1 -i eth0 -j LESSONARA-INGRESS
