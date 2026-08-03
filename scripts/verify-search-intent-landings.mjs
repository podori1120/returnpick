import assert from "node:assert/strict";
import { matchesSearchIntent } from "../lib/searchIntentMatcher.ts";

function product(title, category = "laptop", keyword = "") {
  return { title, category, keyword, brand: null, model_name: null, spec_json: {} };
}

const studentRule = {
  category: "laptop",
  searchQueries: ["노트북", "그램", "갤럭시북", "아이디어패드", "맥북"],
  excludeQueries: ["게이밍", "리전", "TUF", "빅터스", "RTX", "GTX", "MSI"]
};
const qhdRule = { category: "monitor", searchQueries: ["QHD", "2560 1440"] };

assert.equal(matchesSearchIntent(product("LG 그램 16 16GB 512GB"), studentRule), true);
assert.equal(matchesSearchIntent(product("MSI 사이보그 RTX 4050 게이밍 노트북", "laptop", "MSI 노트북"), studentRule), false);
assert.equal(matchesSearchIntent(product("32인치 QHD 모니터 165Hz", "monitor"), qhdRule), true);
assert.equal(matchesSearchIntent(product("32인치 FHD 모니터", "monitor"), qhdRule), false);
assert.equal(matchesSearchIntent(product("27인치 QHD 모니터", "laptop"), qhdRule), false);

console.log("Search intent matcher checks passed: category, positive terms, and negative terms stay aligned.");
