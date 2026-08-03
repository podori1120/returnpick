import assert from "node:assert/strict";

const { getCompareProductsErrorPayload } = await import("../lib/compareApiError.ts");
const canary = "CANARY_COMPARE_BACKEND_SECRET_7f9d";
const payload = getCompareProductsErrorPayload(new Error(canary));
const serialized = JSON.stringify(payload);

assert.deepEqual(payload, {
  ok: false,
  products: [],
  error: "COMPARE_PRODUCTS_FAILED",
  message: "비교 상품 정보를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요."
});
assert.equal(serialized.includes(canary), false, "backend diagnostics must not appear in the public error payload");

console.log("Compare API error safety check");
console.log("===============================");
console.log("PASS fixed public payload excludes backend diagnostics");
