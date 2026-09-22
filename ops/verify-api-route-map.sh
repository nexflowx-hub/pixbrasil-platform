#!/usr/bin/env bash
set -euo pipefail

CONTAINER="${1:-pixbrasil-api}"
ACCOUNT_ID="${2:-00000000-0000-0000-0000-000000000000}"

docker exec "$CONTAINER" node -e '
const base = "http://127.0.0.1:8080";
const account = process.argv[1];
(async () => {
  const cases = [
    ["health", "GET", "/api/health", 200],
    ["client session", "GET", "/api/v1/me/session", 401],
    ["developer", "GET", "/api/v1/me/accounts/" + account + "/developer", 401],
    ["terminal charge", "POST", "/api/v1/me/accounts/" + account + "/terminal/charge", 401],
  ];

  for (const [name, method, path, expected] of cases) {
    const response = await fetch(base + path, {
      method,
      headers: method === "POST" ? {"Content-Type":"application/json"} : undefined,
      body: method === "POST" ? "{}" : undefined
    });
    console.log(name + ": " + response.status + " " + path);
    if (response.status !== expected) process.exitCode = 1;
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
' "$ACCOUNT_ID"
