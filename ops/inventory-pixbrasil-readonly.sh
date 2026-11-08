#!/usr/bin/env bash
# Read-only inventory: no deploy, restart, migration, credentials or logs.
set -uo pipefail

printf 'PiXBrasil / XPAYMENTS read-only inventory\n'
printf 'Host: %s\n' "$(hostname)"
printf 'UTC: %s\n' "$(date -u +%FT%TZ)"

printf '\nRepository candidates (bounded search)\n'
for root in /opt /srv /root /home; do
  [ -d "$root" ] || continue
  while IFS= read -r directory; do
    [ -d "$directory/.git" ] || continue
    printf '\nRepository: %s\n' "$directory"
    git -c safe.directory="$directory" -C "$directory" rev-parse HEAD 2>/dev/null || true
    git -c safe.directory="$directory" -C "$directory" branch --show-current 2>/dev/null || true
    printf 'Local change count: '
    git -c safe.directory="$directory" -C "$directory" status --porcelain 2>/dev/null | wc -l
  done < <(find "$root" -maxdepth 4 -type d \( -iname '*pixbrasil*' -o -iname '*xpayments*' \) 2>/dev/null)
done

printf '\nRelevant containers (names, images, status, ports only)\n'
if command -v docker >/dev/null 2>&1; then
  docker ps -a --format '{{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}' 2>/dev/null |
    awk 'tolower($0) ~ /pixbrasil|xpayments|caddy/'
  printf '\nExpected edge network\n'
  docker network ls --format '{{.Name}}' 2>/dev/null |
    awk '$0 == "platform_edge" || $0 == "pixbrasil-internal"'
else
  printf 'Docker unavailable\n'
fi

printf '\nConfiguration existence (contents deliberately omitted)\n'
for item in /etc/pixbrasil/api.env /etc/caddy/Caddyfile; do
  if [ -f "$item" ]; then printf '%s: present\n' "$item"; else printf '%s: absent\n' "$item"; fi
done

printf '\nRelevant systemd unit names\n'
if command -v systemctl >/dev/null 2>&1; then
  systemctl list-unit-files --no-legend --no-pager 2>/dev/null |
    awk 'tolower($1) ~ /pixbrasil|xpayments|caddy/ { print $1, $2 }'
fi

printf '\nListener ports (process details omitted)\n'
if command -v ss >/dev/null 2>&1; then
  ss -ltnH 2>/dev/null |
    awk '$4 ~ /:(80|443|3000|8080|8084)$/ { print $1, $4 }'
fi

printf '\nInventory complete. No remote origin URLs, environment values or logs were read.\n'
