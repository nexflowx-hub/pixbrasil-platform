import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  decodeValidatedJwtClaims,
  extractBearerToken,
} from "./admin-auth.utils";

function token(payload: Record<string, unknown>): string {
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `header.${encoded}.signature`;
}

test("extracts a bearer token", () => {
  assert.equal(extractBearerToken("Bearer abc.def.ghi"), "abc.def.ghi");
});

test("decodes subject and aal2 only after upstream validation", () => {
  assert.deepEqual(
    decodeValidatedJwtClaims(token({ sub: "user-1", aal: "aal2" })),
    { sub: "user-1", aal: "aal2" },
  );
});

test("defaults missing aal to aal1", () => {
  assert.deepEqual(
    decodeValidatedJwtClaims(token({ sub: "user-1" })),
    { sub: "user-1", aal: "aal1" },
  );
});
