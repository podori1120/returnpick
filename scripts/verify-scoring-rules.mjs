#!/usr/bin/env node

import { readFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const results = [];

function readText(file) {
  return readFileSync(path.join(root, file), "utf8");
}

function check(name, ok, detail) {
  results.push({ name, ok: Boolean(ok), detail });
}

function includesAll(text, fragments) {
  return fragments.every((fragment) => text.includes(fragment));
}

const scoring = readText("lib/scoring.ts");
const sourcing = readText("lib/sourcing.ts");
const types = readText("lib/types.ts");

check(
  "condition grade scoring",
  includesAll(scoring, ["미개봉: 20", "최상: 17", "상: 10", "중: 3", "알수없음: 2", "확인필요: 5"]),
  "condition_grade keeps the conservative return-condition score table"
);

check(
  "price score bands",
  includesAll(scoring, [
    "if (!hasEnoughPrice) return 5",
    "discountRate == null || discountRate <= 0) return 0",
    "discountRate < 0.05) return 3",
    "discountRate < 0.1) return 8",
    "discountRate < 0.15) return 13",
    "discountRate < 0.2) return 18",
    "discountRate < 0.3) return 24",
    "return 30"
  ]),
  "price attractiveness follows the requested discount bands and keeps missing prices conservative"
);

check(
  "reference and deal price order",
  includesAll(scoring, [
    "product.naver_lowest_price ?? product.new_price ?? product.source_price",
    "product.return_price ?? product.source_price",
    "calculateDiscountRate(referencePrice, dealPrice)"
  ]),
  "reference_price and deal_price use the approved fallback order"
);

check(
  "verdict thresholds",
  includesAll(scoring, [
    "if (score >= 85) return \"강력추천\"",
    "if (score >= 75) return \"추천\"",
    "if (score >= 65) return \"조건부 추천\"",
    "if (score >= 50) return \"보류\"",
    "return \"비추\""
  ]),
  "total score maps to the public verdict ladder"
);

check(
  "forced verdict caps",
  includesAll(scoring, [
    "product.condition_grade === \"확인필요\"",
    "riskFlags.push(\"RISK_CONDITION_UNKNOWN\")",
    "verdict = capVerdict(verdict, \"조건부 추천\")",
    "product.return_price == null) verdict = capVerdict(verdict, \"보류\")",
    "riskFlags.includes(\"RISK_BAD_PRICE_VS_NAVER\")",
    "riskFlags.includes(\"RISK_HIGH_PRICE_RETURN\")",
    "riskFlags.includes(\"RISK_FREEDOS\")",
    "discountRate < 0.1"
  ]),
  "unknown condition, missing return price, bad Naver price, high-risk used deals, FreeDOS, and hidden-cost risks cap verdicts"
);

check(
  "risk flags",
  includesAll(scoring, [
    "RISK_PRICE_UNKNOWN",
    "RISK_BAD_PRICE_VS_NAVER",
    "RISK_LOW_RAM",
    "RISK_GAMING_USED",
    "RISK_PANEL_DEFECT",
    "RISK_DOCK_STATION_UNKNOWN",
    "RISK_USED_BATTERY",
    "RISK_CONSUMABLES_UNKNOWN",
    "RISK_FILTER_COST",
    "RISK_STOCK_ONE"
  ]),
  "scoring still emits the risk flags used by public detail and admin review"
);

check(
  "score detail payload",
  includesAll(scoring, ["reference_price", "deal_price", "discount_rate", "applied_caps", "condition_unknown", "return_price_missing", "bad_price_vs_naver"]),
  "deal_scores keep explainable score_detail for admin and detail pages"
);

check(
  "sourcing score integration",
  includesAll(sourcing, [
    "import { calculateDealScore }",
    "const score = calculateDealScore(product)",
    "score.total_score >= 65",
    "meaningfulDiscount",
    "const score = calculateDealScore(updated)",
    "await createDealScore(score)",
    "product_score_error"
  ]),
  "automatic sourcing classifies and persists scores without losing saved products when score save fails"
);

check(
  "public type contract",
  includesAll(types, [
    "export type ConditionGrade = \"미개봉\" | \"최상\" | \"상\" | \"중\" | \"알수없음\" | \"확인필요\"",
    "export type Verdict = \"강력추천\" | \"추천\" | \"조건부 추천\" | \"보류\" | \"비추\"",
    "\"RISK_CONDITION_UNKNOWN\"",
    "\"RISK_BAD_PRICE_VS_NAVER\""
  ]),
  "public TypeScript types keep the Korean condition and verdict contract"
);

console.log("ReturnPick scoring contract check");
console.log("=".repeat(40));
for (const result of results) {
  console.log(`${result.ok ? "PASS" : "FAIL"} ${result.name} - ${result.detail}`);
}
console.log("=".repeat(40));
const failures = results.filter((result) => !result.ok);
console.log(`summary: ${results.length - failures.length} pass, ${failures.length} fail`);
if (failures.length) process.exitCode = 1;
