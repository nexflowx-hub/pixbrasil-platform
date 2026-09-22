#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="${1:-$(pwd)}"
cd "$ROOT_DIR"

if [ ! -d .git ]; then
  echo "ERROR: run this script from the pixbrasil-platform repository root."
  exit 1
fi

if [ -n "$(git status --porcelain)" ]; then
  echo "ERROR: repository has local changes. Commit/stash them before production deploy."
  git status --short
  exit 1
fi

CURRENT_BRANCH="$(git branch --show-current)"
if [ "$CURRENT_BRANCH" != "main" ]; then
  echo "ERROR: production deploy requires branch main (current: $CURRENT_BRANCH)."
  exit 1
fi

echo "==> Fetching origin/main"
git fetch --prune origin main

LOCAL_SHA="$(git rev-parse HEAD)"
REMOTE_SHA="$(git rev-parse origin/main)"

if [ "$LOCAL_SHA" != "$REMOTE_SHA" ]; then
  echo "==> Fast-forwarding main"
  git pull --ff-only origin main
fi

TARGET_SHA="$(git rev-parse HEAD)"
export PIXBRASIL_BUILD_SHA="$TARGET_SHA"

echo "==> Deploying PiXBrasil API release $TARGET_SHA"

COMPOSE=(docker compose -f infra/vps/docker-compose.yml)

echo "==> Building API image"
"${COMPOSE[@]}" build --pull pixbrasil-api

echo "==> Restarting API only"
"${COMPOSE[@]}" up -d --no-deps pixbrasil-api

echo "==> Waiting for container health"
deadline=$((SECONDS + 90))
while [ "$SECONDS" -lt "$deadline" ]; do
  status="$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' pixbrasil-api 2>/dev/null || true)"
  if [ "$status" = "healthy" ]; then
    break
  fi
  if [ "$status" = "unhealthy" ]; then
    echo "ERROR: pixbrasil-api became unhealthy."
    docker logs --tail 120 pixbrasil-api || true
    exit 1
  fi
  sleep 3
done

status="$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' pixbrasil-api 2>/dev/null || true)"
if [ "$status" != "healthy" ]; then
  echo "ERROR: API did not become healthy within 90 seconds (status=$status)."
  docker logs --tail 120 pixbrasil-api || true
  exit 1
fi

echo "==> Verifying health and route map inside container"
docker exec pixbrasil-api node -e '
const expected = process.env.APP_BUILD_SHA || "";
const base = "http://127.0.0.1:8080";
const account = "00000000-0000-0000-0000-000000000000";
(async () => {
  const health = await fetch(base + "/api/health");
  if (!health.ok) throw new Error("health HTTP " + health.status);
  const body = await health.json();
  if (!body.release || body.release === "unknown") {
    throw new Error("health release fingerprint missing");
  }
  if (expected && body.release !== expected) {
    throw new Error("release mismatch: runtime=" + body.release + " expected=" + expected);
  }

  const checks = [
    ["GET developer", await fetch(base + "/api/v1/me/accounts/" + account + "/developer")],
    ["POST terminal/charge", await fetch(base + "/api/v1/me/accounts/" + account + "/terminal/charge", {
      method: "POST",
      headers: {"Content-Type":"application/json"},
      body: "{}"
    })],
  ];

  for (const [name, response] of checks) {
    if (response.status === 404) {
      throw new Error(name + " route is missing (404)");
    }
    if (response.status !== 401 && response.status !== 403) {
      throw new Error(name + " unexpected unauthenticated status " + response.status);
    }
  }

  console.log(JSON.stringify({
    ok: true,
    version: body.version,
    release: body.release,
    developerRoute: checks[0][1].status,
    terminalChargeRoute: checks[1][1].status
  }));
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
'

echo "==> Verifying public edge"
if command -v curl >/dev/null 2>&1; then
  public_health="$(curl -fsS --max-time 10 https://api.pixbrasil.org/api/health || true)"
  if [ -z "$public_health" ]; then
    echo "WARNING: public health could not be reached from this host; container route-map checks passed."
  else
    echo "$public_health"
  fi
fi

echo "==> Deployment complete"
echo "release=$TARGET_SHA"
