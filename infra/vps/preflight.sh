#!/usr/bin/env bash
set -u

echo "======================================================"
echo " PiXBrasil Atlas Financial VPS preflight"
echo "======================================================"

echo
echo "=== HOST ==="
hostnamectl 2>/dev/null || true
uname -a || true
uptime || true

echo
echo "=== CAPACITY ==="
df -hT / /var/lib/docker 2>/dev/null || df -hT / || true
free -h || true

echo
echo "=== DOCKER ==="
docker version --format 'Server={{.Server.Version}} Client={{.Client.Version}}' 2>/dev/null || docker --version || true
docker compose version 2>/dev/null || true
docker ps --format 'table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}' 2>/dev/null || true

echo
echo "=== DOCKER NETWORKS / VOLUMES ==="
docker network ls 2>/dev/null || true
docker volume ls 2>/dev/null || true

echo
echo "=== LISTENING PORTS ==="
ss -ltnp 2>/dev/null | grep -E '(:80 |:443 |:8080 |:8084 |:8085 |:6379 )' || true

echo
echo "=== CADDY ==="
caddy version 2>/dev/null || true
systemctl is-active caddy 2>/dev/null || true
systemctl --no-pager --full status caddy 2>/dev/null | sed -n '1,18p' || true

echo
echo "=== FIREWALL ==="
ufw status 2>/dev/null || true

echo
echo "=== DNS / TIME ==="
timedatectl 2>/dev/null | sed -n '1,12p' || true
getent hosts api.pixbrasil.org 2>/dev/null || true

echo
echo "=== TARGET PORT CHECK ==="
if ss -ltn 2>/dev/null | grep -q ':8085 '; then
  echo "PORT_8085=IN_USE"
else
  echo "PORT_8085=AVAILABLE"
fi

echo
echo "=== IMPORTANT ==="
echo "No environment variables or secret files were printed by this diagnostic."
