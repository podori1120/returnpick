import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const files = [
  "lib/productDistributionKit.ts",
  "app/api/admin/content-kit/route.ts",
  "components/AdminProductDistributionKit.tsx"
];

for (const file of files) {
  if (!existsSync(resolve(root, file))) throw new Error(`missing product distribution kit file: ${file}`);
}

const kit = readFileSync(resolve(root, "lib/productDistributionKit.ts"), "utf8");
const route = readFileSync(resolve(root, "app/api/admin/content-kit/route.ts"), "utf8");
const component = readFileSync(resolve(root, "components/AdminProductDistributionKit.tsx"), "utf8");

const requiredKitSignals = [
  "isPublicDealReady(product)",
  "AFFILIATE_DISCLOSURE",
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "buildTelegramMessage(product, { detailUrl: telegramUrl })",
  "approvalSampleProduct.registeredNaverBlogUrl",
  "getReturnEvidenceLabel(product)",
  "getPurchaseDecision(product)"
];
for (const signal of requiredKitSignals) {
  if (!kit.includes(signal)) throw new Error(`missing product distribution kit contract: ${signal}`);
}

for (const signal of ["requireAdmin(request)", "product_id", "getProductById", "PRODUCT_NOT_PUBLIC_READY", "buildProductDistributionKit"]) {
  if (!route.includes(signal)) throw new Error(`missing content kit route guard: ${signal}`);
}

for (const signal of ["/api/admin/content-kit?product_id=", "navigator.clipboard.writeText", "/api/admin/telegram", "productId: kit.productId", "제휴 안내"]) {
  if (!component.includes(signal)) throw new Error(`missing content kit UI flow: ${signal}`);
}

console.log("Product distribution kit checks passed: customer-ready gate, disclosure, attribution, channel copy, and explicit Telegram send.");
