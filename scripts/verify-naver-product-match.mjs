import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const ts = require("typescript");

function loadTsModule(relativePath, aliases = {}) {
  const source = fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  }).outputText;
  const loadedModule = { exports: {} };
  const localRequire = (specifier) => aliases[specifier] ?? require(specifier);
  new Function("exports", "module", "require", output)(loadedModule.exports, loadedModule, localRequire);
  return loadedModule.exports;
}

const matcherModule = loadTsModule("lib/naverProductMatch.ts");
const { matchNaverProductSku, shouldPreferNaverSkuCandidate } = matcherModule;

function candidate(title, category2, overrides = {}) {
  return {
    title,
    brand: null,
    maker: null,
    category1: "디지털/가전",
    category2,
    category3: null,
    category4: null,
    ...overrides
  };
}

const gram = {
  category: "laptop",
  title: "LG 그램 16Z90S-GA56K i7-1360P 16GB 512GB 노트북",
  brand: "LG",
  model_name: "16Z90S-GA56K",
  spec_json: { ram: "16GB", ssd: "512GB", cpu: "i7-1360P" }
};

const exactGram = matchNaverProductSku(
  gram,
  candidate("LG전자 그램 16Z90S-GA56K i7-1360P 16GB 512GB 노트북", "노트북", { brand: "LG전자" })
);
assert.equal(exactGram.accepted, true);
assert.equal(exactGram.confidence, "strong");
assert.equal(exactGram.reason_code, "EXACT_MODEL_CODE");

assert.equal(
  matchNaverProductSku(gram, candidate("LG전자 그램 16Z90R-GA56K i7-1360P 16GB 512GB 노트북", "노트북")).reason_code,
  "MODEL_MISMATCH"
);
assert.equal(
  matchNaverProductSku(gram, candidate("LG전자 그램 16Z90S-GA56K i7-1360P 8GB 512GB 노트북", "노트북")).reason_code,
  "SPEC_CONFLICT"
);

const ultraLaptop = {
  category: "laptop",
  title: "삼성 갤럭시북 NT960XGQ-A51A Ultra 5 125H 16GB 512GB 노트북",
  brand: "Samsung",
  model_name: "NT960XGQ-A51A",
  spec_json: { ram: "16GB", ssd: "512GB", cpu: "Ultra 5" }
};
assert.equal(
  matchNaverProductSku(
    ultraLaptop,
    candidate("삼성전자 갤럭시북 NT960XGQ-A51A Ultra 5 225H 16GB 512GB 노트북", "노트북", { brand: "삼성전자" })
  ).reason_code,
  "SPEC_CONFLICT"
);

const macbook = {
  category: "laptop",
  title: "애플 맥북에어 M3 16GB 512GB 노트북",
  brand: "Apple",
  model_name: "MacBook Air",
  spec_json: { ram: "16GB", ssd: "512GB" }
};
assert.equal(
  matchNaverProductSku(macbook, candidate("Apple MacBook Air M2 16GB 512GB 노트북", "노트북", { brand: "Apple" })).reason_code,
  "SPEC_CONFLICT"
);

const ideaPad = {
  category: "laptop",
  title: "레노버 아이디어패드 5 Ryzen 7 16GB 512GB 노트북",
  brand: "Lenovo",
  model_name: "IdeaPad 5",
  spec_json: { ram: "16GB", ssd: "512GB" }
};
assert.equal(
  matchNaverProductSku(
    ideaPad,
    candidate("레노버 아이디어패드5 Ryzen 7 16GB 512GB 노트북", "노트북", { brand: "Lenovo" })
  ).accepted,
  true
);
assert.equal(
  matchNaverProductSku(ideaPad, candidate("레노버 아이디어패드5 노트북 전용 케이스", "노트북액세서리", { brand: "Lenovo" })).reason_code,
  "ACCESSORY_ONLY"
);
assert.equal(
  matchNaverProductSku(
    ideaPad,
    candidate("레노버 아이디어패드5 16GB 32GB 512GB 옵션형 노트북", "노트북", { brand: "Lenovo" })
  ).reason_code,
  "CANDIDATE_VARIANT_AMBIGUOUS"
);

const monitor = {
  category: "monitor",
  title: "LG 27GP850 27인치 UHD 165Hz 모니터",
  brand: "LG",
  model_name: "27GP850",
  spec_json: { size: "27인치", resolution: "UHD", refresh_rate: "165Hz" }
};
assert.equal(
  matchNaverProductSku(monitor, candidate("LG전자 27GP850 27인치 4K 165Hz 모니터", "모니터", { brand: "LG전자" })).accepted,
  true
);
assert.equal(
  matchNaverProductSku(monitor, candidate("LG전자 27GP850 32인치 4K 165Hz 모니터", "모니터", { brand: "LG전자" })).reason_code,
  "SPEC_CONFLICT"
);
assert.equal(
  matchNaverProductSku(monitor, candidate("LG전자 27GP850 27인치 4K 144Hz 모니터", "모니터", { brand: "LG전자" })).reason_code,
  "SPEC_CONFLICT"
);
assert.equal(
  matchNaverProductSku(monitor, candidate("LG 27GP850 전용 모니터암", "모니터주변기기", { brand: "LG전자" })).reason_code,
  "ACCESSORY_ONLY"
);

const dehumidifier = {
  category: "dehumidifier",
  title: "LG D20 제습기 20L",
  brand: "LG",
  model_name: "D20",
  spec_json: { capacity: "20L" }
};
assert.equal(
  matchNaverProductSku(dehumidifier, candidate("LG전자 D20 제습기 12L", "제습기", { brand: "LG전자" })).reason_code,
  "SPEC_CONFLICT"
);

const airPurifier = {
  category: "air_purifier",
  title: "위닉스 타워프라임 공기청정기 20평형",
  brand: "Winix",
  model_name: "Tower Prime",
  spec_json: { coverage: "20" }
};
assert.equal(
  matchNaverProductSku(airPurifier, candidate("위닉스 타워프라임 공기청정기 10평형", "공기청정기", { brand: "위닉스" })).reason_code,
  "SPEC_CONFLICT"
);
assert.equal(
  matchNaverProductSku(airPurifier, candidate("위닉스 타워프라임 공기청정기 66㎡", "공기청정기", { brand: "위닉스" })).accepted,
  true
);

const robotVacuum = {
  category: "robot_vacuum",
  title: "로보락 Q Revo 로봇청소기",
  brand: "Roborock",
  model_name: "Q Revo",
  spec_json: {}
};
assert.equal(
  matchNaverProductSku(robotVacuum, candidate("로보락 Q Revo 전용 교체용 필터", "청소기부품", { brand: "로보락" })).reason_code,
  "ACCESSORY_ONLY"
);

const specOnlyMonitor = {
  category: "monitor",
  title: "삼성 27인치 QHD 165Hz 게이밍 모니터",
  brand: "Samsung",
  model_name: null,
  spec_json: { size: "27인치", resolution: "QHD", refresh_rate: "165Hz" }
};
assert.equal(
  matchNaverProductSku(
    specOnlyMonitor,
    candidate("삼성전자 27인치 QHD 165Hz 게이밍 모니터", "모니터", { brand: "삼성전자" })
  ).reason_code,
  "SPEC_IDENTITY"
);

assert.equal(
  matchNaverProductSku(
    { ...specOnlyMonitor, model_name: "27QHD165" },
    candidate("삼성전자 27인치 QHD 165Hz 게이밍 모니터", "모니터", { brand: "삼성전자" })
  ).reason_code,
  "SPEC_IDENTITY"
);

assert.equal(
  matchNaverProductSku(
    { category: "air_purifier", title: "삼성 공기청정기", brand: "Samsung", model_name: null, spec_json: {} },
    candidate("삼성전자 공기청정기", "공기청정기", { brand: "삼성전자" })
  ).reason_code,
  "INSUFFICIENT_IDENTITY"
);

assert.equal(
  shouldPreferNaverSkuCandidate(
    { price: 900000, relevanceScore: 4, sku: { ...exactGram, confidence: "strong", score: 95 } },
    { price: 500000, relevanceScore: 5, sku: { ...exactGram, confidence: "moderate", score: 100 } }
  ),
  true
);
assert.equal(
  shouldPreferNaverSkuCandidate(
    { price: 850000, relevanceScore: 4, sku: { ...exactGram, confidence: "strong", score: 95 } },
    { price: 900000, relevanceScore: 4, sku: { ...exactGram, confidence: "strong", score: 95 } }
  ),
  true
);

const originalFetch = globalThis.fetch;
const originalClientId = process.env.NAVER_CLIENT_ID;
const originalClientSecret = process.env.NAVER_CLIENT_SECRET;
process.env.NAVER_CLIENT_ID = "test-client";
process.env.NAVER_CLIENT_SECRET = "test-secret";
globalThis.fetch = async () =>
  new Response(
    JSON.stringify({
      total: 4,
      start: 1,
      display: 4,
      items: [
        { title: "LG 16Z90S-GA56K 전용 노트북 케이스", lprice: "25000", brand: "LG전자", category1: "디지털/가전", category2: "노트북액세서리" },
        { title: "LG전자 그램 16Z90R-GA56K i7-1360P 16GB 512GB 노트북", lprice: "500000", brand: "LG전자", category1: "디지털/가전", category2: "노트북" },
        { title: "LG전자 그램 16Z90S-GA56K i7-1360P 16GB 512GB 노트북", lprice: "900000", brand: "LG전자", category1: "디지털/가전", category2: "노트북" },
        { title: "LG전자 그램 16Z90S-GA56K i7-1360P 16GB 512GB 노트북", lprice: "850000", brand: "LG전자", category1: "디지털/가전", category2: "노트북" }
      ]
    }),
    { status: 200, headers: { "content-type": "application/json" } }
  );

try {
  const formatModule = loadTsModule("lib/format.ts");
  const providerModule = loadTsModule("lib/providers/naverShoppingProvider.ts", {
    "@/lib/format": formatModule,
    "@/lib/naverProductMatch": matcherModule
  });
  const lookup = await providerModule.getLowestPriceFromQueries(["LG 그램 16Z90S-GA56K"], {
    relevanceTokens: ["LG", "16Z90S-GA56K", "16GB", "512GB"],
    product: gram
  });
  assert.equal(lookup.status, "ok");
  assert.equal(lookup.price, 850000);
  assert.equal(lookup.match?.sku_confidence, "strong");
  assert.equal(lookup.match?.sku_rejected_count, 2);
  assert.equal(lookup.match?.sku_rejection_reasons.ACCESSORY_ONLY, 1);
  assert.equal(lookup.match?.sku_rejection_reasons.MODEL_MISMATCH, 1);
} finally {
  globalThis.fetch = originalFetch;
  if (originalClientId === undefined) delete process.env.NAVER_CLIENT_ID;
  else process.env.NAVER_CLIENT_ID = originalClientId;
  if (originalClientSecret === undefined) delete process.env.NAVER_CLIENT_SECRET;
  else process.env.NAVER_CLIENT_SECRET = originalClientSecret;
}

console.log("Naver SKU checks passed: exact model, localized model, spec conflicts, option ambiguity, accessory rejection, capacity, spec-only identity, and confidence-first price ranking.");
