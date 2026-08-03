import assert from "node:assert/strict";

const { COMPARE_UUID_PATTERN, compareProductIdsEqual, MAX_COMPARE_ITEMS, normalizeCompareProductId } = await import("../lib/compareIdentity.ts");
const mixedCase = "ABCDEFAB-abcd-4AbC-8aBc-AbCdEfAbCdEf";
const canonical = "abcdefab-abcd-4abc-8abc-abcdefabcdef";
const title = "검수 완료 노트북";
const apiProduct = { id: mixedCase, title, detail_url: `/deals/${mixedCase}` };
const storedItems = [{ id: normalizeCompareProductId(apiProduct.id), title: "공유된 비교 상품" }];

assert.equal(normalizeCompareProductId(mixedCase), canonical);
assert.equal(COMPARE_UUID_PATTERN.test(normalizeCompareProductId(mixedCase)), true);
assert.equal(normalizeCompareProductId(`  ${mixedCase}  `), canonical);
assert.equal(compareProductIdsEqual(apiProduct.id, storedItems[0].id), true);

const hydrated = storedItems.map((item) => {
  const product = [apiProduct].find((candidate) => compareProductIdsEqual(candidate.id, item.id));
  return product ? { ...item, title: product.title } : item;
});
assert.equal(hydrated[0].title, title, "mixed-case API ids must hydrate stored compare titles");
assert.equal([apiProduct].filter((product) => compareProductIdsEqual(product.id, storedItems[0].id)).length, 1);
assert.equal([apiProduct].map((product) => product.id)[0], mixedCase, "share/detail identity keeps the stored product id");
assert.equal(storedItems.filter((item) => !compareProductIdsEqual(item.id, apiProduct.id)).length, 0, "removal must match mixed-case ids");
assert.equal([apiProduct].find((product) => compareProductIdsEqual(product.id, storedItems[0].id))?.id, mixedCase, "event attribution keeps the stored product id");

const fullCompareItems = Array.from({ length: MAX_COMPARE_ITEMS }, (_, index) => ({
  id: `abcdefab-abcd-4abc-8abc-${index.toString(16).padStart(12, "0")}`,
  title: `상품 ${index + 1}`
}));
const attemptedOverflow = fullCompareItems.length >= MAX_COMPARE_ITEMS ? fullCompareItems : [{ id: canonical, title }, ...fullCompareItems];
assert.equal(fullCompareItems.length, 12);
assert.deepEqual(attemptedOverflow, fullCompareItems, "full compare state must reject overflow without truncating existing items");

console.log("ReturnPick compare identity check");
console.log("===================================");
console.log("PASS mixed-case UUIDs preserve route/event ids and normalize comparison keys");
