import { readFileSync, readdirSync, statSync } from "node:fs";
import { extname, join, relative } from "node:path";

const roots = ["src", "public/openapi.json"];
const extensions = new Set([".ts", ".tsx", ".js", ".mjs", ".json", ".md"]);
const forbidden = [
  /MISTICPAY/i,
  /PIXGO/i,
  /provider_code/,
  /providerCode/,
  /provider_payment_id/,
  /providerPaymentId/,
  /gateway_alias/,
  /gatewayAlias/,
  /providerRouteCostBrl/,
  /lastVerifiedProvider/,
];

function filesAt(path) {
  const stat = statSync(path);
  if (stat.isFile()) return [path];
  return readdirSync(path).flatMap((entry) => filesAt(join(path, entry)));
}

const violations = [];
for (const root of roots) {
  for (const file of filesAt(root)) {
    if (!extensions.has(extname(file))) continue;
    const content = readFileSync(file, "utf8");
    for (const pattern of forbidden) {
      if (pattern.test(content)) {
        violations.push(`${relative(process.cwd(), file)}: ${pattern}`);
      }
    }
  }
}

if (violations.length) {
  console.error("Client/provider boundary violation:\n" + violations.join("\n"));
  process.exit(1);
}

console.log("Client/provider boundary: OK");
