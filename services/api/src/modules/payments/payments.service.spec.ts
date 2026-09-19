import { strict as assert } from "node:assert";
import { test } from "node:test";
import { calculateFeeBrl } from "./payments.service";

test("calculateFeeBrl applies basis points and fixed fee", () => {
  assert.equal(calculateFeeBrl(100, 600, 0), 6);
  assert.equal(calculateFeeBrl(49, 600, 2), 4.94);
  assert.equal(calculateFeeBrl(100, 750, 0), 7.5);
  assert.equal(calculateFeeBrl(100, 650, 0), 6.5);
});

test("calculateFeeBrl rounds to cents", () => {
  assert.equal(calculateFeeBrl(12.34, 600, 0), 0.74);
});
