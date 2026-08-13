import assert from "node:assert/strict";
import { matchesSearchIntent } from "../lib/searchIntentMatcher.ts";
import { getSearchIntentLanding } from "../lib/searchLandings.ts";

function product(title, category = "laptop", keyword = "", details = {}) {
  return { title, category, keyword, brand: null, model_name: null, spec_json: {}, ...details };
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

const vivobookRule = getSearchIntentLanding("vivobook-laptop");
assert.ok(vivobookRule);
assert.equal(
  matchesSearchIntent(
    product("ASUS Vivobook 15 Ryzen 5 16GB 512GB", "laptop", "", { brand: "ASUS", model_name: "Vivobook 15" }),
    vivobookRule
  ),
  true
);
assert.equal(
  matchesSearchIntent(
    product("ASUS Zenbook 14 Ryzen 5 16GB 512GB", "laptop", "", { brand: "ASUS", model_name: "Zenbook 14" }),
    vivobookRule
  ),
  false
);

const lgGramProRule = getSearchIntentLanding("lg-gram-pro");
assert.ok(lgGramProRule);
assert.equal(
  matchesSearchIntent(
    product("LG 그램 프로 16 Ultra 7 32GB", "laptop", "LG 그램 프로", { brand: "LG", model_name: "Gram Pro 16" }),
    lgGramProRule
  ),
  true
);
assert.equal(
  matchesSearchIntent(
    product("LG Gram16 Pro Ultra 7 32GB", "laptop", "", { brand: "LG", model_name: "Gram16 Pro" }),
    lgGramProRule
  ),
  true
);
assert.equal(
  matchesSearchIntent(
    product("LG 그램 16 Ultra 7 32GB", "laptop", "LG 그램", { brand: "LG", model_name: "Gram 16" }),
    lgGramProRule
  ),
  false
);
assert.equal(
  matchesSearchIntent(
    product("LG 그램 16 인텔 프로세서", "laptop", "", { brand: "LG", model_name: "Gram 16" }),
    lgGramProRule
  ),
  false
);

const galaxyBookProRule = getSearchIntentLanding("galaxy-book-pro");
assert.ok(galaxyBookProRule);
assert.equal(
  matchesSearchIntent(
    product("삼성 갤럭시북4 프로 16GB 1TB", "laptop", "갤럭시북", {
      brand: "Samsung",
      model_name: "Galaxy Book4 Pro"
    }),
    galaxyBookProRule
  ),
  true
);
assert.equal(
  matchesSearchIntent(
    product("삼성 갤럭시북4 16GB 512GB", "laptop", "갤럭시북 프로", {
      brand: "Samsung",
      model_name: "Galaxy Book4",
      spec_json: { operating_system: "Windows Pro" }
    }),
    galaxyBookProRule
  ),
  false
);
assert.equal(
  matchesSearchIntent(
    product("Samsung Galaxy Book4 processor", "laptop", "", {
      brand: "Samsung",
      model_name: "Galaxy Book4"
    }),
    galaxyBookProRule
  ),
  false
);

const odysseyRule = getSearchIntentLanding("odyssey-monitor");
assert.ok(odysseyRule);
assert.equal(
  matchesSearchIntent(
    product("삼성 오디세이 G5 32인치 QHD 모니터", "monitor", "", { brand: "Samsung", model_name: "Odyssey G5" }),
    odysseyRule
  ),
  true
);
assert.equal(
  matchesSearchIntent(
    product("LG 오디세이 G5 32인치 QHD 모니터", "monitor", "", { brand: "LG", model_name: "Odyssey G5" }),
    odysseyRule
  ),
  false
);

const premiumRobotVacuumRule = getSearchIntentLanding("premium-robot-vacuum");
assert.ok(premiumRobotVacuumRule);
assert.equal(
  matchesSearchIntent(
    product("로보락 S8 MaxV Ultra 로봇청소기 자동먼지비움", "robot_vacuum", "로보락", {
      brand: "Roborock",
      model_name: "S8 MaxV Ultra"
    }),
    premiumRobotVacuumRule
  ),
  true
);
assert.equal(
  matchesSearchIntent(
    product("Roborock S8 MaxV Ultra Robot Vacuum", "robot_vacuum", "", {
      brand: "Roborock",
      model_name: "S8 MaxV Ultra"
    }),
    premiumRobotVacuumRule
  ),
  true
);
assert.equal(
  matchesSearchIntent(
    product("저가형 로봇청소기 물걸레 자동충전", "robot_vacuum", "로봇청소기", {
      brand: "Generic",
      model_name: "Basic Robot Vacuum"
    }),
    premiumRobotVacuumRule
  ),
  false
);
assert.equal(
  matchesSearchIntent(
    product("로보락 Roborock S80 로봇청소기", "robot_vacuum", "로보락", {
      brand: "Roborock",
      model_name: "S80"
    }),
    premiumRobotVacuumRule
  ),
  false
);
assert.equal(
  matchesSearchIntent(
    product("드리미 Dreame L200 로봇청소기", "robot_vacuum", "드리미", {
      brand: "Dreame",
      model_name: "L200"
    }),
    premiumRobotVacuumRule
  ),
  false
);

console.log("Search intent matcher checks passed: broad rules and five strict landing gates stay aligned.");
