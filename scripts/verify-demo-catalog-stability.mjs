import assert from "node:assert/strict";
import { stableDemoProductId } from "../lib/demoIdentity.ts";

const first = stableDemoProductId("seed-lg-qhd-27-144");
const repeat = stableDemoProductId("seed-lg-qhd-27-144");
const second = stableDemoProductId("seed-lg-qhd-27-165");

assert.equal(first, repeat);
assert.notEqual(first, second);
assert.match(first, /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);

console.log("Demo catalog stability checks passed: identical source IDs keep identical UUID links across route workers.");
