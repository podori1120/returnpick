import assert from "node:assert/strict";
import { getSourcingGateState } from "../lib/adminSourcingGate.ts";

const apiReady = { apiKeysReady: true, runtimeReady: true, items: [] };
const publicWebReady = {
  apiKeysReady: false,
  runtimeReady: true,
  items: [{ id: "public_web", state: "ready" }]
};
const apiMissing = { apiKeysReady: false, runtimeReady: true, items: [] };

const productionApi = getSourcingGateState(apiReady, { isProduction: true, loading: false, hasError: false });
assert.equal(productionApi.disabled, false);
assert.equal(productionApi.phase, "ready");

const productionPublicWeb = getSourcingGateState(publicWebReady, { isProduction: true, loading: false, hasError: false });
assert.equal(productionPublicWeb.publicWebOnly, true);
assert.equal(productionPublicWeb.disabled, false);
assert.equal(productionPublicWeb.phase, "public_web");

const productionBlocked = getSourcingGateState(apiMissing, { isProduction: true, loading: false, hasError: false });
assert.equal(productionBlocked.blockedInProduction, true);
assert.equal(productionBlocked.disabled, true);
assert.equal(productionBlocked.phase, "blocked");

const loading = getSourcingGateState(null, { isProduction: true, loading: true, hasError: false });
assert.equal(loading.disabled, true);
assert.equal(loading.phase, "loading");

const failed = getSourcingGateState(apiReady, { isProduction: true, loading: false, hasError: true });
assert.equal(failed.disabled, true);
assert.equal(failed.phase, "error");

const developmentMock = getSourcingGateState(apiMissing, { isProduction: false, loading: false, hasError: false });
assert.equal(developmentMock.disabled, false);
assert.equal(developmentMock.phase, "ready");

console.log("Admin sourcing gate checks passed: API-ready, public-web-only, blocked Production, loading, failed-readiness, and development mock states.");
