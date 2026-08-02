import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const mode = process.argv.includes("--launch") ? "launch" : "preapproval";
const MAX_PUBLIC_WEB_ALLOWED_HOSTS = 5;
const MAX_PUBLIC_WEB_SEARCH_TEMPLATES = 5;

function readText(file) {
  return readFileSync(path.join(root, file), "utf8");
}

function parseEnvFile(file) {
  const fullPath = path.join(root, file);
  if (!existsSync(fullPath)) return {};
  const env = {};
  for (const rawLine of readFileSync(fullPath, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const index = line.indexOf("=");
    if (index < 0) continue;
    const key = line.slice(0, index).trim();
    const value = line.slice(index + 1).trim().replace(/^["']|["']$/g, "");
    env[key] = value;
  }
  return env;
}

const localEnv = {
  ...parseEnvFile(".env"),
  ...parseEnvFile(".env.production"),
  ...parseEnvFile(".env.local"),
  ...process.env
};

function hasEnv(name) {
  return Boolean(String(localEnv[name] ?? "").trim());
}

function envValue(name) {
  return String(localEnv[name] ?? "").trim();
}

function isPublicHttpsSiteUrl(value) {
  try {
    const url = new URL(value);
    const hostname = url.hostname.toLowerCase();
    const localHosts = new Set(["localhost", "127.0.0.1", "0.0.0.0", "::1"]);
    return url.protocol === "https:" && !url.username && !url.password && !localHosts.has(hostname) && !hostname.endsWith(".local");
  } catch {
    return false;
  }
}

function isCoupangPartnersUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname === "link.coupang.com" && /^\/a\/[A-Za-z0-9]{6,16}$/.test(url.pathname);
  } catch {
    return false;
  }
}

function isSupabaseProjectUrl(value) {
  try {
    const url = new URL(value);
    const hostname = url.hostname.toLowerCase();
    const localHosts = new Set(["localhost", "127.0.0.1", "0.0.0.0", "::1"]);
    return url.protocol === "https:" && !url.username && !url.password && !localHosts.has(hostname) && !hostname.endsWith(".local");
  } catch {
    return false;
  }
}

function isLikelySupabaseKeyValue(value) {
  return value.length >= 40 && !/\s/.test(value);
}

function looksLikePlaceholderValue(value) {
  const raw = String(value ?? "").trim().toLowerCase();
  return (
    raw.includes("your_") ||
    raw.includes("your-") ||
    raw.includes("change_me") ||
    raw.includes("changeme") ||
    raw.includes("placeholder") ||
    raw.includes("todo") ||
    raw.includes("諛쒓툒") ||
    raw.includes("?낅젰") ||
    raw === "test" ||
    raw === "secret" ||
    raw === "password" ||
    raw.startsWith("<") ||
    raw.endsWith(">")
  );
}

function containsLikelyMojibake(value) {
  const raw = String(value ?? "");
  return /�|諛|荑|鍮|媛|援|留|湲|由|異|寃|쨌|\?뺤|\?좎|\?곹/.test(raw);
}

function isLikelyProviderSecretValue(value, minLength = 8) {
  return value.length >= minLength && !/\s/.test(value) && !looksLikePlaceholderValue(value);
}

function isLikelyAdminPasswordValue(value) {
  return value.length >= 12 && !/\s/.test(value) && !looksLikePlaceholderValue(value) && !["admin", "password", "test"].includes(value.toLowerCase());
}

function isLikelyTelegramBotTokenValue(value) {
  return !looksLikePlaceholderValue(value) && /^\d{6,}:[A-Za-z0-9_-]{20,}$/.test(value);
}

function isLikelyTelegramChatIdValue(value) {
  return !looksLikePlaceholderValue(value) && (/^-?\d{5,}$/.test(value) || /^@[A-Za-z0-9_]{5,}$/.test(value));
}

function splitEnvListValue(value) {
  return String(value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function isPublicWebHostValue(host) {
  const raw = host.trim().toLowerCase();
  if (!raw) return false;
  if (raw.includes("://") || raw.includes("/") || raw.includes("?") || raw.includes("#")) return false;
  if (raw === "*" || raw.includes("*")) return false;
  if (raw === "localhost" || raw === "127.0.0.1" || raw === "0.0.0.0" || raw === "::1" || raw.endsWith(".local")) return false;
  return /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9-]{2,63}$/.test(raw);
}

function isPublicWebTemplateValue(template, allowedHosts) {
  const raw = template.trim();
  if (!raw.includes("{keyword}")) return false;
  try {
    const url = new URL(raw.replace("{keyword}", "returnpick-test"));
    const hostname = url.hostname.toLowerCase();
    if (!["http:", "https:"].includes(url.protocol)) return false;
    if (url.username || url.password) return false;
    if (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "0.0.0.0" || hostname === "::1" || hostname.endsWith(".local")) return false;
    return allowedHosts.has(hostname);
  } catch {
    return false;
  }
}

function fileExists(file) {
  return existsSync(path.join(root, file));
}

const results = [];

function check(name, ok, detail, severity = "required") {
  results.push({ name, ok: Boolean(ok), detail, severity });
}

function checkEnvGroup(name, keys, severity = "required") {
  const missing = keys.filter((key) => !hasEnv(key));
  check(name, missing.length === 0, missing.length ? `missing: ${missing.join(", ")}` : `set: ${keys.join(", ")}`, severity);
}

const requiredFiles = [
  "app/api/admin/sourcing/run/route.ts",
  "app/api/admin/api-readiness/route.ts",
  "app/api/admin/editorial-campaign/route.ts",
  "app/api/admin/affiliate-links/backfill/route.ts",
  "app/api/admin/affiliate-links/import/route.ts",
  "app/api/admin/affiliate-links/verify/route.ts",
  "app/api/admin/bootstrap-catalog/route.ts",
  "app/api/admin/content-kit/route.ts",
  "app/api/admin/keywords/route.ts",
  "app/api/admin/launch/route.ts",
  "app/api/admin/prices/backfill/route.ts",
  "app/api/admin/prices/manual/route.ts",
  "app/api/admin/products/route.ts",
  "app/api/admin/products/import/route.ts",
  "app/api/admin/products/link-intake/route.ts",
  "app/api/admin/products/link-intake/bulk/route.ts",
  "app/api/admin/session/route.ts",
  "app/api/admin/telegram/route.ts",
  "app/api/cron/sourcing/route.ts",
  "app/api/cron/affiliate-backfill/route.ts",
  "app/api/cron/telegram-digest/route.ts",
  "app/api/events/route.ts",
  "app/deals/category/[category]/page.tsx",
  "app/picks/page.tsx",
  "app/picks/novatech-s1-window-cleaner/page.tsx",
  "app/picks/novatech-s1-window-cleaner/opengraph-image.tsx",
  "app/picks/novatech-s1-window-cleaner/twitter-image.tsx",
  "components/AdminLaunchStatusBar.tsx",
  "components/ApprovalSampleCard.tsx",
  "components/AdminApiReadinessPanel.tsx",
  "components/AdminAffiliateLinkQueue.tsx",
  "components/AdminAffiliateLinkIntake.tsx",
  "components/AdminBootstrapCatalogPanel.tsx",
  "components/AdminLaunchRunner.tsx",
  "components/AdminKeywordManager.tsx",
  "components/AdminCandidateTable.tsx",
  "components/AdminManualProductBulkForm.tsx",
  "components/AdminEditorialTelegramCampaign.tsx",
  "components/AdminProductDistributionKit.tsx",
  "components/AdminPriceBackfillPanel.tsx",
  "components/AdminProductEditor.tsx",
  "components/AffiliateEventTracker.tsx",
  "components/EditorialShareBar.tsx",
  "components/GuideEditorialLink.tsx",
  "components/TelegramPreview.tsx",
  "lib/affiliateLinkBackfill.ts",
  "lib/affiliateIdentity.ts",
  "lib/bootstrapCatalog.ts",
  "lib/demoIdentity.ts",
  "lib/coupangAffiliateLinkVerifier.ts",
  "lib/editorialCampaign.ts",
  "lib/productDistributionKit.ts",
  "lib/approvalSample.ts",
  "lib/adminNavigation.ts",
  "lib/apiReadiness.ts",
  "lib/categoryLanding.ts",
  "lib/clientTracking.ts",
  "lib/launchCapabilityPolicy.ts",
  "lib/launchState.ts",
  "lib/manualImportIdentity.ts",
  "lib/naverProductMatch.ts",
  "lib/naverPriceTrust.ts",
  "lib/naverPriceBackfill.ts",
  "lib/productImageUrl.ts",
  "lib/providerProductMerge.ts",
  "lib/publicWebUrlSafety.ts",
  "lib/webReturnInfo.ts",
  "lib/scoring.ts",
  "lib/sourcingRunKinds.ts",
  "lib/sourcing.ts",
  "lib/telegram.ts",
  "lib/providers/coupangPartnersProvider.ts",
  "lib/providers/naverShoppingProvider.ts",
  "lib/providers/mockProvider.ts",
  "lib/validators.ts",
  "types/sharp.d.ts",
  "scripts/print-production-env-template.mjs",
  "scripts/patch-brace-expansion-compat.mjs",
  "scripts/print-vercel-env-repair-plan.mjs",
  "scripts/load-env-files.mjs",
  "scripts/verify-production-env.mjs",
  "scripts/verify-vercel-env-names.mjs",
  "scripts/run-production-doctor.mjs",
  "scripts/run-production-deploy.mjs",
  "scripts/run-production-launch.mjs",
  "scripts/verify-git-deploy-readiness.mjs",
  "scripts/verify-github-hourly-scheduler.mjs",
  "scripts/verify-scheduled-affiliate-backfill.mjs",
  "scripts/verify-affiliate-identity.mjs",
  "scripts/verify-affiliate-link-intake.mjs",
  "scripts/verify-affiliate-link-intake-bulk.mjs",
  "scripts/verify-bootstrap-catalog-runtime.mjs",
  "scripts/verify-demo-catalog-stability.mjs",
  "scripts/verify-supabase-config-guard.mjs",
  "scripts/verify-product-distribution-kit.mjs",
  "scripts/verify-launch-capability-policy.mjs",
  "scripts/verify-manual-import-safety.mjs",
  "scripts/verify-naver-product-match.mjs",
  "scripts/verify-naver-price-trust.mjs",
  "scripts/verify-coupang-provider.mjs",
  "scripts/verify-provider-product-merge.mjs",
  "scripts/verify-scoring-rules.mjs",
  "scripts/verify-public-web-config.mjs",
  "scripts/verify-web-return-info.mjs",
  "scripts/verify-public-web-url-safety.mjs",
  "scripts/verify-public-web-detail-enrichment.mjs",
  "scripts/print-supabase-setup-runbook.mjs",
  "scripts/verify-production-readiness.mjs",
  "scripts/verify-supabase-schema.mjs",
  "scripts/diagnose-sourcing-recovery.mjs",
  "app/robots.ts",
  "app/sitemap.ts",
  "sql/schema.sql",
  "vercel.json",
  "next.config.mjs",
  "eslint.config.mjs",
  ".vercelignore"
];

for (const file of requiredFiles) {
  check(`file: ${file}`, fileExists(file), file, "required");
}

if (fileExists("package.json") && fileExists("eslint.config.mjs")) {
  const packageJson = readText("package.json");
  const eslintConfig = readText("eslint.config.mjs");
  check(
    "scripts: lint command",
    packageJson.includes('"lint": "eslint ."'),
    "package.json exposes a Next 16 compatible ESLint command",
    "required"
  );
  check(
    "lint: Next flat config",
    eslintConfig.includes('from "eslint-config-next/core-web-vitals"') &&
      eslintConfig.includes('from "eslint-config-next/typescript"') &&
      eslintConfig.includes("globalIgnores") &&
      eslintConfig.includes('".next/**"') &&
      eslintConfig.includes('".vercel/**"') &&
      eslintConfig.includes('".returnpick/**"') &&
      eslintConfig.includes('"react-hooks/set-state-in-effect": "warn"') &&
      eslintConfig.includes('"@typescript-eslint/no-explicit-any": "warn"'),
    "ESLint uses the Next flat config, ignores generated folders, and keeps current broad refactor rules as warnings",
    "required"
  );
  if (fileExists("scripts/patch-brace-expansion-compat.mjs")) {
    const compatibilityPatch = readText("scripts/patch-brace-expansion-compat.mjs");
    check(
      "dependencies: guarded secure brace compatibility",
      packageJson.includes('"postinstall": "node scripts/patch-brace-expansion-compat.mjs"') &&
        packageJson.includes('"brace-expansion": "5.0.9"') &&
        compatibilityPatch.includes('packageJson.version !== "3.1.5"') &&
        compatibilityPatch.includes("typeof braceExpansion === 'function'") &&
        compatibilityPatch.includes("source.split(original).length !== 2"),
      "secure brace-expansion remains compatible with legacy lint glob consumers and fails closed on dependency drift",
      "required"
    );
  }
}

if (fileExists("package.json") && fileExists("scripts/verify-scoring-rules.mjs")) {
  const packageJson = readText("package.json");
  const scoringCheck = readText("scripts/verify-scoring-rules.mjs");
  check(
    "scripts: scoring contract check command",
    packageJson.includes('"scoring:check": "node scripts/verify-scoring-rules.mjs"'),
    "package.json exposes a scoring contract check for post-approval sourcing quality",
    "required"
  );
  check(
    "scripts: scoring contract coverage",
    scoringCheck.includes("condition grade scoring") &&
      scoringCheck.includes("price score bands") &&
      scoringCheck.includes("reference and deal price order") &&
      scoringCheck.includes("forced verdict caps") &&
      scoringCheck.includes("sourcing score integration") &&
      scoringCheck.includes("public type contract") &&
      scoringCheck.includes("secret values") === false,
    "scoring check guards price bands, condition scores, verdict caps, risk flags, type strings, and sourcing score persistence without reading secrets",
    "required"
  );
}

if (fileExists("package.json") && fileExists("lib/providerProductMerge.ts") && fileExists("scripts/verify-provider-product-merge.mjs")) {
  const packageJson = readText("package.json");
  const providerMerge = readText("lib/providerProductMerge.ts");
  const providerMergeCheck = readText("scripts/verify-provider-product-merge.mjs");
  check(
    "scripts: provider product merge check command",
    packageJson.includes('"provider-merge:check": "node scripts/verify-provider-product-merge.mjs"'),
    "package.json exposes a deterministic supplemental-provider merge check",
    "required"
  );
  check(
    "sourcing: supplemental provider merge safety",
    providerMerge.includes("mergeProviderProductBatches") &&
      providerMerge.includes("exact_normalized_title") &&
      providerMerge.includes("source_product_id") &&
      providerMerge.includes("hasReturnEvidence") &&
      providerMergeCheck.includes("supplemental retention") &&
      providerMergeCheck.includes("source-id deduplication"),
    "official and allowed public-web candidates retain distinct products, deduplicate conservative identities, and prefer explicit return evidence",
    "required"
  );
}

if (fileExists("package.json") && fileExists("lib/affiliateIdentity.ts") && fileExists("scripts/verify-affiliate-identity.mjs")) {
  const packageJson = readText("package.json");
  const identity = readText("lib/affiliateIdentity.ts");
  const identityCheck = readText("scripts/verify-affiliate-identity.mjs");
  check(
    "scripts: affiliate identity check command",
    packageJson.includes('"affiliate-identity:check": "node scripts/verify-affiliate-identity.mjs"'),
    "package.json exposes a deterministic affiliate destination identity check",
    "required"
  );
  check(
    "affiliate identity: product match contract",
    identity.includes('"MATCH"') &&
      identity.includes('"MISMATCH"') &&
      identity.includes('"UNRESOLVED"') &&
      identity.includes('"EXPECTED_ID_UNAVAILABLE"') &&
      identity.includes('"MANUAL_CONFIRMED"') &&
      identity.includes("getAffiliateIdentityReadiness") &&
      identityCheck.includes("URL-change invalidation") &&
      identityCheck.includes("changedProductUrl") &&
      identityCheck.includes("access-limited resolution"),
    "affiliate identity tests cover resolved matches, hard mismatches, access limits, explicit manual confirmation, changed-link invalidation, and changed-product invalidation",
    "required"
  );
}

if (fileExists("package.json") && fileExists("lib/manualImportIdentity.ts") && fileExists("scripts/verify-manual-import-safety.mjs")) {
  const packageJson = readText("package.json");
  const manualImportIdentity = readText("lib/manualImportIdentity.ts");
  const manualImportCheck = readText("scripts/verify-manual-import-safety.mjs");
  check(
    "scripts: manual import safety check command",
    packageJson.includes('"manual-import:check": "node scripts/verify-manual-import-safety.mjs"'),
    "package.json exposes a deterministic duplicate-safe manual candidate intake check",
    "required"
  );
  check(
    "manual import: append-only identity gate",
    manualImportIdentity.includes("EXISTING_COUPANG_PRODUCT_ID") &&
      manualImportIdentity.includes("EXISTING_TITLE_CATEGORY") &&
      manualImportIdentity.includes("toLowerCase()") &&
      manualImportCheck.includes("cross-source product IDs") &&
      manualImportCheck.includes("distinct categories"),
    "manual batch intake identifies existing product IDs across sources and normalized title/category collisions before any write",
    "required"
  );
}

if (fileExists("package.json") && fileExists("app/api/admin/products/link-intake/route.ts") && fileExists("scripts/verify-affiliate-link-intake.mjs")) {
  const packageJson = readText("package.json");
  const intakeRoute = readText("app/api/admin/products/link-intake/route.ts");
  const intakeCheck = readText("scripts/verify-affiliate-link-intake.mjs");
  check(
    "scripts: affiliate link intake contract check",
    packageJson.includes('"affiliate-link-intake:check": "node scripts/verify-affiliate-link-intake.mjs"') &&
      intakeRoute.includes("requireAdmin(request)") &&
      intakeRoute.includes("verifyCoupangAffiliateLinkResolution") &&
      intakeRoute.includes('sourcing_status: "needs_review"') &&
      intakeRoute.includes("is_published: false") &&
      intakeCheck.includes("approval sample links") &&
      intakeCheck.includes("duplicate conflicts"),
    "manual Partners-link intake is authenticated, strict, identity-bound, duplicate-safe, score-persisted, and review-only without secrets or network checks",
    "required"
  );
}

if (fileExists("package.json") && fileExists("app/api/admin/products/link-intake/bulk/route.ts") && fileExists("scripts/verify-affiliate-link-intake-bulk.mjs")) {
  const packageJson = readText("package.json");
  const bulkRoute = readText("app/api/admin/products/link-intake/bulk/route.ts");
  const bulkCheck = readText("scripts/verify-affiliate-link-intake-bulk.mjs");
  const intakeUi = readText("components/AdminAffiliateLinkIntake.tsx");
  check(
    "scripts: affiliate link bulk intake contract check",
    packageJson.includes('"affiliate-link-intake-bulk:check": "node scripts/verify-affiliate-link-intake-bulk.mjs"') &&
      bulkRoute.includes("requireAdmin(request)") &&
      bulkRoute.includes("POST as intakeOne") &&
      bulkRoute.includes("MAX_ITEMS = 8") &&
      bulkRoute.includes("MAX_BODY_BYTES = 64_000") &&
      bulkRoute.includes("MAX_CONCURRENCY = 2") &&
      bulkCheck.includes("review-only persistence") &&
      intakeUi.includes("/api/admin/products/link-intake/bulk"),
    "bulk Partners-link intake is authenticated, bounded, and delegates every row to the strict single-item review gate",
    "required"
  );
}

if (fileExists("components/AffiliateButton.tsx") && fileExists("components/ApprovalCoupangButton.tsx")) {
  const affiliateButton = readText("components/AffiliateButton.tsx");
  const approvalButton = readText("components/ApprovalCoupangButton.tsx");
  check(
    "public CTA: component-level Partners link guard",
    affiliateButton.includes("isUsableAffiliateUrl") &&
      affiliateButton.includes("affiliateLinkReady") &&
      affiliateButton.includes("if (!affiliateLinkReady)") &&
      affiliateButton.includes('target="_blank"') &&
      !affiliateButton.includes("window.open") &&
      !affiliateButton.includes("window.location.assign") &&
      approvalButton.includes("isCoupangPartnersLink") &&
      approvalButton.includes("partnerLinkReady") &&
      approvalButton.includes("if (!partnerLinkReady)") &&
      approvalButton.includes('target="_blank"') &&
      !approvalButton.includes("window.open") &&
      !approvalButton.includes("window.location.assign"),
    "purchase buttons fail closed when a caller passes a missing, regular, or invalid Coupang URL",
    "required"
  );
}

if (
  fileExists("package.json") &&
  fileExists("lib/bootstrapCatalog.ts") &&
  fileExists("lib/dataStore.ts") &&
  fileExists("scripts/verify-bootstrap-catalog-runtime.mjs") &&
  fileExists("app/api/admin/bootstrap-catalog/route.ts") &&
  fileExists("components/AdminBootstrapCatalogPanel.tsx")
) {
  const packageJson = readText("package.json");
  const catalog = readText("lib/bootstrapCatalog.ts");
  const dataStore = readText("lib/dataStore.ts");
  const runtimeCheck = readText("scripts/verify-bootstrap-catalog-runtime.mjs");
  const route = readText("app/api/admin/bootstrap-catalog/route.ts");
  const panel = readText("components/AdminBootstrapCatalogPanel.tsx");
  check(
    "scripts: bootstrap catalog runtime check command",
    packageJson.includes('"bootstrap-catalog:check": "node scripts/verify-bootstrap-catalog-runtime.mjs"'),
    "package.json exposes a production-runtime bootstrap catalog hydration check",
    "required"
  );
  check(
    "scripts: demo catalog stability command",
    packageJson.includes('"demo-catalog:check": "node --disable-warning=ExperimentalWarning --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types scripts/verify-demo-catalog-stability.mjs"') &&
      fileExists("scripts/verify-demo-catalog-stability.mjs"),
    "package.json exposes a deterministic local demo product identity check",
    "required"
  );
  check(
    "bootstrap catalog: verified temporary persistence",
    catalog.includes('BOOTSTRAP_CATALOG_ENV = "RETURNPICK_BOOTSTRAP_CATALOG_JSON"') &&
      catalog.includes("BOOTSTRAP_CATALOG_MAX_BYTES = 28_000") &&
      catalog.includes("BOOTSTRAP_CATALOG_MAX_PRODUCTS = 12") &&
      catalog.includes("isSyntheticSource") &&
      catalog.includes("identityBoundToCurrentProduct") &&
      catalog.includes("LAST_OBSERVED_AT_REQUIRED") &&
      catalog.includes("isPublicDealReady") &&
      dataStore.includes("hydrateBootstrapCatalog") &&
      dataStore.includes("snapshot.observed_at = product.last_observed_at") &&
      runtimeCheck.includes("stale or forged affiliate identity rejection"),
    "preapproval catalog only restores fresh, non-demo, public-ready products whose exact affiliate destination remains bound to the candidate",
    "required"
  );
  check(
    "admin: bootstrap catalog export",
    route.includes("requireAdmin") &&
      route.includes("createBootstrapCatalog") &&
      route.includes('"Cache-Control": "no-store, max-age=0"') &&
      panel.includes("승인 대기용 출시 카탈로그") &&
      panel.includes("/api/admin/bootstrap-catalog") &&
      panel.includes("Value 복사") &&
      panel.includes("Supabase 운영 DB 연결이 여전히 필요합니다"),
    "admin can export a bounded reviewed catalog without treating the temporary bridge as a replacement for Supabase",
    "required"
  );
  check(
    "supabase: invalid environment guard",
    fileExists("lib/supabase.ts") &&
      fileExists("scripts/verify-supabase-config-guard.mjs") &&
      packageJson.includes('"supabase-config:check": "node --disable-warning=ExperimentalWarning --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types scripts/verify-supabase-config-guard.mjs"') &&
      readText("lib/supabase.ts").includes("getSupabaseKey") &&
      readText("lib/supabase.ts").includes("getValidSupabaseUrl"),
    "Supabase clients remain disabled for missing, invalid, short, or masked deployment values",
    "required"
  );
}

if (
  fileExists("package.json") &&
  fileExists("lib/launchCapabilityPolicy.ts") &&
  fileExists("scripts/verify-launch-capability-policy.mjs") &&
  fileExists("lib/apiReadiness.ts") &&
  fileExists("lib/scheduler.ts") &&
  fileExists("app/api/admin/launch/route.ts")
) {
  const packageJson = readText("package.json");
  const policy = readText("lib/launchCapabilityPolicy.ts");
  const policyCheck = readText("scripts/verify-launch-capability-policy.mjs");
  const readiness = readText("lib/apiReadiness.ts");
  const scheduler = readText("lib/scheduler.ts");
  const launchRoute = readText("app/api/admin/launch/route.ts");
  check(
    "scripts: launch capability policy check command",
    packageJson.includes('"launch-capabilities:check": "node scripts/verify-launch-capability-policy.mjs"'),
    "package.json exposes a deterministic core-versus-optional launch policy check",
    "required"
  );
  check(
    "launch capabilities: core readiness contract",
      policy.includes('OPTIONAL_CAPABILITY_ITEM_IDS = ["coupang", "naver", "telegram"]') &&
      policy.includes('CORE_RUNTIME_ITEM_IDS = ["supabase", "site", "approval_link", "admin_password", "cron_secret"]') &&
      policy.includes("getLaunchBlockingItemIds") &&
      policy.includes("getRequiredConnectionCheckIds") &&
      policyCheck.includes("Coupang API, Naver, and Telegram must not block manual-link publishing") &&
      policy.includes("launchReady: runtimeReady && blockingItemIds.length === 0") &&
      policy.includes("evaluateLaunchReadiness") &&
      readiness.includes("evaluateLaunchReadiness(items, publicWebEnabled)"),
    "manual-link launch requires durable storage and public/admin/cron safety, while Coupang API, Naver, and Telegram stay visible as optional capabilities",
    "required"
  );
  check(
    "launch capabilities: scoped optional failure gates",
    policy.includes("hasBlockingLaunchError") &&
      launchRoute.includes("blocking: false") &&
      launchRoute.includes("hasBlockingLaunchError(steps)") &&
      scheduler.includes('skipped_reason: "TELEGRAM_NOT_READY"') &&
      scheduler.includes('isCapabilityReady(gate.readiness.items, "telegram")') &&
      policyCheck.includes("optional jobs remain gated"),
    "Naver failures do not suppress first-launch confirmation, while Telegram delivery waits without blocking sourcing or site publishing",
    "required"
  );
}

if (fileExists("package.json") && fileExists("lib/naverProductMatch.ts") && fileExists("scripts/verify-naver-product-match.mjs")) {
  const packageJson = readText("package.json");
  const matcher = readText("lib/naverProductMatch.ts");
  const matcherCheck = readText("scripts/verify-naver-product-match.mjs");
  check(
    "scripts: Naver SKU match check command",
    packageJson.includes('"naver-match:check": "node scripts/verify-naver-product-match.mjs"'),
    "package.json exposes a deterministic Naver Shopping SKU identity check",
    "required"
  );
  check(
    "Naver SKU match: conservative product identity contract",
    matcher.includes("matchNaverProductSku") &&
      matcher.includes("ACCESSORY_ONLY") &&
      matcher.includes("MODEL_MISMATCH") &&
      matcher.includes("SPEC_CONFLICT") &&
      matcher.includes("CANDIDATE_VARIANT_AMBIGUOUS") &&
      matcher.includes("INSUFFICIENT_IDENTITY") &&
      matcher.includes("shouldPreferNaverSkuCandidate") &&
      matcherCheck.includes("exact model") &&
      matcherCheck.includes("option ambiguity") &&
      matcherCheck.includes("accessory rejection") &&
      matcherCheck.includes("confidence-first price ranking"),
    "Naver price matching rejects accessories, model/spec conflicts, ambiguous variants, and weak identities before comparing prices",
    "required"
  );
}

if (fileExists("package.json") && fileExists("lib/providers/coupangPartnersProvider.ts") && fileExists("scripts/verify-coupang-provider.mjs")) {
  const packageJson = readText("package.json");
  const coupangProviderCheck = readText("scripts/verify-coupang-provider.mjs");
  check(
    "scripts: Coupang provider contract check command",
    packageJson.includes('"coupang-provider:check": "node scripts/verify-coupang-provider.mjs"'),
    "package.json exposes a deterministic Coupang provider response-shape check",
    "required"
  );
  check(
    "provider: Coupang nested deeplink response contract",
    coupangProviderCheck.includes("nested deeplink response normalization") &&
      coupangProviderCheck.includes("API_NOT_CONFIGURED") &&
      coupangProviderCheck.includes("shorten_url"),
    "Coupang deeplink parsing keeps nested response support and the unconfigured-provider contract covered",
    "required"
  );
}

if (
  fileExists("package.json") &&
  fileExists("lib/naverPriceTrust.ts") &&
  fileExists("scripts/verify-naver-price-trust.mjs") &&
  fileExists("lib/priceReference.ts") &&
  fileExists("lib/scoring.ts") &&
  fileExists("lib/naverPriceBackfill.ts")
) {
  const packageJson = readText("package.json");
  const trust = readText("lib/naverPriceTrust.ts");
  const trustCheck = readText("scripts/verify-naver-price-trust.mjs");
  const priceReference = readText("lib/priceReference.ts");
  const scoring = readText("lib/scoring.ts");
  const backfill = readText("lib/naverPriceBackfill.ts");
  check(
    "scripts: Naver price trust check command",
    packageJson.includes('"naver-price-trust:check": "node scripts/verify-naver-price-trust.mjs"'),
    "package.json exposes deterministic persisted-price provenance checks",
    "required"
  );
  check(
    "Naver price trust: evidence bound to product identity",
    ["product_fingerprint", "verified_api", "verified_manual", "unverified", "acceptedSkuReasons"].every((value) => trust.includes(value)) &&
      ["legacy rejection", "product-fingerprint invalidation"].every((value) => trustCheck.includes(value)),
    "legacy prices stay untrusted unless price, accepted SKU evidence, and product fingerprint agree",
    "required"
  );
  check(
    "Naver price trust: public scoring and backfill integration",
    priceReference.includes("getNaverPriceTrust(product)") &&
      scoring.includes("naver_price_status") &&
      scoring.includes("return scoreIsCurrent ? stored : calculateDealScore(product)") &&
      backfill.includes('["missing", "unverified"].includes(getNaverPriceTrust(product).status)') &&
      backfill.includes("withNaverPriceFingerprint"),
    "public price calculations reject unverified legacy values and backfill rechecks them with bound evidence",
    "required"
  );
}

if (fileExists("package.json") && fileExists("scripts/verify-production-readiness.mjs")) {
  const packageJson = readText("package.json");
  const productionVerifier = readText("scripts/verify-production-readiness.mjs");
  const envLoader = fileExists("scripts/load-env-files.mjs") ? readText("scripts/load-env-files.mjs") : "";
  check(
    "scripts: production readiness commands",
    packageJson.includes('"check:production": "node scripts/verify-production-readiness.mjs"') &&
      packageJson.includes('"check:production:launch": "node scripts/verify-production-readiness.mjs --launch"'),
    "package.json exposes report and launch-mode production readiness checks",
    "required"
  );
  check(
    "scripts: production readiness verifier",
    productionVerifier.includes("RETURNPICK_ADMIN_PASSWORD") &&
      productionVerifier.includes(".env.production") &&
      productionVerifier.includes("loadEnvFiles") &&
      productionVerifier.includes("blankEnvSources") &&
      productionVerifier.includes("adminPasswordMissingDetail") &&
      productionVerifier.includes('warn("admin password"') &&
      productionVerifier.includes('fail("admin password"') &&
      productionVerifier.includes("/products/approval-sample") &&
      productionVerifier.includes("/disclosure") &&
      productionVerifier.includes("/robots.txt") &&
      productionVerifier.includes("/sitemap.xml") &&
      productionVerifier.includes("/api/admin/api-readiness") &&
      productionVerifier.includes("/api/admin/launch") &&
      productionVerifier.includes("/api/admin/scheduler-health") &&
      productionVerifier.includes("checkDisclosurePage") &&
      productionVerifier.includes("checkRobotsTxt") &&
      productionVerifier.includes("checkSitemapXml") &&
      productionVerifier.includes("checkPublicSecurityHeaders") &&
      productionVerifier.includes("checkPrivateRouteHeaders") &&
      productionVerifier.includes("checkAdminLaunchApiProtection") &&
      productionVerifier.includes("checkAdminSessionProtection") &&
      productionVerifier.includes("checkManualPriceRouteProtection") &&
      productionVerifier.includes("/api/admin/prices/manual") &&
      productionVerifier.includes("/api/admin/session") &&
      productionVerifier.includes("public security headers") &&
      productionVerifier.includes("admin route headers") &&
      productionVerifier.includes("admin api headers") &&
      productionVerifier.includes("admin launch api headers") &&
      productionVerifier.includes("launch api protection") &&
      productionVerifier.includes("ADMIN_PASSWORD_NOT_CONFIGURED") &&
      productionVerifier.includes("UNAUTHORIZED") &&
      productionVerifier.includes("checkAdminUiBundle") &&
      productionVerifier.includes("adminUiRequiredText") &&
      productionVerifier.includes("/_next/static/") &&
      productionVerifier.includes("상품별 링크 보강") &&
      productionVerifier.includes("API 없이 수동 확인") &&
      productionVerifier.includes("확인 가격 저장") &&
      productionVerifier.includes("품질 보강 후보로 이동") &&
      productionVerifier.includes("x-robots-tag") &&
      productionVerifier.includes("cache-control") &&
      productionVerifier.includes("/guide/safe-categories") &&
      productionVerifier.includes("requiredConnectionCheckIds") &&
      productionVerifier.includes("nofollow sponsored noopener noreferrer") &&
      productionVerifier.includes("--strict-scheduler"),
    "production verifier checks approval-page evidence, disclosure evidence, robots/sitemap coverage, deployment headers, launch/session/manual-price API protection, deployed admin repair UI chunks, admin live checks, required cards, scheduler health, and local production env files without embedding secrets",
    "required"
  );
  check(
    "scripts: production env-file loader",
    envLoader.includes('defaultEnvFiles = [".env.production", ".env.local", ".env"]') &&
    envLoader.includes("isMaskedEnvValue") &&
    envLoader.includes("if (isMaskedEnvValue(trimmed)) continue") &&
      envLoader.includes("parseEnvFile") &&
      envLoader.includes("parseRawEnvFile") &&
      envLoader.includes("rawEnvFileCache") &&
      envLoader.includes("loadEnvFiles") &&
      envLoader.includes("envRawEntries") &&
      envLoader.includes("blankEnvSources") &&
      envLoader.includes("process.env[key]") &&
      productionVerifier.includes('from "./load-env-files.mjs"'),
    "production CLI scripts share a local env-file loader that can diagnose raw whitespace without printing secrets",
    "required"
  );
}

if (fileExists("app/robots.ts") && fileExists("app/sitemap.ts")) {
  const robots = readText("app/robots.ts");
  const sitemap = readText("app/sitemap.ts");
  check(
    "public SEO routes: robots and sitemap",
    robots.includes('allow: "/"') &&
      robots.includes('disallow: ["/admin", "/api"]') &&
      robots.includes("/sitemap.xml") &&
      sitemap.includes('/guide/return-checklist') &&
      sitemap.includes('/guide/safe-categories') &&
      sitemap.includes('/disclosure') &&
      sitemap.includes('path: "/picks"') &&
      sitemap.includes('/picks/novatech-s1-window-cleaner') &&
      !sitemap.includes('/products/approval-sample'),
    "robots protects admin/API while sitemap exposes core public, guide, disclosure, and indexable editorial routes",
    "required"
  );
  check(
    "public SEO: customer-ready detail sitemap",
    sitemap.includes("export const revalidate = 300") &&
      sitemap.includes("listProducts({ published: true })") &&
      sitemap.includes("products.filter(isPublicDealReady)") &&
      sitemap.includes("path: `/deals/${product.id}`") &&
      sitemap.includes("product.last_observed_at ?? product.updated_at"),
    "the sitemap refreshes customer-ready published detail URLs while keeping incomplete and approval-only products out",
    "required"
  );
}

if (fileExists("app/disclosure/page.tsx")) {
  const disclosurePage = readText("app/disclosure/page.tsx");
  check(
    "public SEO: disclosure self-canonical",
    disclosurePage.includes('const canonicalUrl = `${getSiteUrl()}/disclosure`') &&
      disclosurePage.includes("alternates:") &&
      disclosurePage.includes("canonical: canonicalUrl") &&
      disclosurePage.includes("url: canonicalUrl") &&
      disclosurePage.includes('type: "website"'),
    "the affiliate disclosure page owns its canonical and social URL instead of inheriting the site root",
    "required"
  );
}

if (fileExists("app/deals/page.tsx")) {
  const dealsPage = readText("app/deals/page.tsx");
  check(
    "public SEO: canonical deals index",
    dealsPage.includes('const canonicalUrl = `${getSiteUrl()}/deals`') &&
      dealsPage.includes("export const metadata: Metadata") &&
      dealsPage.includes("alternates: { canonical: canonicalUrl }") &&
      dealsPage.includes("robots: { index: true, follow: true }") &&
      dealsPage.includes("url: canonicalUrl") &&
      dealsPage.includes('images: [{ url: `${getSiteUrl()}/opengraph-image` }]') &&
      dealsPage.includes('images: [`${getSiteUrl()}/twitter-image`]'),
    "the main deal index self-canonicalizes filtered URLs and exposes consistent search and social metadata",
    "required"
  );
  check(
    "public SEO: honest customer-ready deal ItemList JSON-LD",
    dealsPage.includes("const allPublished = (await listProducts({ published: true })).filter(isPublicDealVisible)") &&
      dealsPage.includes("isDemoProduct") &&
      dealsPage.includes("function buildDealListJsonLd(products: ProductWithScore[])") &&
      dealsPage.includes("products.slice(0, 60)") &&
      dealsPage.includes('"@type": "ItemList"') &&
      dealsPage.includes('"@type": "ListItem"') &&
      dealsPage.includes("itemListElement: items") &&
      dealsPage.includes("serializeJsonLd(dealListJsonLd)") &&
      !dealsPage.includes("offers:") &&
      !dealsPage.includes("price:") &&
      !dealsPage.includes("availability:") &&
      !dealsPage.includes("stock_count:") &&
      !dealsPage.includes("affiliate_url:"),
    "customer-ready deals expose a capped ItemList of Product name/URL identity data without price, stock, availability, Offer, or affiliate claims",
    "required"
  );
}

if (
  fileExists("app/api/admin/products/route.ts") &&
  fileExists("app/api/admin/products/import/route.ts") &&
  fileExists("components/AdminManualProductForm.tsx") &&
  fileExists("components/AdminManualProductBulkForm.tsx") &&
  fileExists("components/AdminAffiliateLinkQueue.tsx") &&
  fileExists("app/admin/page.tsx")
) {
  const adminProductsRoute = readText("app/api/admin/products/route.ts");
  const adminProductsImportRoute = readText("app/api/admin/products/import/route.ts");
  const manualProductForm = readText("components/AdminManualProductForm.tsx");
  const manualProductBulkForm = readText("components/AdminManualProductBulkForm.tsx");
  const affiliateLinkQueue = readText("components/AdminAffiliateLinkQueue.tsx");
  const adminPage = readText("app/admin/page.tsx");
  check(
    "admin sourcing: manual real-product draft intake",
    adminProductsRoute.includes("export async function POST") &&
      adminProductsRoute.includes("requireAdmin(request)") &&
      adminProductsRoute.includes("isUsableCoupangProductUrl") &&
      adminProductsRoute.includes("extractCoupangProductId") &&
      adminProductsRoute.includes("getCoupangPartnersLinkIssue") &&
      adminProductsRoute.includes("isUsableAffiliateUrl") &&
      adminProductsRoute.includes("isApprovalSampleAffiliateUrl") &&
      adminProductsRoute.includes('source: "manual_admin"') &&
      adminProductsRoute.includes('sourcing_status: "needs_review"') &&
      adminProductsRoute.includes("insertSourcedProduct") &&
      adminProductsRoute.includes("findManualImportConflict") &&
      adminProductsRoute.includes("EXISTING_PRODUCT_CONFLICT") &&
      !adminProductsRoute.includes("upsertSourcedProduct") &&
      manualProductForm.includes("쿠팡 상품 상세 URL") &&
      manualProductForm.includes("반품등급, 반품가, 네이버 가격과 파트너스 링크는 추정하지 않고") &&
      manualProductForm.includes("검토 후보 추가") &&
      manualProductForm.includes("상품 ID") &&
      manualProductForm.includes("#admin-affiliate-links") &&
      manualProductForm.includes("?candidate=${encodeURIComponent(createdProductId)}#admin-affiliate-links") &&
      manualProductForm.includes("affiliate_url") &&
      manualProductForm.includes("쿠팡 파트너스 링크 (선택)") &&
      manualProductForm.includes("목적지 확인") &&
      manualProductForm.includes("기존 후보 ID") &&
      manualProductForm.includes("새 입력으로 덮어쓰지 않았습니다") &&
      adminPage.includes("AdminManualProductForm"),
    "an authenticated admin can append a real Coupang product with an optional strict Partners link into needs_review without overwriting an existing candidate",
    "required"
  );
  check(
    "admin sourcing: exact affiliate queue handoff",
    affiliateLinkQueue.includes('new URLSearchParams(window.location.search).get("candidate")') &&
      affiliateLinkQueue.includes("targetProductId") &&
      affiliateLinkQueue.includes("bTarget - aTarget") &&
      affiliateLinkQueue.includes("scrollToAdminAnchor(`admin-affiliate-product-${targetProductId}`)") &&
      affiliateLinkQueue.includes('id={`admin-affiliate-product-${product.id}`}'),
    "the manual intake success link focuses the exact new candidate without automatically verifying, opening, or publishing its affiliate destination",
    "required"
  );
  check(
    "admin sourcing: spreadsheet bulk-entry helper",
    manualProductBulkForm.includes("BULK_FIELD_ORDER") &&
      manualProductBulkForm.includes("navigator.clipboard.writeText(BULK_FIELD_ORDER)") &&
      manualProductBulkForm.includes("실제 쿠팡 상품 URL과 상품별 파트너스 링크"),
    "bulk intake exposes a copyable spreadsheet column order and keeps product-specific link requirements visible",
    "required"
  );
  check(
    "admin sourcing: batch manual candidate intake",
    adminProductsImportRoute.includes("requireAdmin(request)") &&
      adminProductsImportRoute.includes("MAX_ROWS = 40") &&
      adminProductsImportRoute.includes("isUsableCoupangProductUrl") &&
      adminProductsImportRoute.includes("isUsableAffiliateUrl") &&
      adminProductsImportRoute.includes("createDealScore") &&
      adminProductsImportRoute.includes("parseIntegerField") &&
      adminProductsImportRoute.includes("source_price: sourcePrice.value") &&
      adminProductsImportRoute.includes("return_price: returnPrice.value") &&
      adminProductsImportRoute.includes("INVALID_CONDITION_GRADE") &&
      adminProductsImportRoute.includes('sourcing_status: "needs_review"') &&
      adminProductsImportRoute.includes("is_published: false") &&
      adminProductsImportRoute.includes("DUPLICATE_PRODUCT_ID") &&
      adminProductsImportRoute.includes("DUPLICATE_TITLE_CATEGORY") &&
      adminProductsImportRoute.includes("findManualImportConflict") &&
      adminProductsImportRoute.includes("existingConflict.code") &&
      adminProductsImportRoute.includes("insertSourcedProduct") &&
      adminProductsImportRoute.includes("existing_skipped_count") &&
      manualProductBulkForm.includes("/api/admin/products/import") &&
      manualProductBulkForm.includes("최대 40줄") &&
      manualProductBulkForm.includes("수집 당시 가격") &&
      manualProductBulkForm.includes("반품가") &&
      manualProductBulkForm.includes("반품등급") &&
      manualProductBulkForm.includes("후보 일괄 추가") &&
      manualProductBulkForm.includes('data-import-policy="append-only"') &&
      manualProductBulkForm.includes("검토 대기·비공개") &&
      adminPage.includes("AdminManualProductBulkForm"),
    "authenticated admins can add bounded real-product candidate rows in bulk while keeping every row unpublished and review-gated",
    "required"
  );
}

if (
  fileExists("app/saved/page.tsx") &&
  fileExists("components/SavedDealButton.tsx") &&
  fileExists("components/SavedDealsBoard.tsx") &&
  fileExists("lib/clientTracking.ts") &&
  fileExists("app/layout.tsx")
) {
  const savedPage = readText("app/saved/page.tsx");
  const savedButton = readText("components/SavedDealButton.tsx");
  const savedBoard = readText("components/SavedDealsBoard.tsx");
  const clientTracking = readText("lib/clientTracking.ts");
  const layout = readText("app/layout.tsx");
  const dealCard = readText("components/DealCard.tsx");
  const dealDetail = readText("components/DealDetail.tsx");
  check(
    "public UX: saved deal return path",
    savedPage.includes("robots: { index: false, follow: false }") &&
      savedPage.includes("SavedDealsBoard") &&
      savedButton.includes("savedDealsChangeEvent") &&
      savedButton.includes("aria-pressed") &&
      savedBoard.includes("/api/products/compare?ids=") &&
      savedBoard.includes("AffiliateButton") &&
      savedBoard.includes("AffiliateNotice") &&
      savedBoard.includes("unavailableItems") &&
      savedBoard.includes("removeUnavailableItems") &&
      savedBoard.includes("확인되지 않는 찜한 상품") &&
      clientTracking.includes("savedDealsChangeEvent") &&
      layout.includes('href="/saved"') &&
      dealCard.includes("SavedDealButton") &&
      dealDetail.includes("SavedDealButton"),
    "visitors can save public deals locally, return to a noindex saved-deals page, and continue through disclosed detail or affiliate CTAs without adding login or personal-data storage",
    "required"
  );
  check(
    "public UX: freshness on deal cards",
    dealCard.includes('import { getDealFreshness } from "@/lib/dealFreshness"') &&
      dealCard.includes("const freshness = getDealFreshness(product)") &&
      dealCard.includes("data-freshness-status={freshness.status}") &&
      dealCard.includes("freshness.description") &&
      dealCard.includes("freshness.label"),
    "public deal cards expose the latest observation state before a visitor opens a deal, while the detail page keeps the full verification strip",
    "required"
  );
  check(
    "public UX: card affiliate CTA",
    dealCard.includes('import AffiliateButton from "@/components/AffiliateButton"') &&
      dealCard.includes('import { getCoupangOutboundLink } from "@/lib/coupangLink"') &&
      dealCard.includes("const outboundLink = getCoupangOutboundLink(product)") &&
      dealCard.includes('label="쿠팡에서 가격 확인"') &&
      dealCard.includes('placement="deal_card"') &&
      dealCard.includes("이 페이지의 일부 링크는 제휴 링크이며") &&
      dealCard.includes('href="/disclosure"'),
    "customer-ready deal cards expose a tracked Coupang price CTA with nearby affiliate disclosure and a disclosure-page link",
    "required"
  );
}

if (
  fileExists("app/deals/category/[category]/page.tsx") &&
  fileExists("lib/category.ts") &&
  fileExists("lib/categoryLanding.ts") &&
  fileExists("app/page.tsx") &&
  fileExists("app/sitemap.ts")
) {
  const categoryLandingPage = readText("app/deals/category/[category]/page.tsx");
  const categorySource = readText("lib/category.ts");
  const categoryLanding = readText("lib/categoryLanding.ts");
  const homePage = readText("app/page.tsx");
  const sitemap = readText("app/sitemap.ts");
  const categoryIds = ["laptop", "monitor", "robot_vacuum", "cordless_vacuum", "air_purifier", "dehumidifier"];
  check(
    "public SEO: canonical category landing pages",
    categoryIds.every((category) => categoryLanding.includes(`${category}: {`)) &&
      categoryLanding.includes("Record<Category, CategoryLandingContent>") &&
      categorySource.includes("Object.prototype.hasOwnProperty.call(categories, value)") &&
      categoryLandingPage.includes("generateStaticParams") &&
      categoryLandingPage.includes("dynamicParams = false") &&
      categoryLandingPage.includes("generateMetadata") &&
      categoryLandingPage.includes("alternates: { canonical: canonicalUrl }") &&
      categoryLandingPage.includes("isPublicDealVisible") &&
      categoryLandingPage.includes("isDemoProduct") &&
      categoryLandingPage.includes("product.category === category") &&
      categoryLandingPage.includes('"@type": "FAQPage"') &&
      categoryLandingPage.includes("AffiliateNotice") &&
      categoryLandingPage.includes("가격과 반품 근거가 확인되기 전에는 상품 수를 채우기 위해 임의 게시하지 않습니다") &&
      !categoryLandingPage.includes('"@type": "Offer"') &&
      homePage.includes('/deals/category/${category.value}') &&
      sitemap.includes('/deals/category/${category.value}') &&
      sitemap.includes("categoryOptions.map") &&
      !sitemap.includes('/products/approval-sample'),
    "six category pages use self-canonical metadata, public-ready products, unique buying guidance, FAQ schema, honest empty states, and sitemap/home discovery",
    "required"
  );
}

if (fileExists("next.config.mjs")) {
  const nextConfig = readText("next.config.mjs");
  check(
    "deployment headers: security and private route indexing",
    nextConfig.includes("async headers()") &&
      nextConfig.includes("Referrer-Policy") &&
      nextConfig.includes("strict-origin-when-cross-origin") &&
      nextConfig.includes("X-Content-Type-Options") &&
      nextConfig.includes("nosniff") &&
      nextConfig.includes("X-Frame-Options") &&
      nextConfig.includes("DENY") &&
      nextConfig.includes("Permissions-Policy") &&
      nextConfig.includes("X-Robots-Tag") &&
      nextConfig.includes("noindex, nofollow, noarchive") &&
      nextConfig.includes("Cache-Control") &&
      nextConfig.includes("no-store") &&
      nextConfig.includes('source: "/admin"') &&
      nextConfig.includes('source: "/admin/:path*"') &&
      nextConfig.includes('source: "/api/:path*"'),
    "deployment headers reduce referrer leakage, clickjacking risk, and indexing/caching of admin/API routes",
    "required"
  );
}

if (fileExists(".vercelignore")) {
  const vercelIgnore = readText(".vercelignore");
  check(
    "deployment hygiene: vercel ignore",
    vercelIgnore.includes(".env") &&
      vercelIgnore.includes(".env.*") &&
      vercelIgnore.includes("!.env.example") &&
      vercelIgnore.includes(".returnpick/") &&
      vercelIgnore.includes(".vercel/") &&
      vercelIgnore.includes(".next/") &&
      vercelIgnore.includes("node_modules/") &&
      vercelIgnore.includes("*.log") &&
      vercelIgnore.includes("tsconfig.tsbuildinfo"),
    "Vercel deploy excludes local env files, generated state, build output, logs, and local TypeScript cache",
    "required"
  );
}

if (fileExists("package.json") && fileExists("scripts/run-production-launch.mjs")) {
  const packageJson = readText("package.json");
  const productionLaunch = readText("scripts/run-production-launch.mjs");
  check(
    "scripts: production launch command",
    packageJson.includes('"launch:production": "node scripts/run-production-launch.mjs"'),
    "package.json exposes a guarded production first-launch runner",
    "required"
  );
  check(
    "scripts: production launch preflight",
    productionLaunch.includes("--confirm") &&
      productionLaunch.includes("positionalArgs") &&
      productionLaunch.includes("confirm") &&
      productionLaunch.includes("/api/admin/api-readiness") &&
      productionLaunch.includes("/api/admin/launch") &&
      productionLaunch.includes("isExternalHttpsSiteUrl") &&
      productionLaunch.includes("Production launch requires an external HTTPS site URL") &&
      productionLaunch.includes("Refusing localhost, .local, and http:// targets") &&
      productionLaunch.includes("requiredConnectionCheckIds") &&
      productionLaunch.includes("No data work was started") &&
      productionLaunch.includes("RETURNPICK_ADMIN_PASSWORD") &&
      productionLaunch.includes("loadEnvFiles") &&
      productionLaunch.includes('from "./load-env-files.mjs"') &&
      productionLaunch.includes("printReadinessBlockers") &&
      productionLaunch.includes("Blocking launch items") &&
      productionLaunch.includes("missingEnv") &&
      productionLaunch.includes("printRecoveryActions") &&
      productionLaunch.includes("recovery_actions") &&
      productionLaunch.includes("quick") &&
      productionLaunch.includes("standard") &&
      productionLaunch.includes("wide"),
    "production launch runner checks live readiness first, refuses non-public launch targets, prints blocking items, missing env next actions, and post-run recovery actions, and only starts data work with an explicit confirmation flag",
    "required"
  );
}

if (fileExists("package.json") && fileExists("scripts/run-production-deploy.mjs")) {
  const packageJson = readText("package.json");
  const productionDeploy = readText("scripts/run-production-deploy.mjs");
  check(
    "scripts: guarded production deploy command",
    packageJson.includes('"deploy:production:launch": "node scripts/run-production-deploy.mjs"') &&
      packageJson.includes('"deploy:production:go-live": "node scripts/run-production-deploy.mjs --first-launch"'),
    "package.json exposes a guarded Vercel production deploy runner for post-env setup",
    "required"
  );
  check(
    "scripts: Git deployment readiness command",
    packageJson.includes('"git:check": "node scripts/verify-git-deploy-readiness.mjs"') &&
      fileExists("scripts/verify-git-deploy-readiness.mjs"),
    "package.json exposes a Git tracking, clean-worktree, and upstream parity check before production deploy",
    "required"
  );
  check(
    "scripts: guarded production deploy safety",
    productionDeploy.includes("verify-git-deploy-readiness.mjs") &&
      productionDeploy.includes("Check Git deployment state") &&
      productionDeploy.includes("vercel") &&
      productionDeploy.includes("env") &&
      productionDeploy.includes("pull") &&
      productionDeploy.includes(".env.production") &&
      productionDeploy.includes("verify-vercel-env-names.mjs") &&
      productionDeploy.includes("verify-production-env.mjs") &&
      productionDeploy.includes("run-production-doctor.mjs") &&
      productionDeploy.includes("run-production-launch.mjs") &&
      productionDeploy.includes("vercel") &&
      productionDeploy.includes("deploy") &&
      productionDeploy.includes("--prod") &&
      productionDeploy.includes("confirmed deploy") &&
      productionDeploy.includes("preflight only") &&
      productionDeploy.includes("--first-launch") &&
      productionDeploy.includes("Production first launch") &&
      productionDeploy.includes("--confirm") &&
      productionDeploy.includes("No data work is started") &&
      productionDeploy.includes("npm run deploy:production:launch -- confirm") &&
      productionDeploy.includes("npm run deploy:production:go-live -- confirm") &&
      productionDeploy.includes("nextActionForOutcome") &&
      productionDeploy.includes("Fill the blank/invalid Production values shown above") &&
      productionDeploy.includes("Stop: fix the failed step before deploying production"),
    "guarded deploy requires committed and pushed source, pulls fresh env values, validates launch readiness, requires explicit confirm, deploys production, reruns launch doctor, and can run first launch only with an explicit first-launch request",
    "required"
  );
}

if (fileExists("scripts/verify-git-deploy-readiness.mjs")) {
  const gitDeployCheck = readText("scripts/verify-git-deploy-readiness.mjs");
  check(
    "scripts: Git deployment readiness safety",
    gitDeployCheck.includes("requiredTrackedFiles") &&
      gitDeployCheck.includes('["ls-files"]') &&
      gitDeployCheck.includes('["status", "--porcelain=v1", "--untracked-files=all"]') &&
      gitDeployCheck.includes("Upstream parity") &&
      gitDeployCheck.includes("commit the verified ReturnPick source") &&
      !gitDeployCheck.includes("process.env"),
    "Git deployment check verifies required tracked files, a clean worktree, and upstream parity without reading secrets",
    "required"
  );
}

if (fileExists("package.json") && fileExists("scripts/print-production-env-template.mjs")) {
  const packageJson = readText("package.json");
  const envTemplate = readText("scripts/print-production-env-template.mjs");
  check(
    "scripts: production env template command",
    packageJson.includes('"env:production": "node scripts/print-production-env-template.mjs"'),
    "package.json exposes a production env template generator",
    "required"
  );
  check(
    "scripts: production env template safety",
    envTemplate.includes("randomBytes") &&
      envTemplate.includes("positionalArgs") &&
      envTemplate.includes("ADMIN_PASSWORD") &&
      envTemplate.includes("CRON_SECRET") &&
      envTemplate.includes("RETURNPICK_CRON_SECRET") &&
      envTemplate.includes("RETURNPICK_SITE_URL") &&
      envTemplate.includes("COUPANG_ACCESS_KEY") &&
      envTemplate.includes("NAVER_CLIENT_ID") &&
      envTemplate.includes("NEXT_PUBLIC_SUPABASE_URL") &&
      envTemplate.includes("TELEGRAM_BOT_TOKEN") &&
      envTemplate.includes("Do not commit real values to git") &&
      envTemplate.includes("Sensitive provider keys are intentionally blank"),
    "production env template generates only local operational secrets and leaves official provider keys blank",
    "required"
  );
}

if (fileExists("package.json") && fileExists("scripts/verify-production-env.mjs")) {
  const packageJson = readText("package.json");
  const envVerifier = readText("scripts/verify-production-env.mjs");
  const vercelEnvVerifier = fileExists("scripts/verify-vercel-env-names.mjs") ? readText("scripts/verify-vercel-env-names.mjs") : "";
  const envRepairPlan = fileExists("scripts/print-vercel-env-repair-plan.mjs") ? readText("scripts/print-vercel-env-repair-plan.mjs") : "";
  check(
    "scripts: production env check command",
    packageJson.includes('"env:check": "node scripts/verify-production-env.mjs"') &&
      packageJson.includes('"env:check:launch": "node scripts/verify-production-env.mjs --launch"') &&
      packageJson.includes('"env:repair": "node scripts/print-vercel-env-repair-plan.mjs"'),
    "package.json exposes report and launch-mode production env preflight checks",
    "required"
  );
  check(
    "scripts: production env check safety",
    envVerifier.includes('from "./load-env-files.mjs"') &&
      envVerifier.includes("envRawEntries") &&
      envVerifier.includes("outerWhitespaceSource") &&
      envVerifier.includes("isVercelMaskedValue") &&
      envVerifier.includes("Vercel env pull masks this secret locally") &&
      envVerifier.includes("leading or trailing whitespace") &&
      envVerifier.includes("validateCoupangPartnersUrl") &&
      envVerifier.includes("validateTelegramBotToken") &&
      envVerifier.includes("SUPABASE_KEYS_DIFFER") &&
      envVerifier.includes("PUBLIC_WEB_ALLOWED_HOSTS") &&
      envVerifier.includes("blankEnvSources") &&
      envVerifier.includes("Next action checklist") &&
      envVerifier.includes("Settings > Environment Variables > Production") &&
      envVerifier.includes("npm run env:vercel:launch") &&
      envVerifier.includes("npm run doctor:production:launch") &&
      !envVerifier.includes("console.log(value)") &&
      !envVerifier.includes("console.error(value)"),
    "production env check validates launch env formats, blank values, and raw surrounding whitespace, then prints a safe Vercel repair checklist without secret values",
    "required"
  );
  check(
    "scripts: core launch env versus optional capabilities",
    envVerifier.includes('{ name: "NAVER_CLIENT_ID", required: false') &&
      envVerifier.includes('{ name: "TELEGRAM_BOT_TOKEN", required: false') &&
      vercelEnvVerifier.indexOf('"NAVER_CLIENT_ID"') > vercelEnvVerifier.indexOf("const recommendedNames") &&
      envRepairPlan.includes("Optional capabilities (do not block core launch)") &&
      envRepairPlan.includes("missing values gate only the Telegram job"),
    "launch-mode env checks require the manual approval link and Supabase while reporting Coupang API, Naver, and Telegram as optional capability setup",
    "required"
  );
  check(
    "scripts: Vercel env name check command",
    packageJson.includes('"env:pull:production": "npx vercel env pull .env.production --environment=production --yes"') &&
      packageJson.includes('"env:vercel": "node scripts/verify-vercel-env-names.mjs production"') &&
      packageJson.includes('"env:vercel:launch": "npm run env:pull:production && npm run env:vercel && npm run env:check:launch"'),
    "package.json exposes Vercel production env pull, env-name, and launch-value checks that do not print values",
    "required"
  );
  check(
    "scripts: Vercel env name check safety",
    vercelEnvVerifier.includes("vercel") &&
      vercelEnvVerifier.includes("env") &&
      vercelEnvVerifier.includes("ls") &&
      vercelEnvVerifier.includes("values: hidden by Vercel") &&
      vercelEnvVerifier.includes("requiredNames") &&
      vercelEnvVerifier.includes("recommendedNames") &&
      vercelEnvVerifier.includes("ADMIN_PASSWORD") &&
      vercelEnvVerifier.includes("SUPABASE_SERVICE_ROLE_KEY") &&
      vercelEnvVerifier.includes("SOURCING_ENRICHMENT_CONCURRENCY") &&
      vercelEnvVerifier.includes("TELEGRAM_BOT_TOKEN") &&
      !vercelEnvVerifier.includes("console.log(result.stdout)") &&
      !vercelEnvVerifier.includes("stdio: \"inherit\""),
    "Vercel env-name check verifies required names through the CLI without printing secret values",
    "required"
  );
  check(
    "scripts: Vercel env repair plan safety",
    envRepairPlan.includes("ReturnPick Vercel env repair plan") &&
      envRepairPlan.includes("secret values: never printed") &&
      envRepairPlan.includes("Safe non-secret operational defaults") &&
      envRepairPlan.includes("CRON_USE_MOCK_FALLBACK") &&
      envRepairPlan.includes("SOURCING_TIME_BUDGET_MS") &&
      envRepairPlan.includes("SOURCING_ENRICHMENT_CONCURRENCY") &&
      envRepairPlan.includes("AFFILIATE_BACKFILL_LIMIT") &&
      envRepairPlan.includes("PUBLIC_WEB_CRAWL_ENABLED") &&
      envRepairPlan.includes("External hourly scheduler (GitHub Actions)") &&
      envRepairPlan.includes("RETURNPICK_CRON_SECRET") &&
      envRepairPlan.includes("Vercel CRON_SECRET value. The value is never printed here.") &&
      envRepairPlan.includes("RETURNPICK_SITE_URL") &&
      envRepairPlan.includes("ReturnPick Hourly Scheduler") &&
      envRepairPlan.includes("/api/cron/sourcing") &&
      envRepairPlan.includes("/api/cron/telegram-digest?limit=1") &&
      envRepairPlan.includes("npm run env:vercel:launch") &&
      envRepairPlan.includes("npm run doctor:production:launch") &&
      envRepairPlan.includes("npm run launch:production -- standard confirm") &&
      !envRepairPlan.includes("console.log(process.env") &&
      !envRepairPlan.includes("console.error(process.env"),
    "Vercel env repair plan prints missing names, safe defaults, GitHub hourly scheduler setup, and next launch commands without dumping secret values",
    "required"
  );
}

if (fileExists("package.json") && fileExists("scripts/verify-supabase-schema.mjs")) {
  const packageJson = readText("package.json");
  const supabaseSchemaVerifier = readText("scripts/verify-supabase-schema.mjs");
  const supabaseSetupRunbook = fileExists("scripts/print-supabase-setup-runbook.mjs") ? readText("scripts/print-supabase-setup-runbook.mjs") : "";
  check(
    "scripts: production supabase schema command",
    packageJson.includes('"schema:setup": "node scripts/print-supabase-setup-runbook.mjs"') &&
      packageJson.includes('"schema:production": "node scripts/verify-supabase-schema.mjs"'),
    "package.json exposes Supabase SQL setup guidance and a direct live schema verifier for post-approval setup",
    "required"
  );
  check(
    "scripts: production supabase schema verifier",
    supabaseSchemaVerifier.includes("EXPECTED_SCHEMA_VERSION") &&
      supabaseSchemaVerifier.includes("returnpick_schema_meta") &&
      supabaseSchemaVerifier.includes("is_strict_coupang_partners_url") &&
      supabaseSchemaVerifier.includes("sourcing_runs") &&
      supabaseSchemaVerifier.includes("affiliate_events") &&
      supabaseSchemaVerifier.includes("context") &&
      supabaseSchemaVerifier.includes("writeSmokeCheck") &&
      supabaseSchemaVerifier.includes("publicColumnBoundaryCheck") &&
      supabaseSchemaVerifier.includes("NEXT_PUBLIC_SUPABASE_ANON_KEY") &&
      supabaseSchemaVerifier.includes("internal product columns denied") &&
      supabaseSchemaVerifier.includes("internal snapshot columns denied") &&
      supabaseSchemaVerifier.includes("NEXT_PUBLIC_SUPABASE_URL") &&
      supabaseSchemaVerifier.includes("SUPABASE_SERVICE_ROLE_KEY") &&
      supabaseSchemaVerifier.includes("loadEnvFiles"),
    "Supabase schema verifier checks version, required tables/columns, strict affiliate RPC, write smoke paths, and local env files without printing secrets",
    "required"
  );
  check(
    "scripts: supabase setup runbook safety",
    supabaseSetupRunbook.includes("ReturnPick Supabase setup runbook") &&
      supabaseSetupRunbook.includes("requiredFragments") &&
      supabaseSetupRunbook.includes("is_strict_coupang_partners_url") &&
      supabaseSetupRunbook.includes("sourced_products_public_affiliate_url_check") &&
      supabaseSetupRunbook.includes("Public can read published products") &&
      supabaseSetupRunbook.includes("public role revoke boundary") &&
      supabaseSetupRunbook.includes("internal product column boundary") &&
      supabaseSetupRunbook.includes("npm run schema:production") &&
      supabaseSetupRunbook.includes("npm run doctor:production:launch") &&
      !supabaseSetupRunbook.includes("process.env") &&
      !supabaseSetupRunbook.includes("SUPABASE_SERVICE_ROLE_KEY"),
    "Supabase setup runbook verifies the local launch-critical SQL fragments and prints apply/verify steps without secret values",
    "required"
  );
}

if (fileExists("package.json") && fileExists("scripts/run-production-doctor.mjs")) {
  const packageJson = readText("package.json");
  const productionDoctor = readText("scripts/run-production-doctor.mjs");
  check(
    "scripts: production doctor command",
    packageJson.includes('"doctor:production": "node scripts/run-production-doctor.mjs"') &&
      packageJson.includes('"doctor:production:launch": "node scripts/run-production-doctor.mjs --launch"') &&
      packageJson.includes('"doctor:production:fresh": "npm run env:pull:production && npm run env:vercel && npm run doctor:production"') &&
      packageJson.includes('"doctor:production:launch:fresh": "npm run env:pull:production && npm run env:vercel && npm run env:check:launch && npm run doctor:production:launch"'),
    "package.json exposes one-command production report, fresh Vercel-pull, and launch-readiness doctor checks",
    "required"
  );
  check(
    "scripts: production doctor orchestration",
    productionDoctor.includes("verify-production-env.mjs") &&
      productionDoctor.includes("handleEnvStep") &&
      productionDoctor.includes("handleScoringStep") &&
      productionDoctor.includes("verify-scoring-rules.mjs") &&
      productionDoctor.includes("handleGithubSchedulerStep") &&
      productionDoctor.includes("verify-github-hourly-scheduler.mjs") &&
      productionDoctor.includes("handlePublicWebConfigStep") &&
      productionDoctor.includes("verify-public-web-config.mjs") &&
      productionDoctor.includes("skipAfterEnvFailure") &&
      productionDoctor.includes("skipAfterTargetFailure") &&
      productionDoctor.includes("Production env preflight failed; fix env values before live checks") &&
      productionDoctor.includes("Production doctor requires an external HTTPS target") &&
      productionDoctor.includes("Refusing localhost, .local, and http:// targets") &&
      productionDoctor.includes("else if (requireLaunchReady && !envOk)") &&
      productionDoctor.includes("verify-supabase-schema.mjs") &&
      productionDoctor.includes("verify-production-readiness.mjs") &&
      productionDoctor.includes("run-production-launch.mjs") &&
      productionDoctor.includes("handleSourcingDiagnosisStep") &&
      productionDoctor.includes("diagnose-sourcing-recovery.mjs") &&
      productionDoctor.includes("--skip-schema") &&
      productionDoctor.includes("No data work was started") &&
      productionDoctor.includes("Next command checklist") &&
      productionDoctor.includes("doctor:production:launch:fresh") &&
      productionDoctor.includes("deploy:production:launch -- confirm") &&
      productionDoctor.includes("deploy:production:go-live -- confirm") &&
      productionDoctor.includes("env:repair") &&
      productionDoctor.includes("loadEnvFiles") &&
      productionDoctor.includes('from "./load-env-files.mjs"') &&
      productionDoctor.includes("NEXT_PUBLIC_SUPABASE_URL") &&
      productionDoctor.includes("SUPABASE_SERVICE_ROLE_KEY"),
    "production doctor chains env preflight, external target guarding, scoring contract, GitHub hourly scheduler, public-web config, live schema, deployed readiness, first-launch preflight, sourcing diagnosis, and exact next commands without starting data work",
    "required"
  );
}

if (fileExists("scripts/verify-github-hourly-scheduler.mjs")) {
  const schedulerCheck = readText("scripts/verify-github-hourly-scheduler.mjs");
  const packageJson = readText("package.json");
  check(
    "scripts: GitHub hourly scheduler check command",
    packageJson.includes('"scheduler:check": "node scripts/verify-github-hourly-scheduler.mjs"') &&
      schedulerCheck.includes(".github") &&
      schedulerCheck.includes("returnpick-hourly.yml") &&
      schedulerCheck.includes('cron: "0 * * * *"') &&
      schedulerCheck.includes("RETURNPICK_CRON_SECRET") &&
      schedulerCheck.includes("RETURNPICK_SITE_URL") &&
      schedulerCheck.includes("/api/cron/sourcing") &&
      schedulerCheck.includes("/api/cron/affiliate-backfill") &&
      schedulerCheck.includes("/api/cron/telegram-digest?limit=1") &&
      schedulerCheck.includes("local scripts cannot read GitHub repository secrets"),
    "operators can verify the hourly GitHub Actions scheduler wiring without printing or requiring secret values",
    "required"
  );
}

if (fileExists("scripts/verify-scheduled-affiliate-backfill.mjs")) {
  const affiliateBackfillCheck = readText("scripts/verify-scheduled-affiliate-backfill.mjs");
  const packageJson = readText("package.json");
  check(
    "scripts: scheduled affiliate backfill check command",
    packageJson.includes('"affiliate-backfill:check": "node scripts/verify-scheduled-affiliate-backfill.mjs"') &&
      affiliateBackfillCheck.includes("isolated route") &&
      affiliateBackfillCheck.includes("hourly workflow order") &&
      affiliateBackfillCheck.includes("readiness probe"),
    "operators can verify the isolated product-level Partners link repair path without running a live backfill",
    "required"
  );
}

if (fileExists("sql/schema.sql")) {
  const schema = readText("sql/schema.sql");
  const schemaVersion = "2026-08-01-public-column-boundary";
  const apiReadinessSource = fileExists("lib/apiReadiness.ts") ? readText("lib/apiReadiness.ts") : "";
  check(
    "schema version marker",
    schema.includes("returnpick_schema_meta") && schema.includes(schemaVersion) && schema.includes("schema_version"),
    "schema.sql writes a launch-ready schema version marker for admin readiness",
    "required"
  );
  check(
    "schema/readiness version alignment",
    schema.includes(schemaVersion) && apiReadinessSource.includes(schemaVersion) && !apiReadinessSource.includes("2026-07-31-product-observation-time"),
    "Supabase SQL and deployed admin readiness use the same schema version marker",
    "required"
  );
  for (const table of [
    "sourcing_keywords",
    "sourced_products",
    "deal_scores",
    "sourcing_runs",
    "telegram_logs",
    "affiliate_events",
    "product_snapshots"
  ]) {
    check(`schema table: ${table}`, schema.includes(`create table if not exists ${table}`), table, "required");
  }
  check("schema event type: share_copy", schema.includes("'share_copy'"), "affiliate_events accepts share_copy", "required");
  check(
    "schema revenue surface attribution",
    schema.includes("context text") &&
      schema.includes("add column if not exists context text") &&
      schema.includes("affiliate_events_context_created_idx"),
    "affiliate funnel events retain an allowlisted content surface for editorial and approval CTA attribution",
    "required"
  );
  check("schema published RLS", schema.includes("Public can read published products"), "public can read only published products", "required");
  check(
    "schema public affiliate constraint",
    schema.includes("sourced_products_public_affiliate_url_check") &&
      schema.includes("not valid") &&
      schema.includes("is_strict_coupang_partners_url") &&
      schema.includes("link\\.coupang\\.com/a/[A-Za-z0-9]{6,16}") &&
      schema.includes("safecheck"),
    "database rejects new published products unless affiliate_url is a strict Coupang Partners short link",
    "required"
  );
  check(
    "schema public RLS affiliate-ready only",
    (schema.match(/is_strict_coupang_partners_url/g) ?? []).length >= 5 &&
      schema.includes("is_strict_coupang_partners_url(sourced_products.affiliate_url)"),
    "public product, score, and snapshot RLS policies expose only strict affiliate-ready published products",
    "required"
  );
  const publicProductGrant = schema.match(/grant select \(([\s\S]*?)\) on table sourced_products to anon, authenticated;/)?.[1] ?? "";
  const publicSnapshotGrant = schema.match(/grant select \(([\s\S]*?)\) on table product_snapshots to anon, authenticated;/)?.[1] ?? "";
  check(
    "schema public column boundary",
    schema.includes("revoke all on table") &&
      schema.includes("from anon, authenticated") &&
      publicProductGrant.includes("public_note") &&
      !publicProductGrant.includes("raw_json") &&
      !publicProductGrant.includes("admin_memo") &&
      !publicProductGrant.includes("rejection_reason") &&
      publicSnapshotGrant.includes("change_flags") &&
      !publicSnapshotGrant.includes("raw_json"),
    "anon and authenticated roles can read customer-facing fields only; provider payloads and admin notes remain service-role-only",
    "required"
  );
  check("schema keyword uniqueness", schema.includes("keyword_key") && schema.includes("sourcing_keywords_keyword_category_key"), "sourcing keywords are unique by normalized keyword and category", "required");
  check(
    "schema product observation time",
    schema.includes("last_observed_at timestamptz") &&
      schema.includes("add column if not exists last_observed_at timestamptz") &&
      !schema.includes("last_observed_at timestamptz default now()") &&
      schema.includes("sourced_products_published_observed_idx"),
    "automatic resourcing has a nullable first-class observation time without making legacy rows falsely fresh",
    "required"
  );
  const operationalIndexes = [
    "sourced_products_status_category_created_idx",
    "sourced_products_published_status_created_idx",
    "sourced_products_public_affiliate_ready_idx",
    "sourced_products_published_observed_idx",
    "sourcing_runs_started_idx",
    "sourcing_runs_status_started_idx",
    "telegram_logs_created_idx",
    "telegram_logs_product_created_idx",
    "telegram_logs_target_created_idx",
    "affiliate_events_created_idx",
    "affiliate_events_product_created_idx",
    "affiliate_events_type_created_idx",
    "affiliate_events_channel_created_idx",
    "affiliate_events_context_created_idx",
    "product_snapshots_product_observed_idx"
  ];
  check(
    "schema operational indexes",
    operationalIndexes.every((indexName) => schema.includes(indexName)),
    "schema.sql indexes public deal lists, admin queues, scheduler logs, Telegram logs, snapshots, and revenue funnel events",
    "required"
  );
}

if (fileExists("lib/sourcing.ts")) {
  const sourcing = readText("lib/sourcing.ts");
  check("sourcing: serverless time budget", sourcing.includes("time_budget_reached") && sourcing.includes("completed_partial"), "sourcing can finish partially before serverless timeout", "required");
  check("sourcing: keyword cursor log", sourcing.includes("keywordOffset") && sourcing.includes("next_keyword_offset"), "partial sourcing records the next keyword cursor", "required");
  check("sourcing: default keyword bootstrap", sourcing.includes("ensureDefaultSourcingKeywords") && sourcing.includes("default_keywords_seeded"), "first sourcing run seeds default keywords when the DB is empty", "required");
  check("sourcing: coupang deeplink enrichment", sourcing.includes("createCoupangDeeplink") && sourcing.includes("coupang_deeplink"), "creates affiliate_url from Coupang product URLs", "required");
  check("sourcing: naver lowest price enrichment", sourcing.includes("getLowestPrice") && sourcing.includes("naver_lowest_price"), "fills naver_lowest_price when API is configured", "required");
  check(
    "sourcing: bounded enrichment concurrency",
    sourcing.includes("SOURCING_ENRICHMENT_CONCURRENCY") &&
      sourcing.includes("defaultProductEnrichmentConcurrency = 2") &&
      sourcing.includes("maxProductEnrichmentConcurrency = 4") &&
      sourcing.includes("product_enrichment_concurrency: productEnrichmentConcurrency"),
    "product price/link enrichment keeps a safe default and a bounded operator-controlled concurrency limit",
    "required"
  );
  check(
    "sourcing: naver fallback query log",
    sourcing.includes("getLowestPriceFromQueries") &&
      sourcing.includes("naver_price_lookup") &&
      sourcing.includes("buildNaverRelevanceTokens") &&
      sourcing.includes("relevance_tokens") &&
      sourcing.includes("match: result.match ?? null"),
    "tries multiple Naver queries, filters by relevance, and stores lookup evidence",
    "required"
  );
  check("sourcing: provider status log", sourcing.includes("provider_status"), "stores provider status for first-run diagnostics", "required");
  check(
    "sourcing: provider meta log",
    sourcing.includes("provider_meta: result.meta ?? null") &&
      sourcing.includes("provider_meta: sourceResult.meta ?? null") &&
      sourcing.includes("provider_meta: webResult.meta ?? null"),
    "sourcing run logs retain safe provider metadata such as public-web diagnostics and API response-shape evidence",
    "required"
  );
  check(
    "sourcing: provider error fallback",
    sourcing.includes("recordProviderResult") &&
      sourcing.includes('sourceResult.status !== "error"') &&
      sourcing.includes('result.status === "error"') &&
      sourcing.includes("provider_issues") &&
      sourcing.includes("naver_shopping_candidate"),
    "sourcing logs provider errors and still tries allowed fallback sources for the keyword",
    "required"
  );
  check(
    "sourcing: public web is supplemental",
    sourcing.includes("const webResult = await searchPublicWebProducts") &&
      sourcing.includes("mergeProviderProductBatches") &&
      sourcing.includes('{ provider: "public_web", products: webResult.products }') &&
      sourcing.includes("merged_deduplicated_count") &&
      sourcing.includes("provider_contributions"),
    "robots-safe allowlisted public-web return candidates supplement successful official API searches instead of running only after zero results",
    "required"
  );
  check(
    "sourcing: public web only mode is review-only",
    sourcing.includes('sourceMode?: "auto" | "public_web_only"') &&
      sourcing.includes('sourceMode === "public_web_only"') &&
      sourcing.includes('source_mode: sourceMode') &&
      sourcing.includes("const useMockFallback = sourceMode === \"public_web_only\" ? false") &&
      sourcing.includes("PUBLIC_WEB_ONLY_MANUAL_REVIEW") &&
      sourcing.includes("allowAffiliateEnrichment: sourceMode !== \"public_web_only\""),
    "public-web-only runs avoid official/API and mock fallback paths and preserve an explicit run-mode audit field",
    "required"
  );
  check(
    "sourcing: product save counted when score save fails",
    sourcing.includes("scoreError") &&
      sourcing.includes("product_score_error") &&
      sourcing.includes("SOURCING_SCORE_SAVE_FAILED") &&
      (sourcing.includes("if (saved.inserted) insertedCount += 1") || sourcing.includes("if (enriched.saved.inserted) insertedCount += 1")) &&
      (sourcing.includes("else updatedCount += 1") || sourcing.includes("else updatedCount += 1;")),
    "a saved or updated candidate still counts as product progress even if later score creation fails",
    "required"
  );
}

if (fileExists("lib/sourcingDiagnostics.ts")) {
  const diagnostics = readText("lib/sourcingDiagnostics.ts");
  const packageJson = fileExists("package.json") ? readText("package.json") : "";
  const sourcingRecovery = fileExists("scripts/diagnose-sourcing-recovery.mjs") ? readText("scripts/diagnose-sourcing-recovery.mjs") : "";
  check(
    "sourcing diagnostics: first run guidance",
    diagnostics.includes("diagnoseSourcingRun") &&
      diagnostics.includes("rejectedByPriceFilterCount") &&
      diagnostics.includes("robotsUnavailableCount") &&
      diagnostics.includes("actionItems.push"),
    "admin can explain zero-result sourcing runs",
    "required"
  );
  check(
    "sourcing diagnostics: provider error summary",
    diagnostics.includes("providerErrorCount") &&
      diagnostics.includes("nonProviderErrorCount") &&
      diagnostics.includes("providerIssueProviders") &&
      diagnostics.includes("getProviderIssueProviders") &&
      diagnostics.includes("일부 공급원 오류, 후보 수집은 진행됨") &&
      diagnostics.includes("공급원 오류"),
    "admin sourcing diagnostics summarize provider errors separately and downgrades recovered provider-only failures to warning",
    "required"
  );
  check(
    "sourcing diagnostics: public web evidence summary",
    diagnostics.includes("getPublicWebDiagnostics") &&
      diagnostics.includes("publicWebDiagnosticCount") &&
      diagnostics.includes("publicWebDiagnosticStatuses") &&
      diagnostics.includes("public_web_diagnostics") &&
      diagnostics.includes("공개 웹 참고 수집 진단"),
    "admin sourcing diagnostics summarize public-web allowlist, robots, content, and extraction evidence from provider metadata",
    "required"
  );
  check(
    "scripts: sourcing recovery diagnosis command",
    packageJson.includes('"sourcing:diagnose": "node scripts/diagnose-sourcing-recovery.mjs"'),
    "package.json exposes a sourcing recovery diagnosis command for low/zero candidate first launches",
    "required"
  );
  check(
    "scripts: sourcing recovery diagnosis safety",
    sourcingRecovery.includes("ReturnPick sourcing recovery diagnosis") &&
      sourcingRecovery.includes("secret values: never printed") &&
      sourcingRecovery.includes("sourcing_keywords") &&
      sourcingRecovery.includes("sourcing_runs") &&
      sourcingRecovery.includes("sourced_products") &&
      sourcingRecovery.includes("SOURCING_KEYWORD_LIMIT") &&
      sourcingRecovery.includes("CRON_USE_MOCK_FALLBACK") &&
      sourcingRecovery.includes("PUBLIC_WEB_CRAWL_ENABLED") &&
      sourcingRecovery.includes("price filter impact") &&
      sourcingRecovery.includes("provider API_NOT_CONFIGURED") &&
      sourcingRecovery.includes("public deal visibility") &&
      sourcingRecovery.includes("public blockers") &&
      sourcingRecovery.includes("npm run env:vercel:launch") &&
      sourcingRecovery.includes("npm run schema:production") &&
      !sourcingRecovery.includes("console.log(serviceRoleKey)") &&
      !sourcingRecovery.includes("console.log(process.env"),
    "sourcing recovery diagnosis checks env mode, keyword coverage, recent provider logs, price-filter impact, and customer-visible product blockers without printing secrets",
    "required"
  );
  check(
    "scripts: sourcing recovery public visibility diagnosis",
    sourcingRecovery.includes("inspectProductVisibility") &&
      sourcingRecovery.includes("승인용 샘플 링크 사용 중") &&
      sourcingRecovery.includes("상품별 파트너스 링크 필요") &&
      sourcingRecovery.includes("반품가 확인 필요") &&
      sourcingRecovery.includes("반품등급 확인 필요") &&
      sourcingRecovery.includes("상품 이미지 확인 필요") &&
      sourcingRecovery.includes("네이버 최저가 대비 가격 불리") &&
      sourcingRecovery.includes("affiliate link repair queue") &&
      sourcingRecovery.includes("customer-visible published deal") &&
      sourcingRecovery.includes("실제 딜 게시 전 승인용 샘플 링크를 상품별 쿠팡 파트너스 링크로 교체하세요") &&
      !sourcingRecovery.includes("missing product Partners link"),
    "sourcing recovery diagnosis explains in readable Korean why collected or published products are still hidden from /deals and Telegram",
    "required"
  );
}

if (fileExists("lib/providers/coupangPartnersProvider.ts")) {
  const coupangProvider = readText("lib/providers/coupangPartnersProvider.ts");
  check("provider: coupang detailed errors", coupangProvider.includes("payloadErrorMessage") && coupangProvider.includes("COUPANG_HTTP_${response.status}:"), "Coupang provider surfaces safe API error details", "required");
  check("provider: coupang timeout", coupangProvider.includes("fetchWithTimeout") && coupangProvider.includes("AbortController"), "Coupang provider bounds API request time", "required");
  check(
    "provider: coupang trims env credentials",
    coupangProvider.includes("function envText") &&
      coupangProvider.includes("getCoupangCredentials") &&
      coupangProvider.includes('process.env[name]?.trim() ?? ""') &&
      coupangProvider.includes("const { accessKey, secretKey, partnerId } = getCoupangCredentials()") &&
      coupangProvider.includes("const { partnerId } = getCoupangCredentials()"),
    "Coupang provider trims copied Vercel env values before config checks, HMAC signing, and subId usage",
    "required"
  );
  check(
    "provider: coupang official HMAC path-query signing",
    coupangProvider.includes('pathWithQuery.split("?")') &&
      coupangProvider.includes("path + query") &&
      coupangProvider.includes("CEA algorithm=HmacSHA256,access-key="),
    "Coupang HMAC signing follows the official path+query message format without the literal question mark",
    "required"
  );
  check(
    "provider: coupang strict deeplink output",
    coupangProvider.includes("firstUsableAffiliateUrl") && coupangProvider.includes("COUPANG_DEEPLINK_NO_PARTNERS_URL"),
    "Coupang deeplink/search responses only populate affiliate_url with usable Partners links",
    "required"
  );
  check(
    "provider: coupang parse diagnostics",
    coupangProvider.includes("coupang_provider_parse") &&
      coupangProvider.includes("raw_product_count") &&
      coupangProvider.includes("array_path") &&
      coupangProvider.includes("product_url_field") &&
      coupangProvider.includes("data.productList") &&
      coupangProvider.includes("data.results"),
    "Coupang search candidates keep safe parse diagnostics so approval-stage API response shape issues can be debugged",
    "required"
  );
  check(
    "provider: coupang tolerant response fields",
    coupangProvider.includes("product_id") &&
      coupangProvider.includes("product_name") &&
      coupangProvider.includes("product_price") &&
      coupangProvider.includes("shorten_url") &&
      coupangProvider.includes("data.productData.products") &&
      coupangProvider.includes("replace(/[\\s,₩￦원]/g, \"\")"),
    "Coupang normalization accepts common snake_case response fields and formatted Korean prices without inventing missing values",
    "required"
  );
  check(
    "provider: coupang search meta diagnostics",
    coupangProvider.includes("response_array_path") &&
      coupangProvider.includes("normalized_product_count") &&
      coupangProvider.includes("searched_path_count") &&
      coupangProvider.includes("searched_paths"),
    "Coupang search results expose response-shape metadata even before candidates are saved",
    "required"
  );
}

if (fileExists("lib/providers/naverShoppingProvider.ts")) {
  const naverProvider = readText("lib/providers/naverShoppingProvider.ts");
  check("provider: naver detailed errors", naverProvider.includes("naverErrorMessage") && naverProvider.includes("NAVER_HTTP_${response.status}:"), "Naver provider surfaces safe API error details", "required");
  check("provider: naver timeout", naverProvider.includes("fetchWithTimeout") && naverProvider.includes("AbortController"), "Naver provider bounds API request time", "required");
  check(
    "provider: naver trims env credentials",
    naverProvider.includes("function envText") &&
      naverProvider.includes("getNaverCredentials") &&
      naverProvider.includes('process.env[name]?.trim() ?? ""') &&
      naverProvider.includes("const { clientId, clientSecret } = getNaverCredentials()") &&
      naverProvider.includes('"X-Naver-Client-Id": clientId') &&
      naverProvider.includes('"X-Naver-Client-Secret": clientSecret'),
    "Naver provider trims copied Vercel env values before config checks and request headers",
    "required"
  );
  check(
    "provider: naver search meta diagnostics",
    naverProvider.includes("NaverShoppingSearchResult") &&
      naverProvider.includes("api_total") &&
      naverProvider.includes("raw_item_count") &&
      naverProvider.includes("normalized_item_count") &&
      naverProvider.includes("priced_item_count"),
    "Naver search results expose response and price-field metadata for first-launch diagnostics",
    "required"
  );
  check(
    "provider: naver lowest price SKU guard",
    naverProvider.includes("NaverLowestPriceOptions") &&
      naverProvider.includes("relevanceTokens") &&
      naverProvider.includes("itemRelevance") &&
      naverProvider.includes("minRelevance") &&
      naverProvider.includes("matchNaverProductSku") &&
      naverProvider.includes("shouldPreferNaverSkuCandidate") &&
      naverProvider.includes("sku_rejection_reasons") &&
      naverProvider.includes("rejected_by_relevance_count") &&
      naverProvider.includes("matched_tokens"),
    "Naver lowest-price selection ranks verified same-SKU results before price and records rejection evidence",
    "required"
  );
}

if (fileExists("lib/providers/publicWebProvider.ts")) {
  const publicWebProvider = readText("lib/providers/publicWebProvider.ts");
  const publicWebUrlSafety = fileExists("lib/publicWebUrlSafety.ts") ? readText("lib/publicWebUrlSafety.ts") : "";
  const packageJson = fileExists("package.json") ? readText("package.json") : "";
  const publicWebConfigVerifier = fileExists("scripts/verify-public-web-config.mjs") ? readText("scripts/verify-public-web-config.mjs") : "";
  const publicWebUrlVerifier = fileExists("scripts/verify-public-web-url-safety.mjs") ? readText("scripts/verify-public-web-url-safety.mjs") : "";
  const webReturnInfo = fileExists("lib/webReturnInfo.ts") ? readText("lib/webReturnInfo.ts") : "";
  const webReturnInfoVerifier = fileExists("scripts/verify-web-return-info.mjs") ? readText("scripts/verify-web-return-info.mjs") : "";
  check(
    "provider: public web robots fail closed",
    publicWebProvider.includes("ROBOTS_UNAVAILABLE") &&
      publicWebProvider.includes("ROBOTS_TXT_NOT_FOUND") &&
      publicWebProvider.includes('if (!robots) return false') &&
      publicWebProvider.includes("safeTemplateUrl"),
    "public web collection requires an allowlisted http(s) URL and readable robots.txt before fetching pages",
    "required"
  );
  check(
    "provider: public web identifiable user agent",
    publicWebProvider.includes("getSiteUrl") &&
      publicWebProvider.includes("/disclosure") &&
      publicWebProvider.includes("ReturnPickBot/0.1") &&
      !publicWebProvider.includes("admin@returnpick.local"),
    "public web requests identify ReturnPick with a disclosure URL instead of a local placeholder contact",
    "required"
  );
  check(
    "provider: public web content bounds",
    publicWebProvider.includes("MAX_PUBLIC_WEB_HTML_BYTES") &&
      publicWebProvider.includes("MAX_ROBOTS_BYTES") &&
      publicWebProvider.includes("readTextWithLimit") &&
      publicWebProvider.includes("UNSUPPORTED_CONTENT_TYPE") &&
      publicWebProvider.includes("CONTENT_TOO_LARGE") &&
      publicWebProvider.includes("isPublicWebHostname"),
    "public web collection reads only public-host HTML responses within bounded byte limits",
    "required"
  );
  check(
    "provider: public web extracted href safety",
    publicWebProvider.includes("safeAllowlistedPublicUrl") &&
      publicWebProvider.includes("extractCards(html, category, keyword, url, hosts)") &&
      publicWebUrlSafety.includes('!["http:", "https:"].includes(url.protocol)') &&
      publicWebUrlSafety.includes("url.username || url.password") &&
      publicWebUrlSafety.includes("!allowedHosts.has(hostname)"),
    "public web collection stores only http(s) anchor URLs whose exact host remains inside the reviewed allowlist",
    "required"
  );
  check(
    "scripts: public web extracted URL safety check",
    packageJson.includes('"public-web-url:check": "node --disable-warning=ExperimentalWarning --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types scripts/verify-public-web-url-safety.mjs"') &&
      publicWebUrlVerifier.includes("off-allowlist host") &&
      publicWebUrlVerifier.includes("unlisted subdomain") &&
      publicWebUrlVerifier.includes("credential-bearing URL") &&
      publicWebUrlVerifier.includes("loopback URL"),
    "deterministic checks cover accepted allowlisted URLs and rejected cross-host, subdomain, credential, scheme, and loopback boundaries",
    "required"
  );
  check(
    "provider: public web redirect fail closed",
    publicWebProvider.includes('redirect: "manual"') &&
      publicWebProvider.includes("REDIRECT_BLOCKED") &&
      publicWebProvider.includes("safeRedirectTarget") &&
      publicWebProvider.includes("response.status >= 300 && response.status < 400"),
    "public web collection does not follow redirects before allowlist and robots checks",
    "required"
  );
  check(
    "provider: public web crawl-delay guard",
    publicWebProvider.includes("parseCrawlDelaySeconds") &&
      publicWebProvider.includes("crawlDelaySecondsForRobots") &&
      publicWebProvider.includes("waitForOriginRateLimit") &&
      publicWebProvider.includes("MAX_SUPPORTED_CRAWL_DELAY_SECONDS") &&
      publicWebProvider.includes("CRAWL_DELAY_TOO_HIGH"),
    "public web collection respects robots Crawl-delay and skips hosts whose delay is too large for serverless sourcing",
    "required"
  );
  check(
    "provider: public web config bounds",
    publicWebProvider.includes("MAX_PUBLIC_WEB_ALLOWED_HOSTS") &&
      publicWebProvider.includes("MAX_PUBLIC_WEB_SEARCH_TEMPLATES") &&
      publicWebProvider.includes("PUBLIC_WEB_CONFIG_TOO_BROAD") &&
      publicWebProvider.includes('status: "INVALID_TEMPLATE"') &&
      publicWebProvider.includes('if (!template.includes("{keyword}")) return null'),
    "public web collection refuses overly broad host or search template lists and requires keyword-scoped templates before fetching",
    "required"
  );
  check(
    "provider: public web config fails closed",
    publicWebProvider.includes("invalidHost") &&
      publicWebProvider.includes("invalidTemplate") &&
      publicWebProvider.includes("PUBLIC_WEB_CONFIG_INVALID_BEFORE_FETCH") &&
      publicWebProvider.includes('safeTemplateUrl(template, "returnpick-test")'),
    "public web collection validates every configured host and template before making the first network request",
    "required"
  );
  check(
    "provider: public web diagnostic metadata",
    publicWebProvider.includes("buildPublicWebMeta") &&
      publicWebProvider.includes("public_web_diagnostics") &&
      publicWebProvider.includes("public_web_diagnostic_count") &&
      publicWebProvider.includes('status: "FETCHED_HTML"') &&
      publicWebProvider.includes("extracted_count") &&
      publicWebProvider.includes("crawl_delay_seconds") &&
      publicWebProvider.includes("content_type"),
    "public web collection records bounded safe diagnostics for allowlist, robots, content, redirect, and extraction outcomes",
    "required"
  );
  check(
    "provider: public web bounded detail enrichment",
    publicWebProvider.includes("MAX_PUBLIC_WEB_DETAIL_PAGES = 3") &&
      publicWebProvider.includes("enrichProductDetails") &&
      publicWebProvider.includes('stage: "detail"') &&
      publicWebProvider.includes('status: "FETCHED_DETAIL"') &&
      publicWebProvider.includes("readMetaContent") &&
      publicWebProvider.includes("readHtmlTitle") &&
      publicWebProvider.includes("detail_page_fetched_count") &&
      publicWebProvider.includes("safeAllowlistedPublicUrl") &&
      publicWebProvider.includes("isPathAllowedByRobots") &&
      publicWebProvider.includes("waitForOriginRateLimit") &&
      publicWebProvider.includes("readTextWithLimit"),
    "public web collection may enrich at most three discovered product pages while reapplying allowlist, robots, redirect, delay, and byte limits",
    "required"
  );
  check(
    "scripts: public web detail enrichment contract",
    packageJson.includes('"public-web-detail:check": "node scripts/verify-public-web-detail-enrichment.mjs"') &&
      publicWebProvider.includes("detail_page") &&
      publicWebProvider.includes("web_return_info") &&
      fileExists("scripts/verify-public-web-detail-enrichment.mjs"),
    "detail-page return evidence and bounded enrichment are covered by a deterministic source contract check",
    "required"
  );
  check(
    "scripts: web return evidence merge contract",
    packageJson.includes('"web-return:check": "node --disable-warning=ExperimentalWarning --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types scripts/verify-web-return-info.mjs"') &&
      webReturnInfo.includes("resolveConditionGrade") &&
      webReturnInfo.includes("resolveWebReturnEvidence") &&
      webReturnInfo.includes("weakConditionGrades") &&
      webReturnInfo.includes("parseReturnPrice") &&
      webReturnInfo.includes("moneyPattern") &&
      webReturnInfoVerifier.includes("no inferred return price") &&
      webReturnInfoVerifier.includes("regularPriceOnly") &&
      webReturnInfoVerifier.includes('resolveConditionGrade("확인필요", "최상")'),
    "web return evidence fills only weak condition grades and accepts prices only when explicitly tied to a return label or grade",
    "required"
  );
  check(
    "scripts: public web config check command",
    packageJson.includes('"public-web:check": "node scripts/verify-public-web-config.mjs"'),
    "package.json exposes a public-web allowlist and robots preflight",
    "required"
  );
  check(
    "scripts: public web config check safety",
    publicWebConfigVerifier.includes("ReturnPick public web collection check") &&
      publicWebConfigVerifier.includes("PUBLIC_WEB_CRAWL_ENABLED") &&
      publicWebConfigVerifier.includes("PUBLIC_WEB_ALLOWED_HOSTS") &&
      publicWebConfigVerifier.includes("PUBLIC_WEB_SEARCH_TEMPLATES") &&
      publicWebConfigVerifier.includes("robots.txt not found; ReturnPick treats this as not allowed") &&
      publicWebConfigVerifier.includes("redirect blocked") &&
      publicWebConfigVerifier.includes("Crawl-delay") &&
      publicWebConfigVerifier.includes("MAX_ROBOTS_BYTES") &&
      publicWebConfigVerifier.includes("readTextWithLimit") &&
      publicWebConfigVerifier.includes("robots.txt too large") &&
      publicWebConfigVerifier.includes("ReturnPickBot/0.1") &&
      publicWebConfigVerifier.includes("No public web requests were made") &&
      !publicWebConfigVerifier.includes("process.env.COUPANG") &&
      !publicWebConfigVerifier.includes("process.env.NAVER") &&
      !publicWebConfigVerifier.includes("process.env.SUPABASE"),
    "public web config check validates allowlist, templates, robots, and Crawl-delay without reading unrelated secrets",
    "required"
  );
}

if (fileExists("lib/coupangLink.ts")) {
  const coupangLink = readText("lib/coupangLink.ts");
  check(
    "affiliate links: partners link only",
    coupangLink.includes("isCoupangPartnersLink") &&
      coupangLink.includes("partnerShortPathPattern") &&
      coupangLink.includes("suspiciousPartnerCodePattern") &&
      coupangLink.includes('url.hostname !== "link.coupang.com"') &&
      coupangLink.includes("PARTNERS_LINK_CREDENTIALS_NOT_ALLOWED") &&
      coupangLink.includes("PARTNERS_LINK_DEFAULT_PORT_REQUIRED") &&
      coupangLink.includes("isApprovalSampleAffiliateUrl") &&
      coupangLink.includes("!isApprovalSampleAffiliateUrl(value)") &&
      !coupangLink.includes('return url.hostname === "link.coupang.com" || isUsableCoupangProductUrl(value)'),
    "affiliate_url requires a strict product-level Coupang Partners short link, not a regular product URL, approval sample link, or obvious test code",
    "required"
  );
}

if (
  fileExists("lib/coupangAffiliateLinkVerifier.ts") &&
  fileExists("lib/affiliateIdentity.ts") &&
  fileExists("app/api/admin/affiliate-links/verify/route.ts") &&
  fileExists("components/AdminAffiliateLinkQueue.tsx") &&
  fileExists("lib/quality.ts") &&
  fileExists("app/api/admin/products/[id]/route.ts") &&
  fileExists("app/api/admin/affiliate-links/import/route.ts")
) {
  const verifier = readText("lib/coupangAffiliateLinkVerifier.ts");
  const identity = readText("lib/affiliateIdentity.ts");
  const verifyRoute = readText("app/api/admin/affiliate-links/verify/route.ts");
  const linkQueue = readText("components/AdminAffiliateLinkQueue.tsx");
  const quality = readText("lib/quality.ts");
  const productRoute = readText("app/api/admin/products/[id]/route.ts");
  const affiliateImportRoute = readText("app/api/admin/affiliate-links/import/route.ts");
  check(
    "affiliate link verification: bounded Coupang-only resolution",
    verifier.includes('import "server-only"') &&
      verifier.includes("MAX_REDIRECTS = 3") &&
      verifier.includes("TOTAL_TIMEOUT_MS = 8_000") &&
      verifier.includes('redirect: "manual"') &&
      verifier.includes('method: "GET"') &&
      verifier.includes('Range: "bytes=0-0"') &&
      verifier.includes('credentials: "omit"') &&
      verifier.includes("AbortController") &&
      verifier.includes("response.body?.cancel()") &&
      verifier.includes('url.hostname === "coupang.com" || url.hostname.endsWith(".coupang.com")') &&
      verifier.includes("url.port || url.username || url.password") &&
      verifier.includes("RESOLVED_PRODUCT_ACCESS_LIMITED") &&
      verifier.includes("SHORT_LINK_ACCESS_LIMITED") &&
      verifier.includes("REDIRECT_BLOCKED"),
    "admin link checks follow only bounded HTTPS Coupang redirects, request no more than a byte before cancelling response bodies, and tolerate upstream access limits",
    "required"
  );
  check(
    "affiliate link verification: protected product-aware endpoint",
    verifyRoute.includes("requireAdmin(request)") &&
      verifyRoute.includes("MAX_PAYLOAD_BYTES") &&
      verifyRoute.includes("new TextEncoder().encode(rawBody).byteLength") &&
      verifyRoute.includes("verifyCoupangAffiliateLinkResolution") &&
      verifyRoute.includes("getProductById(productId)") &&
      verifyRoute.includes("assessAffiliateIdentity") &&
      verifyRoute.includes("mergeAffiliateIdentityRecord") &&
      verifyRoute.includes("AUTOMATIC_CHECK_REQUIRED") &&
      verifyRoute.includes("AFFILIATE_TARGET_MISMATCH") &&
      verifyRoute.includes("manual_confirm") &&
      verifyRoute.includes('"Cache-Control": "no-store"') &&
      linkQueue.includes('/api/admin/affiliate-links/verify') &&
      linkQueue.includes("자동 목적지 확인") &&
      linkQueue.includes("브라우저로 직접 열기") &&
      linkQueue.includes("브라우저 확인 완료") &&
      linkQueue.includes("후보 상품번호") &&
      linkQueue.includes("getAffiliateIdentityReadiness(product).ready") &&
      linkQueue.includes("getCustomerPublishReadiness(product).ready") &&
      linkQueue.includes('rel="nofollow sponsored noopener noreferrer"') &&
      linkQueue.includes("linkVerifications") &&
      linkQueue.includes("affiliateUrlOverride") &&
      linkQueue.includes('await verifyAffiliateUrl(product, "verify", affiliateUrl)') &&
      linkQueue.includes("링크는 저장했지만 목적지 확인이 추가로 필요합니다.") &&
      linkQueue.includes("MAX_BULK_LINK_CHECKS") &&
      linkQueue.includes("verifyVisibleAffiliateLinks") &&
      linkQueue.includes("자동 확인") &&
      linkQueue.includes("상품 일치") &&
      linkQueue.includes("수동 확인 필요"),
    "authenticated admins compare one pasted link with the server-loaded candidate, retain unverified links in the queue, and can explicitly confirm only unresolved destinations",
    "required"
  );
  check(
    "affiliate link verification: central publish identity gate",
    identity.includes("getExpectedCoupangProductIdentity") &&
      identity.includes("readAffiliateIdentityRecord") &&
      identity.includes("record.affiliate_url !== affiliateUrl") &&
      identity.includes("record.expected_product_id !== expected.productId") &&
      identity.includes("record.resolved_product_id !== expected.productId") &&
      quality.includes("getAffiliateIdentityReadiness") &&
      quality.includes("affiliateIdentity.blocker") &&
      productRoute.includes("AFFILIATE_TARGET_MISMATCH") &&
      affiliateImportRoute.includes("AFFILIATE_TARGET_MISMATCH") &&
      affiliateImportRoute.includes("getCustomerPublishReadiness"),
    "single and bulk publish paths reject changed or mismatched affiliate destinations through the shared customer-ready gate",
    "required"
  );
}

if (fileExists("app/api/events/route.ts")) {
  const eventsRoute = readText("app/api/events/route.ts");
  check(
    "events api: referrer privacy",
    eventsRoute.includes("cleanReferrer") &&
      eventsRoute.includes("url.origin") &&
      eventsRoute.includes("url.pathname") &&
      eventsRoute.includes("raw.split(/[?#]/)") &&
      eventsRoute.includes("cleanReferrer(request.headers.get(\"referer\"))"),
    "affiliate event tracking stores referrer origin/path only and strips query strings or hashes",
    "required"
  );
  check(
    "events api: tracking field privacy",
    eventsRoute.includes("cleanTrackingLabel") &&
      eventsRoute.includes("cleanAnonSessionId") &&
      eventsRoute.includes("EVENT_PAYLOAD_TOO_LARGE") &&
      eventsRoute.includes("cleanTrackingLabel(body.channel, \"web\")") &&
      eventsRoute.includes("cleanTrackingLabel(body.context)") &&
      eventsRoute.includes("cleanTrackingLabel(body.utm_source)"),
    "affiliate event tracking accepts only safe label fields, including content surface attribution, UUID anon sessions, and bounded payloads",
    "required"
  );
  check(
    "events api: public-ready product gate",
    eventsRoute.includes("getProductById") &&
      eventsRoute.includes("isPublicDealVisible") &&
      eventsRoute.includes("PRODUCT_ID_REQUIRED") &&
      eventsRoute.includes("PRODUCT_NOT_PUBLIC_READY") &&
      eventsRoute.includes("product_id: productId"),
    "affiliate event tracking stores events only for published affiliate-ready products",
    "required"
  );
}

if (fileExists("lib/dataStore.ts")) {
  const dataStore = readText("lib/dataStore.ts");
  check(
    "revenue metrics: editorial surface attribution",
    dataStore.includes("context: safeEventText(input.context, 80)") &&
      dataStore.includes("const surfaceMetrics =") &&
      dataStore.includes("surfaceMetrics,"),
    "admin revenue metrics group approval and editorial events even when no sourced product row exists",
    "required"
  );
}

if (fileExists("app/api/products/compare/route.ts")) {
  const compareRoute = readText("app/api/products/compare/route.ts");
  check(
    "compare api: safe public fallback",
    compareRoute.includes("COMPARE_PRODUCTS_FAILED") &&
      compareRoute.includes("compareProductsErrorResponse") &&
      compareRoute.includes("products: []") &&
      compareRoute.includes("isPublicDealVisible"),
    "public compare API returns an empty safe payload on lookup failures and exposes only public affiliate-ready deals",
    "required"
  );
}

if (fileExists("lib/clientTracking.ts")) {
  const clientTracking = readText("lib/clientTracking.ts");
  check(
    "client tracking: non-blocking purchase clicks",
    clientTracking.includes("Tracking storage is best-effort") &&
      clientTracking.includes("A failed tracker must never block navigation to Coupang") &&
      clientTracking.includes("getStoredJsonArray") &&
      clientTracking.includes("setStoredJsonArray") &&
      clientTracking.includes("sendBeacon") &&
      clientTracking.includes("sendEventWithFetch") &&
      clientTracking.includes("if (queued) return") &&
      clientTracking.includes(".catch(() => undefined)"),
    "client-side analytics failures cannot interrupt Coupang outbound clicks or page views",
    "required"
  );
}

if (
  fileExists("components/ApprovalCoupangButton.tsx") &&
  fileExists("app/api/events/route.ts") &&
  fileExists("components/AdminOpsDashboard.tsx")
) {
  const approvalButton = readText("components/ApprovalCoupangButton.tsx");
  const eventRoute = readText("app/api/events/route.ts");
  const opsDashboard = readText("components/AdminOpsDashboard.tsx");
  check(
    "approval sample: measured explicit affiliate click",
    approvalButton.includes("trackAffiliateEvent") &&
      approvalButton.includes('channel = "web_approval_sample"') &&
      approvalButton.includes('context = "approval_sample"') &&
      eventRoute.includes("isManualAffiliateTrackingRequest") &&
      eventRoute.includes('detailViewChannels: ["web_approval_sample_detail"]') &&
      readText("components/AffiliateEventTracker.tsx").includes("ApprovalSampleViewTracker") &&
      readText("app/products/approval-sample/page.tsx").includes("ApprovalSampleViewTracker") &&
      eventRoute.includes("NEXT_PUBLIC_COUPANG_APPROVAL_PRODUCT_URL") &&
      eventRoute.includes('fetchSite !== "same-origin"') &&
      eventRoute.includes("referrerUrl.origin !== getPublicRequestOrigin(request)") &&
      eventRoute.includes('request.headers.get("origin")') &&
      eventRoute.includes('pathname: "/products/approval-sample"') &&
      opsDashboard.includes('web_approval_sample: "직접 검수 추천 CTA"'),
    "the manual approval product records only explicit same-page affiliate clicks and exposes the channel in admin metrics",
    "required"
  );
}

if (
  fileExists("app/picks/novatech-s1-window-cleaner/page.tsx") &&
  fileExists("app/api/events/route.ts") &&
  fileExists("components/AffiliateEventTracker.tsx") &&
  fileExists("components/EditorialShareBar.tsx") &&
  fileExists("app/picks/novatech-s1-window-cleaner/opengraph-image.tsx") &&
  fileExists("app/picks/novatech-s1-window-cleaner/twitter-image.tsx") &&
  fileExists("app/sitemap.ts")
) {
  const editorialPickPage = readText("app/picks/novatech-s1-window-cleaner/page.tsx");
  const eventRoute = readText("app/api/events/route.ts");
  const eventTracker = readText("components/AffiliateEventTracker.tsx");
  const editorialShareBar = readText("components/EditorialShareBar.tsx");
  const editorialOpenGraphImage = readText("app/picks/novatech-s1-window-cleaner/opengraph-image.tsx");
  const editorialTwitterImage = readText("app/picks/novatech-s1-window-cleaner/twitter-image.tsx");
  const sitemap = readText("app/sitemap.ts");
  const approvalData = readText("lib/approvalSample.ts");
  check(
    "editorial pick: indexable verified product funnel",
    editorialPickPage.includes('title: "Novatech S1 창문 로봇청소기 구매 전 체크"') &&
      editorialPickPage.includes('robots: {') &&
      editorialPickPage.includes('index: true') &&
      editorialPickPage.includes('"@type": "Product"') &&
      editorialPickPage.includes('"@type": "FAQPage"') &&
      editorialPickPage.includes("approvalSampleProduct.coupangProductNumber") &&
      editorialPickPage.includes('value: "쿠팡에서 실시간 확인"') &&
      editorialPickPage.includes("이 포스팅은 쿠팡 파트너스 활동의 일환으로") &&
      editorialPickPage.includes('context="editorial_pick"') &&
      !editorialPickPage.includes('"offers"') &&
      !editorialPickPage.includes("priceCurrency") &&
      !editorialPickPage.includes("https://schema.org/InStock") &&
      approvalData.includes('detailPath: "/picks/novatech-s1-window-cleaner"'),
    "the customer-facing manual pick is indexable, disclosed, and contains no invented offer, price, stock, or availability data",
    "required"
  );
  check(
    "editorial pick: bounded product-less attribution",
    eventRoute.includes('context: "editorial_pick"') &&
      eventRoute.includes('pathname: "/picks/novatech-s1-window-cleaner"') &&
      eventRoute.includes('affiliateClickChannels: ["web_editorial_pick", "telegram_editorial_pick"]') &&
      eventRoute.includes('telegramDetailChannels: ["telegram_editorial_pick"]') &&
      eventRoute.includes('shareCopyChannels: ["web_editorial_share"]') &&
      eventRoute.includes('request.headers.get("x-forwarded-host")') &&
      eventRoute.includes('request.headers.get("origin")') &&
      eventRoute.includes("getPublicRequestOrigin(request)") &&
      eventRoute.includes("allowedChannels.includes(channel)") &&
      eventTracker.includes("EditorialPickViewTracker") &&
      eventTracker.includes('context: "editorial_pick"') &&
      eventTracker.includes('channel: isTelegramLanding ? "telegram_editorial_pick" : "web_editorial_pick"'),
    "only the allowlisted editorial path can record product-less views and explicit web or Telegram affiliate clicks",
    "required"
  );
  check(
    "editorial pick: disclosed detail sharing",
    editorialPickPage.includes("EditorialShareBar") &&
      editorialShareBar.includes('utm_source", "customer_share"') &&
      editorialShareBar.includes('utm_medium", "referral"') &&
      editorialShareBar.includes('channel: "web_editorial_share"') &&
      editorialShareBar.includes('eventType: "share_copy"') &&
      editorialShareBar.includes('context: "editorial_pick"') &&
      editorialShareBar.includes("navigator.share") &&
      editorialShareBar.includes("추천 링크 공유") &&
      !editorialShareBar.includes("link.coupang.com"),
    "customers can share the disclosed ReturnPick detail with attribution without exposing or auto-opening the affiliate destination",
    "required"
  );
  check(
    "editorial pick: disclosed social preview",
    editorialPickPage.includes('const socialImageUrl = `${canonicalUrl}/opengraph-image`') &&
      editorialPickPage.includes('const twitterImageUrl = `${canonicalUrl}/twitter-image`') &&
      editorialPickPage.includes("쿠팡 파트너스 제휴 링크가 포함된 직접 검수 콘텐츠입니다") &&
      editorialOpenGraphImage.includes('size = { width: 1200, height: 630 }') &&
      editorialOpenGraphImage.includes('runtime = "nodejs"') &&
      editorialOpenGraphImage.includes('import sharp from "sharp"') &&
      editorialOpenGraphImage.includes(".png().toBuffer()") &&
      editorialOpenGraphImage.includes("approvalSampleProduct.imageSrc") &&
      editorialOpenGraphImage.includes("직접 검수 추천") &&
      editorialOpenGraphImage.includes("제휴 링크 포함") &&
      editorialOpenGraphImage.includes("제품 사용 연출 이미지") &&
      editorialOpenGraphImage.includes("가격·재고 실시간 확인") &&
      editorialTwitterImage.includes('import OpenGraphImage from "./opengraph-image"') &&
      !editorialOpenGraphImage.includes("link.coupang.com"),
    "shared links use a product-specific 1200x630 preview with visible editorial and affiliate context but no direct affiliate destination",
    "required"
  );
  check(
    "editorial pick: sitemap separates customer and review pages",
    sitemap.includes('/picks/novatech-s1-window-cleaner') && !sitemap.includes('/products/approval-sample'),
    "the indexable customer page is discoverable while the noindex Coupang review page stays out of the sitemap",
    "required"
  );
}

if (
  fileExists("components/ApprovalSampleCard.tsx") &&
  fileExists("components/AffiliateEventTracker.tsx") &&
  fileExists("lib/approvalSample.ts") &&
  fileExists("app/products/approval-sample/page.tsx") &&
  fileExists("app/api/events/route.ts") &&
  fileExists("components/PurposeDealExplorer.tsx") &&
  fileExists("lib/homeDiscovery.ts") &&
  fileExists("app/page.tsx") &&
  fileExists("app/deals/page.tsx")
) {
  const approvalCard = readText("components/ApprovalSampleCard.tsx");
  const eventTracker = readText("components/AffiliateEventTracker.tsx");
  const approvalData = readText("lib/approvalSample.ts");
  const approvalPage = readText("app/products/approval-sample/page.tsx");
  const eventRoute = readText("app/api/events/route.ts");
  const purposeExplorer = readText("components/PurposeDealExplorer.tsx");
  const homeDiscovery = readText("lib/homeDiscovery.ts");
  const homePage = readText("app/page.tsx");
  const dealsPage = readText("app/deals/page.tsx");
  check(
    "approval sample: customer-ready visual without invented commerce data",
    approvalCard.includes("next/image") &&
      approvalCard.includes("연출 이미지") &&
      approvalCard.includes("쿠팡 파트너스 활동") &&
      approvalData.includes("window-cleaning-robot-editorial.webp") &&
      approvalData.includes("9204971165 - 27182792409") &&
      approvalPage.includes("approvalSampleProduct.imageNotice") &&
      approvalPage.includes("isCoupangPartnersLink") &&
      approvalPage.includes("approvalUrlReady") &&
      approvalPage.includes("공개 페이지: {captureUrl}") &&
      approvalPage.includes("<h1 className=\"mt-1 text-2xl font-black tracking-tight\">{productName}</h1>") &&
      approvalPage.includes("sku: approvalSampleProduct.coupangProductNumber") &&
      !approvalPage.includes("https://schema.org/InStock"),
    "the manual approval product uses a disclosed editorial image and does not invent price, stock, or availability",
    "required"
  );
  check(
    "editorial pick: measured card impressions",
    approvalCard.includes("EditorialPickImpressionTracker") &&
      approvalCard.includes('placement: "home" | "deals" | "picks"') &&
      eventTracker.includes("returnpick_impressed_editorial_surfaces") &&
      eventTracker.includes('eventType: "impression"') &&
      eventTracker.includes('context: "editorial_home_card"') &&
      eventTracker.includes('context: "editorial_deals_card"') &&
      eventTracker.includes('context: "editorial_picks_card"') &&
      eventTracker.includes('channel: "web_editorial_card_home"') &&
      eventTracker.includes('channel: "web_editorial_card_deals"') &&
      eventTracker.includes('channel: "web_editorial_card_picks"') &&
      eventRoute.includes('pathname: "/"') &&
      eventRoute.includes('impressionChannels: ["web_editorial_card_home"]') &&
      eventRoute.includes('pathname: "/deals"') &&
      eventRoute.includes('impressionChannels: ["web_editorial_card_deals"]') &&
      eventRoute.includes('pathname: "/picks"') &&
      eventRoute.includes('impressionChannels: ["web_editorial_card_picks"]') &&
      eventRoute.includes('body.event_type === "impression"') &&
      homePage.includes('<ApprovalSampleCard placement="home" />') &&
      dealsPage.includes('<ApprovalSampleCard placement="deals" />') &&
      approvalCard.includes('placement: "home" | "deals" | "picks"'),
    "the home and deals fallback cards record one session-safe impression through exact path and channel allowlists",
    "required"
  );
  check(
    "editorial pick: card purchase CTA is disclosed and tracked",
    approvalCard.includes("ApprovalCoupangButton") &&
      approvalCard.includes('label="쿠팡에서 가격 확인"') &&
      approvalCard.includes("쿠팡 파트너스 활동의 일환으로") &&
      approvalCard.includes('href=\"/disclosure\"') &&
      approvalCard.includes("web_editorial_card_home") &&
      approvalCard.includes("web_editorial_card_deals") &&
      approvalCard.includes("web_editorial_card_picks") &&
      eventRoute.includes('affiliateClickChannels: ["web_editorial_card_home"]') &&
      eventRoute.includes('affiliateClickChannels: ["web_editorial_card_deals"]') &&
      eventRoute.includes('affiliateClickChannels: ["web_editorial_card_picks"]'),
    "the verified editorial card exposes an explicit affiliate CTA with disclosure and records clicks only on its exact public surface",
    "required"
  );
  check(
    "home discovery: search and use-case entry points",
    homePage.includes('form action="/deals"') &&
      homePage.includes('name="search"') &&
      homePage.includes('placeholder="상품명·브랜드·모델명 검색"') &&
      homePage.includes("getUseCaseMatches") &&
      homePage.includes("homePurposeOptions") &&
      homePage.includes("<PurposeDealExplorer") &&
      purposeExplorer.includes('role="tablist"') &&
      purposeExplorer.includes('role="tabpanel"') &&
      purposeExplorer.includes("aria-selected={selectedTab}") &&
      purposeExplorer.includes('/deals?useCase=${selected.primaryUseCaseId}&sort=fit') &&
      homePage.includes("fitScore") &&
      purposeExplorer.includes("자동 수집 후보가 관리자 검수와 상품별 파트너스 링크 확인을 통과하면") &&
      homePage.includes("approvalSampleProduct.detailPath"),
    "the homepage supports product search, keyboard-accessible purpose tabs, matched-deal comparison, and an honest editorial fallback before inventory exists",
    "required"
  );
  check(
    "home discovery: useful category and purpose guidance before inventory",
    ["laptop", "monitor", "robot_vacuum", "cordless_vacuum", "air_purifier", "dehumidifier"].every((category) => homeDiscovery.includes(`${category}: {`)) &&
      ["study_work", "gaming_creator", "cleaning", "air_season", "value"].every((purpose) => homeDiscovery.includes(`id: "${purpose}"`)) &&
      homePage.includes("카테고리부터 골라보세요") &&
      homePage.includes("상품이 없어도 카테고리별 반품 구매 기준을 먼저 확인할 수 있습니다") &&
      homePage.includes('grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6') &&
      purposeExplorer.includes("상품 수를 채우기 위해 미확인 딜을 먼저 보여주지 않습니다") &&
      !purposeExplorer.includes("/redirect?") &&
      !purposeExplorer.includes("window.location"),
    "zero inventory still provides category-specific checks and purpose guidance without invented products or automatic affiliate redirects",
    "required"
  );
  check(
    "public funnel: zero inventory prioritizes the verified editorial pick",
    homePage.includes("const hasPublishedDeals = products.length > 0;") &&
      homePage.includes("현재 공개된 직접 검수 콘텐츠 1건") &&
      homePage.includes('href={hasPublishedDeals ? "/deals" : approvalSampleProduct.detailPath}') &&
      dealsPage.includes("function EmptyDealsCatalog()") &&
      dealsPage.includes("검수 기준을 통과한 상품만 공개합니다") &&
      dealsPage.includes("찾는 품목의 반품 구매 기준부터 확인하세요") &&
      dealsPage.includes("homeCategoryDetails[category.value].description") &&
      dealsPage.includes('href={`/deals/category/${category.value}`}') &&
      dealsPage.includes('if (!allPublished.length) return <EmptyDealsCatalog />;') &&
      dealsPage.indexOf('if (!allPublished.length) return <EmptyDealsCatalog />;') < dealsPage.indexOf("const filteredProducts = sortProducts") &&
      dealsPage.includes('<ApprovalSampleCard placement="deals" />') &&
      dealsPage.includes("파트너스 링크와 쿠팡 상품번호가 연결된 추천만 보여드립니다."),
    "when the public catalog is empty, home and /deals lead with the only verified affiliate-backed editorial pick instead of zero-count filters",
    "required"
  );
}

if (fileExists("app/picks/page.tsx") && fileExists("app/sitemap.ts") && fileExists("app/api/events/route.ts")) {
  const picksPage = readText("app/picks/page.tsx");
  const sitemap = readText("app/sitemap.ts");
  const eventRoute = readText("app/api/events/route.ts");
  check(
    "public funnel: editorial pick hub",
    picksPage.includes('const canonicalUrl = `${siteUrl}/picks`') &&
      picksPage.includes('title: pageTitle') &&
      picksPage.includes("isPublicDealVisible") &&
      picksPage.includes("isDemoProduct") &&
      picksPage.includes("ProductImpressionTracker") &&
      picksPage.includes('<ApprovalSampleCard placement="picks" />') &&
      picksPage.includes("공식 API나 허용된 공개 근거") &&
      picksPage.includes("AffiliateNotice") &&
      sitemap.includes('path: "/picks"') &&
      eventRoute.includes('context: "editorial_picks_card"') &&
      eventRoute.includes('pathname: "/picks"'),
    "the public editorial hub keeps a verified fallback, adds only customer-ready products, exposes SEO metadata, and attributes its card impressions",
    "required"
  );
}

if (fileExists("components/ReturnEvidence.tsx") && fileExists("lib/publicWebEvidence.ts") && fileExists("lib/providers/publicWebProvider.ts")) {
  const returnEvidence = readText("components/ReturnEvidence.tsx");
  const publicWebEvidence = readText("lib/publicWebEvidence.ts");
  const publicWebProvider = readText("lib/providers/publicWebProvider.ts");
  check(
    "public web evidence: customer provenance link",
    returnEvidence.includes("getPublicWebEvidence") &&
      publicWebEvidence.includes("detail_page_url") &&
      publicWebEvidence.includes("page_url") &&
      publicWebEvidence.includes("isPublicWebHostname") &&
      returnEvidence.includes("근거 페이지 확인") &&
      returnEvidence.includes('rel="nofollow noopener noreferrer"') &&
      publicWebProvider.includes("detail_page_url") &&
      publicWebProvider.includes("page_url"),
    "customer pages expose only validated public-web evidence URLs while keeping return values as evidence-backed hints",
    "required"
  );
}

if (
  fileExists("components/GuideEditorialLink.tsx") &&
  fileExists("app/guide/return-checklist/page.tsx") &&
  fileExists("app/guide/safe-categories/page.tsx")
) {
  const guideEditorialLink = readText("components/GuideEditorialLink.tsx");
  const returnChecklistGuide = readText("app/guide/return-checklist/page.tsx");
  const safeCategoriesGuide = readText("app/guide/safe-categories/page.tsx");
  check(
    "public guides: disclosed editorial handoff",
    returnChecklistGuide.includes("GuideEditorialLink") &&
      safeCategoriesGuide.includes("GuideEditorialLink") &&
      guideEditorialLink.includes("approvalSampleProduct.detailPath") &&
      guideEditorialLink.includes("approvalSampleProduct.imageSrc") &&
      guideEditorialLink.includes("실전 구매 전 사례") &&
      guideEditorialLink.includes("Novatech S1 구매 전 체크 보기") &&
      guideEditorialLink.includes("쿠팡 파트너스 제휴 링크가 포함되어 있습니다") &&
      !guideEditorialLink.includes("link.coupang.com"),
    "search guides send readers to the disclosed ReturnPick editorial review before any explicit affiliate destination",
    "required"
  );
}

if (fileExists("lib/clientTracking.ts") && fileExists("components/AffiliateEventTracker.tsx")) {
  const clientTracking = readText("lib/clientTracking.ts");
  const eventTracker = readText("components/AffiliateEventTracker.tsx");
  check(
    "client tracking: telegram detail attribution",
    clientTracking.includes("getCurrentUtmSource") &&
      clientTracking.includes("getUtmSource()") &&
      eventTracker.includes("getCurrentUtmSource") &&
      eventTracker.includes("const currentUtmSource = getCurrentUtmSource()") &&
      eventTracker.includes('const isTelegramLanding = currentUtmSource === "telegram"') &&
      eventTracker.includes('eventType: isTelegramLanding ? "telegram_detail_click" : "detail_view"') &&
      eventTracker.includes('channel: isTelegramLanding ? "telegram" : "web"'),
    "telegram_detail_click is counted only for detail-page entries whose current URL carries utm_source=telegram, while persisted UTM remains available for later purchase attribution",
    "required"
  );
}

if (
  fileExists("components/AffiliateButton.tsx") &&
  fileExists("components/DealDetail.tsx") &&
  fileExists("components/PurchaseDecisionPanel.tsx") &&
  fileExists("components/CompareBoard.tsx")
) {
  const affiliateButton = readText("components/AffiliateButton.tsx");
  const dealDetail = readText("components/DealDetail.tsx");
  const purchaseDecisionPanel = readText("components/PurchaseDecisionPanel.tsx");
  const compareBoard = readText("components/CompareBoard.tsx");
  check(
    "client tracking: cta placement channels",
    affiliateButton.includes("cleanTrackingPlacement") &&
      affiliateButton.includes("buildTrackingChannel") &&
      affiliateButton.includes("placement?: string") &&
      affiliateButton.includes("resolvedChannel") &&
      dealDetail.includes('placement="detail_hero"') &&
      dealDetail.includes('placement="detail_price"') &&
      dealDetail.includes('placement="detail_sidebar"') &&
      dealDetail.includes('placement="detail_mobile_sticky"') &&
      purchaseDecisionPanel.includes('placement="detail_decision"'),
    "purchase CTA clicks include a safe placement channel so admins can see which explicit button drives Coupang clicks",
    "required"
  );
  check(
    "public UX: missing affiliate CTA fails closed",
    affiliateButton.includes("if (!affiliateLinkReady)") &&
      dealDetail.includes("const affiliateReady") &&
      dealDetail.includes('disabledLabel={demoProduct ? "데모 상품 · 구매 링크 없음" : "링크 확인필요"}') &&
      dealDetail.includes("구매 버튼이 비활성화되어 있습니다") &&
      purchaseDecisionPanel.includes("!outboundLink.isAffiliate ? null : outboundLink.href") &&
      purchaseDecisionPanel.includes('"링크 확인필요"') &&
      purchaseDecisionPanel.includes("구매 버튼을 비활성화합니다") &&
      compareBoard.includes("링크 확인필요") &&
      !dealDetail.includes("쿠팡 검색 결과로 이동") &&
      !purchaseDecisionPanel.includes("일반 쿠팡 검색으로 이동"),
    "missing or non-affiliate product URLs are shown as 확인필요 and never presented as a regular Coupang search CTA",
    "required"
  );
}

if (fileExists("lib/dealFreshness.ts") && fileExists("components/PurchaseVerificationStrip.tsx") && fileExists("components/PurchaseDecisionPanel.tsx")) {
  const freshness = readText("lib/dealFreshness.ts");
  const verificationStrip = readText("components/PurchaseVerificationStrip.tsx");
  const purchaseDecisionPanel = readText("components/PurchaseDecisionPanel.tsx");
  const purchaseDecision = readText("lib/purchaseDecision.ts");
  check(
    "public detail: observed data freshness beside purchase CTA",
    freshness.includes('export type DealFreshnessStatus = "fresh" | "stale" | "unknown"') &&
      freshness.includes("product.last_observed_at") &&
      freshness.includes("product.latest_snapshot?.observed_at") &&
      freshness.includes("FRESH_WINDOW_MS = 24 * 60 * 60 * 1000") &&
      !freshness.includes("product.updated_at") &&
      verificationStrip.includes('data-freshness-status={freshness.status}') &&
      verificationStrip.includes("마지막 상품 자동 수집") &&
      verificationStrip.includes("동일 모델·용량·색상") &&
      verificationStrip.includes("현재 가격·재고·배송") &&
      verificationStrip.includes("반품등급·구성품·교환 조건") &&
      purchaseDecisionPanel.includes("<PurchaseVerificationStrip freshness={decision.freshness} />") &&
      purchaseDecisionPanel.includes('placement="detail_decision"') &&
      purchaseDecision.includes('freshness.status === "stale"') &&
      purchaseDecision.includes('freshness.status === "unknown"'),
    "purchase CTA shows the latest real observation, flags data older than 24 hours, and keeps a one-click explicit outbound action",
    "required"
  );
}

if (
  fileExists("app/disclosure/page.tsx") &&
  fileExists("components/AffiliateButton.tsx") &&
  fileExists("components/AffiliateNotice.tsx") &&
  fileExists("components/CompareBoard.tsx") &&
  fileExists("components/DealDetail.tsx") &&
  fileExists("components/PurchaseDecisionPanel.tsx") &&
  fileExists("lib/coupangLink.ts")
) {
  const purchaseCopyFiles = [
    readText("app/disclosure/page.tsx"),
    readText("components/AffiliateButton.tsx"),
    readText("components/AffiliateNotice.tsx"),
    readText("components/CompareBoard.tsx"),
    readText("components/DealDetail.tsx"),
    readText("components/PurchaseDecisionPanel.tsx"),
    readText("lib/coupangLink.ts")
  ];
  const disclosurePage = purchaseCopyFiles[0];
  const affiliateNotice = purchaseCopyFiles[2];
  const compareBoard = purchaseCopyFiles[3];
  const dealDetail = purchaseCopyFiles[4];
  const purchaseDecisionPanel = purchaseCopyFiles[5];
  const coupangLink = purchaseCopyFiles[6];
  check(
    "public purchase copy readable Korean",
    purchaseCopyFiles.every((text) => !containsLikelyMojibake(text)) &&
      disclosurePage.includes("제휴 안내") &&
      affiliateNotice.includes("쿠팡 파트너스 활동의 일환") &&
      coupangLink.includes("쿠팡에서 가격 확인") &&
      dealDetail.includes("가격 비교") &&
      dealDetail.includes("추천 이유") &&
      dealDetail.includes("위험 플래그") &&
      purchaseDecisionPanel.includes("30초 구매 판단") &&
      purchaseDecisionPanel.includes("구매 전 확인") &&
      purchaseDecisionPanel.includes("쿠팡에서 실시간 가격 확인") &&
      compareBoard.includes("구매 전 최종 비교") &&
      !coupangLink.includes('label: "쿠팡에서 상품 검색"') &&
      !coupangLink.includes("일반 쿠팡 상품 페이지로 이동") &&
      !coupangLink.includes("상품명 기반 쿠팡 검색 결과로 이동"),
    "customer-facing purchase, comparison, and affiliate disclosure copy stays readable Korean",
    "required"
  );
  check(
    "affiliate notice links to full disclosure",
    affiliateNotice.includes('import Link from "next/link"') &&
      affiliateNotice.includes('href="/disclosure"') &&
      affiliateNotice.includes("쿠팡 파트너스 안내 자세히 보기"),
    "the shared affiliate notice keeps a visible, internal handoff to the full disclosure page",
    "required"
  );
}

if (fileExists("lib/adminNavigation.ts") && fileExists("app/globals.css")) {
  const adminNavigation = readText("lib/adminNavigation.ts");
  const globals = readText("app/globals.css");
  check(
    "admin: anchor handoff highlight utility",
    adminNavigation.includes("scrollToAdminAnchor") &&
      adminNavigation.includes("admin-anchor-highlight") &&
      adminNavigation.includes("scrollIntoView") &&
      adminNavigation.includes("window.history.replaceState") &&
      globals.includes(".admin-anchor-highlight") &&
      globals.includes("@keyframes admin-anchor-highlight") &&
      globals.includes("prefers-reduced-motion"),
    "admin handoff buttons scroll to the target panel and briefly highlight it without relying on alerts",
    "required"
  );
}

if (fileExists("components/CompareBoard.tsx") && fileExists("components/CompareButton.tsx") && fileExists("components/CompareDock.tsx")) {
  const compareBoard = readText("components/CompareBoard.tsx");
  const compareButton = readText("components/CompareButton.tsx");
  const compareDock = readText("components/CompareDock.tsx");
  check(
    "compare: storage and load failures are non-blocking",
    compareBoard.includes("getStoredJsonArray") &&
      compareBoard.includes("비교 상품 정보를 불러오지 못했습니다") &&
      compareBoard.includes("네트워크 문제로 비교 상품 정보를 불러오지 못했습니다") &&
      compareBoard.includes("unavailableItems") &&
      compareBoard.includes("비교한 상품이 공개 목록에서 사라졌습니다") &&
      compareBoard.includes("비교함 비우기") &&
      compareButton.includes("setStoredJsonArray") &&
      compareDock.includes("setStoredJsonArray"),
    "compare cart storage and API failures do not break the public purchase flow",
    "required"
  );
}

if (fileExists("components/AffiliateEventTracker.tsx")) {
  const eventTracker = readText("components/AffiliateEventTracker.tsx");
  check(
    "client tracking: storage-safe view trackers",
    eventTracker.includes("getStoredJsonArray") &&
      eventTracker.includes("setStoredJsonArray") &&
      !eventTracker.includes("window.localStorage"),
    "impression and detail trackers use storage-safe helpers instead of raw localStorage",
    "required"
  );
}

if (fileExists("lib/apiReadiness.ts")) {
  const readiness = readText("lib/apiReadiness.ts");
  const launchCapabilityPolicy = fileExists("lib/launchCapabilityPolicy.ts") ? readText("lib/launchCapabilityPolicy.ts") : "";
  const productionVerifier = fileExists("scripts/verify-production-readiness.mjs") ? readText("scripts/verify-production-readiness.mjs") : "";
  check("readiness: coupang deeplink connection test", readiness.includes("createCoupangDeeplink") && readiness.includes("deeplink_status"), "admin readiness tests Coupang search and deeplink path", "required");
  check(
    "readiness: coupang response-shape diagnostics",
    readiness.includes("response_array_path") &&
      readiness.includes("raw_product_count") &&
      readiness.includes("sample_has_product_url") &&
      readiness.includes("sample_product_url_field") &&
      readiness.includes("쿠팡 검색 API는 응답했지만 상품 후보 배열이 비어 있습니다"),
    "admin readiness surfaces Coupang response shape and sample URL diagnostics before first launch",
    "required"
  );
  check(
    "readiness: coupang approval-stage guidance",
    readiness.includes("readableCoupangReadinessItem") &&
      readiness.includes("readableCoupangConnectionCheck") &&
      readiness.includes("COUPANG_API_PERMISSION_OR_APPROVAL_REQUIRED") &&
      readiness.includes("최종승인 전이면 정상 대기 상태입니다") &&
      readiness.includes("operator_next_action"),
    "admin readiness explains Coupang API permission/approval failures with a concrete next action",
    "required"
  );
  check(
    "readiness: naver credential guidance",
    readiness.includes("describeNaverApiIssue") &&
      readiness.includes("readableNaverConnectionCheck") &&
      readiness.includes("NAVER_API_CREDENTIAL_OR_PERMISSION_FAILED") &&
      readiness.includes("NAVER_API_RATE_LIMITED") &&
      readiness.includes("operator_next_action"),
    "admin readiness explains Naver credential, permission, and rate-limit failures with a concrete next action",
    "required"
  );
  check(
    "readiness: naver response-price diagnostics",
    readiness.includes("api_total") &&
      readiness.includes("raw_item_count") &&
      readiness.includes("priced_item_count") &&
      readiness.includes("sample_mall_name") &&
      readiness.includes("네이버 쇼핑 API는 응답했지만 테스트 검색어의 items 배열이 비어 있습니다") &&
      readiness.includes("네이버 검색 결과는 들어왔지만 lprice가 있는 항목이 없습니다"),
    "admin readiness surfaces Naver response shape and price-field diagnostics before first launch",
    "required"
  );
  check(
    "readiness: telegram optional connection check",
    readiness.includes('"telegram"') && readiness.includes("getChat") && readiness.includes("get_chat_ok") && readiness.includes("optionalConnectionCheckIds"),
    "admin readiness verifies Telegram token and chat access when configured without making it a core launch blocker",
    "required"
  );
  check(
    "readiness: telegram operator guidance",
    readiness.includes("describeTelegramApiIssue") &&
      readiness.includes("readableTelegramConnectionCheck") &&
      readiness.includes("TELEGRAM_BOT_TOKEN_INVALID") &&
      readiness.includes("TELEGRAM_CHAT_ACCESS_FAILED") &&
      readiness.includes("TELEGRAM_API_RATE_LIMITED") &&
      readiness.includes("operator_next_action"),
    "admin readiness explains Telegram token, chat access, and rate-limit failures with a concrete next action",
    "required"
  );
  check(
    "readiness: supabase schema column test",
    readiness.includes("requiredSchemaChecks") && readiness.includes("keyword_key") && readiness.includes("SCHEMA_VERSION_MISMATCH"),
    "admin readiness verifies required Supabase columns",
    "required"
  );
  check(
    "readiness: supabase env value validation",
    readiness.includes("buildSupabaseItem") &&
      readiness.includes("getSupabaseUrlIssue") &&
      readiness.includes("isLikelySupabaseKey") &&
      readiness.includes("SUPABASE_KEYS_MUST_DIFFER") &&
      readiness.includes("missing_or_invalid_env"),
    "admin readiness rejects malformed Supabase URLs, short keys, or identical anon/service keys before live DB checks",
    "required"
  );
  check(
    "readiness: supabase operator guidance",
    readiness.includes("describeSupabaseIssue") &&
      readiness.includes("readableSupabaseConnectionCheck") &&
      readiness.includes("SUPABASE_SCHEMA_VERSION_MISMATCH") &&
      readiness.includes("SUPABASE_TABLE_OR_COLUMN_MISSING") &&
      readiness.includes("SUPABASE_WRITE_SMOKE_FAILED") &&
      readiness.includes("SUPABASE_PUBLIC_RLS_FAILED") &&
      readiness.includes("operator_next_action"),
    "admin readiness explains Supabase env, schema, write, and RLS failures with a concrete next action",
    "required"
  );
  check(
    "readiness: supabase schema version marker",
    readiness.includes("EXPECTED_SCHEMA_VERSION") &&
      readiness.includes("2026-08-01-public-column-boundary") &&
      readiness.includes("returnpick_schema_meta") &&
      readiness.includes("schema_version"),
    "admin readiness verifies the deployed DB has the latest schema.sql marker",
    "required"
  );
  check(
    "readiness: strict affiliate SQL function smoke test",
    readiness.includes("runStrictAffiliateSqlFunctionSmokeCheck") &&
      readiness.includes("is_strict_coupang_partners_url") &&
      readiness.includes("strict_affiliate_function_accepts_short_link") &&
      readiness.includes("strict_affiliate_function_rejects_fake_code") &&
      readiness.includes("strict_affiliate_function_rejects_regular_coupang_url") &&
      readiness.includes("strict_affiliate_function"),
    "admin readiness calls the DB function and verifies strict Partners link acceptance/rejection, not only the schema version marker",
    "required"
  );
  check(
    "readiness: public site URL validation",
    readiness.includes("getPublicSiteUrlIssue") &&
      readiness.includes("https_required") &&
      readiness.includes("public_domain_required") &&
      readiness.includes("localhost") &&
      readiness.includes("buildPublicSiteUrlItem"),
    "admin readiness blocks local, invalid, or non-HTTPS NEXT_PUBLIC_SITE_URL values before first launch",
    "required"
  );
  check(
    "readiness: approval link and cron secret validation",
    readiness.includes("buildApprovalLinkItem") &&
      readiness.includes("isCoupangPartnersLink") &&
      readiness.includes("buildCronSecretItem") &&
      readiness.includes("raw.length >= 16"),
    "admin readiness rejects invalid approval links and short CRON_SECRET values before first launch",
    "required"
  );
  check(
    "readiness: admin password value validation",
    readiness.includes("buildAdminPasswordItem") &&
      readiness.includes("isStrongAdminPassword") &&
      readiness.includes("admin_password") &&
      readiness.includes("admin_password"),
    "admin readiness rejects short or placeholder ADMIN_PASSWORD values before first launch",
    "required"
  );
  check(
    "readiness: provider env value validation",
    readiness.includes("buildCoupangItem") &&
      readiness.includes("buildNaverItem") &&
      readiness.includes("buildTelegramItem") &&
      readiness.includes("isLikelyProviderSecret") &&
      readiness.includes("isLikelyTelegramBotToken") &&
      readiness.includes("missing_or_invalid_env"),
    "admin readiness rejects malformed Coupang, Naver, or Telegram env values before live API checks",
    "required"
  );
  check(
    "readiness: public web config validation",
    readiness.includes("buildPublicWebItem") &&
      readiness.includes("getPublicWebHostIssue") &&
      readiness.includes("getPublicWebTemplateIssue") &&
      readiness.includes("template_host_not_allowed") &&
      launchCapabilityPolicy.includes('...(publicWebEnabled ? ["public_web"] : [])'),
    "admin readiness blocks unsafe or mismatched public-web crawl allowlists and templates when crawling is enabled",
    "required"
  );
  check(
    "readiness: public web config count bounds",
    readiness.includes("MAX_PUBLIC_WEB_ALLOWED_HOSTS") &&
      readiness.includes("MAX_PUBLIC_WEB_SEARCH_TEMPLATES") &&
      readiness.includes("tooManyHosts") &&
      readiness.includes("tooManyTemplates") &&
      readiness.includes("PUBLIC_WEB_ALLOWED_HOSTS는 최대"),
    "admin readiness blocks overly broad public-web crawl host and template lists",
    "required"
  );
  check(
    "readiness: public web live connection check",
    readiness.includes("searchPublicWebProducts") &&
      readiness.includes("requiredConnectionCheckIds") &&
      readiness.includes('"public_web"') &&
      readiness.includes("PUBLIC_WEB_CRAWL_ENABLED") &&
      readiness.includes("provider_status: result.status"),
    "admin readiness runs a robots-aware public-web live check only when public web collection is enabled",
    "required"
  );
  check("readiness: supabase write smoke test", readiness.includes("runSupabaseWriteSmokeCheck") && readiness.includes("sourcing_runs_insert") && readiness.includes("affiliate_events_insert"), "admin readiness verifies Supabase write paths for logs and events", "required");
  check(
    "readiness: anon public RLS smoke test",
    readiness.includes("runAnonPublicRlsSmokeCheck") &&
      readiness.includes("anon_can_read_affiliate_ready_product") &&
      readiness.includes("anon_can_read_public_product_columns") &&
      readiness.includes("anon_cannot_read_internal_product_columns") &&
      readiness.includes("anon_cannot_read_internal_snapshot_columns") &&
      readiness.includes("anon_cannot_read_unpublished_product") &&
      readiness.includes("anon_public_rls_smoke"),
    "admin readiness verifies public RLS with the anon key, not only service role access",
    "required"
  );
  check(
    "readiness: data quality dependency card",
    readiness.includes("dataQualityDependencyCheck") &&
      readiness.includes('id: "data_quality"') &&
      readiness.includes('status: "skipped"') &&
      readiness.includes('blocked_by: "supabase"') &&
      readiness.includes("checks.push(") &&
      productionVerifier.includes('check.status !== "ok"') &&
      productionVerifier.includes("required cards awaiting setup"),
    "data quality is always reported with an explicit Supabase dependency and launch verification requires every required card to be ok",
    "required"
  );
  check(
    "readiness: public data quality gate",
    readiness.includes("runPublicDataQualityCheck") &&
      readiness.includes("getCustomerPublishReadiness") &&
      readiness.includes("published_public_quality_blockers") &&
      readiness.includes("published_public_ready_count") &&
      readiness.includes("published_customer_hidden_count") &&
      readiness.includes("public_quality_blocker_summary") &&
      readiness.includes("sample_public_quality_blocked_products") &&
      readiness.includes("published_non_partners_affiliate_url") &&
      readiness.includes("audited_public_affiliate_rows") &&
      readiness.includes("approval_sample_link_reuse") &&
      readiness.includes("public_affiliate_constraint") &&
      readiness.includes("공개 보류 상품의 최다 blocker"),
    "admin readiness detects and summarizes published products with public quality blockers, missing, weak, non-Partners, sample, or schema-unprotected affiliate URLs",
    "required"
  );
  check("readiness: public approval live check", readiness.includes("runPublicSiteLiveCheck") && readiness.includes("\uCFE0\uD321\uC5D0\uC11C \uAC00\uACA9 \uD655\uC778") && readiness.includes("has_approval_affiliate_url"), "admin readiness verifies public approval page and affiliate disclosure", "required");
  check(
    "readiness: cron endpoint probe",
    readiness.includes("runCronProbeCheck") &&
      readiness.includes("/api/cron/sourcing?probe=1") &&
      readiness.includes("/api/cron/affiliate-backfill?probe=1") &&
      readiness.includes("/api/cron/telegram-digest?probe=1") &&
      readiness.includes("job_started === false"),
    "admin readiness verifies deployed Cron endpoints with CRON_SECRET without starting jobs",
    "required"
  );
  check(
    "readiness: capability-scoped launch gate",
    readiness.includes("launchReady") &&
      readiness.includes("blockingEnv") &&
      readiness.includes("optionalMissingItemIds") &&
      readiness.includes("optionalMissingEnv") &&
      readiness.includes("NEXT_PUBLIC_COUPANG_APPROVAL_PRODUCT_URL"),
    "admin readiness distinguishes core launch blockers from optional price and delivery integrations",
    "required"
  );
  check(
    "readiness: isolated connection check failures",
    readiness.includes("connectionCheckFailure") &&
      readiness.includes('connectionCheckFailure("coupang"') &&
      readiness.includes('connectionCheckFailure("naver"') &&
      readiness.includes('connectionCheckFailure("supabase"') &&
      readiness.includes('connectionCheckFailure("telegram"'),
    "admin readiness keeps reporting other live checks when one provider throws unexpectedly",
    "required"
  );
}

if (fileExists("app/api/admin/api-readiness/route.ts")) {
  const readinessRoute = readText("app/api/admin/api-readiness/route.ts");
  check(
    "admin api: api readiness safe error response",
    readinessRoute.includes("apiReadinessErrorResponse") &&
      readinessRoute.includes("API_READINESS_FAILED") &&
      readinessRoute.includes("message.slice(0, 300)") &&
      readinessRoute.includes("catch (error)") &&
      readinessRoute.includes("return apiReadinessErrorResponse(error)"),
    "admin API readiness route returns bounded JSON errors when live connection checks throw",
    "required"
  );
}

if (fileExists("lib/validators.ts")) {
  const validators = readText("lib/validators.ts");
  check(
    "admin api: weak password guard",
    validators.includes("isStrongAdminPassword") &&
      validators.includes("ADMIN_PASSWORD_WEAK_CONFIGURATION") &&
      validators.includes("raw.length < 12") &&
      validators.includes("looksLikePlaceholder"),
    "production admin API rejects missing, short, or placeholder ADMIN_PASSWORD values before checking requests",
    "required"
  );
  check(
    "admin auth: signed scoped session",
    validators.includes("ADMIN_SESSION_COOKIE") &&
      validators.includes("ADMIN_SESSION_MAX_AGE_SECONDS") &&
      validators.includes('createHmac("sha256"') &&
      validators.includes("timingSafeEqual") &&
      validators.includes("verifyAdminSessionToken") &&
      validators.includes("ADMIN_SESSION_ORIGIN_MISMATCH"),
    "browser admin authentication uses a bounded signed session and rejects cross-origin cookie mutations",
    "required"
  );
}

if (fileExists("app/api/admin/session/route.ts") && fileExists("components/AdminLogin.tsx")) {
  const sessionRoute = readText("app/api/admin/session/route.ts");
  const adminLogin = readText("components/AdminLogin.tsx");
  check(
    "admin auth: HttpOnly session lifecycle",
    sessionRoute.includes('path: "/api/admin"') &&
      sessionRoute.includes("httpOnly: true") &&
      sessionRoute.includes('sameSite: "strict"') &&
      sessionRoute.includes('secure: process.env.NODE_ENV === "production"') &&
      sessionRoute.includes("maxAge: ADMIN_SESSION_MAX_AGE_SECONDS") &&
      sessionRoute.includes("export async function DELETE") &&
      adminLogin.includes('fetch("/api/admin/session"') &&
      !adminLogin.includes("localStorage"),
    "admin password is exchanged once for a scoped HttpOnly cookie and is not persisted by the login form",
    "required"
  );
}

if (fileExists("components/AdminLaunchStatusBar.tsx")) {
  const launchStatusBar = readText("components/AdminLaunchStatusBar.tsx");
  check(
    "admin: launch status command center",
    launchStatusBar.includes("Launch Command Center") &&
      launchStatusBar.includes("운영 전환 요약") &&
      launchStatusBar.includes("승인 대기") &&
      launchStatusBar.includes("첫 가동 가능") &&
      launchStatusBar.includes("누락 환경변수") &&
      launchStatusBar.includes("준비도 점검") &&
      launchStatusBar.includes("첫 가동") &&
      launchStatusBar.includes("운영 지표") &&
      launchStatusBar.includes("/products/approval-sample"),
    "admin top bar summarizes approval/API/launch status and links operators to the next panel without exposing secrets",
    "required"
  );
  check(
    "admin: post-approval fast path",
    launchStatusBar.includes("빠른 출시 동선") &&
      launchStatusBar.includes("admin-manual-product-bulk") &&
      launchStatusBar.includes("admin-affiliate-links") &&
      launchStatusBar.includes("admin-candidate-review") &&
      launchStatusBar.includes("admin-telegram-distribution"),
    "admin top bar links the post-approval product intake, affiliate review, publish, and distribution flow",
    "required"
  );
  check(
    "admin: launch status safe readiness fetch",
    launchStatusBar.includes('fetch("/api/admin/api-readiness"') &&
      launchStatusBar.includes("x-admin-password") &&
      launchStatusBar.includes("data.message ?? data.error") &&
      launchStatusBar.includes("네트워크 문제로 운영 전환 상태를 불러오지 못했습니다") &&
      launchStatusBar.includes("scrollToAdminAnchor(\"admin-api-readiness\")") &&
      launchStatusBar.includes("scrollToAdminAnchor(\"admin-ops-dashboard\")"),
    "admin top bar fetches readiness with the admin password and handles API/network errors inline",
    "required"
  );
}

if (fileExists("components/AdminApiReadinessPanel.tsx")) {
  const panel = readText("components/AdminApiReadinessPanel.tsx");
  check("admin: launch runbook", panel.includes("승인 후 첫 운영 순서") && panel.includes("목업 끄고 첫 후보 수집"), "admin shows the post-approval first-run checklist", "required");
  check("admin: launch connection checks include data quality", panel.includes("requiredConnectionCheckIds") && panel.includes("공개 상품 데이터 품질"), "admin launch checklist requires public product data quality checks", "required");
  check(
    "admin: optional capability readiness",
    panel.includes("선택 연동 대기") &&
      panel.includes("핵심 출시와 사이트 게시는 차단하지 않습니다") &&
      panel.includes("사이트 게시는 텔레그램 없이도 가능") &&
      panel.includes("optionalMissingItemIds"),
    "admin clearly separates optional Naver and Telegram setup from core launch blockers",
    "required"
  );
  check("admin: launch connection checks include cron", panel.includes("Cron 인증"), "admin launch checklist requires deployed Cron auth checks", "required");
  check(
    "admin: launch connection checks include optional public web",
    panel.includes("readiness.requiredConnectionCheckIds.every") &&
      panel.includes("공개 웹 참고 수집 사용 시 robots.txt 경로"),
    "admin launch checklist includes public-web robots checks when that optional source is enabled",
    "required"
  );
  check(
    "admin: connection check detail display",
    panel.includes("formatCheckDetailValue") && panel.includes("checkDetailEntries") && panel.includes("진단 세부정보"),
    "admin shows safe detail fields for failed API, Supabase, Cron, and public-site connection checks",
    "required"
  );
  check(
    "admin: readiness operator action cards",
    panel.includes("operatorNextActionFromDetail") &&
      panel.includes('key !== "operator_next_action"') &&
      panel.includes("다음 조치") &&
      panel.includes("publicQualityBlockerSummaryFromDetail") &&
      panel.includes("품질 blocker 요약") &&
      panel.includes('key !== "public_quality_blocker_summary"'),
    "admin shows next actions and public quality blocker summaries as dedicated cards instead of burying them in JSON detail",
    "required"
  );
  check(
    "admin: supabase schema action",
    panel.includes("getSupabaseSchemaIssue") &&
      panel.includes("Supabase 최신 SQL 적용 필요") &&
      panel.includes("sql/schema.sql") &&
      panel.includes("기대 버전") &&
      panel.includes("현재 DB 버전"),
    "admin highlights schema version mismatches with a clear Supabase SQL reapply action",
    "required"
  );
  check(
    "admin: supabase schema runbook copy",
    panel.includes("copySupabaseSchemaRunbook") &&
      panel.includes("SQL 적용 체크리스트 복사") &&
      panel.includes("C:\\\\projects\\\\returnpick\\\\sql\\\\schema.sql") &&
      panel.includes("returnpick_schema_meta") &&
      panel.includes("is_strict_coupang_partners_url"),
    "admin can copy a concrete Supabase SQL reapply checklist when the deployed DB schema is stale",
    "required"
  );
  check(
    "admin: connection failure report copy",
    panel.includes("copyConnectionFailureReport") &&
      panel.includes("실패 보고서 복사") &&
      panel.includes("ReturnPick 실제 연결 테스트 실패 보고서") &&
      panel.includes("failedConnectionCheckCount") &&
      panel.includes("진단 세부정보"),
    "admin can copy a safe report of failed live connection checks after API keys are entered",
    "required"
  );
  check(
    "admin: connection failure report action summary copy",
    panel.includes("operatorNextActionFromDetail(check.detail)") &&
      panel.includes("publicQualityBlockerSummaryFromDetail(check.detail)") &&
      panel.includes("- 다음 조치:") &&
      panel.includes("- 품질 blocker 요약:"),
    "copied failure reports include the same operator action and public-quality blocker summary shown in the readiness cards",
    "required"
  );
  check(
    "admin: readiness public quality metric cards",
    panel.includes("publicQualityMetricCardsFromDetail") &&
      panel.includes("published_public_ready_count") &&
      panel.includes("published_customer_hidden_count") &&
      panel.includes("공개 품질 운영 요약") &&
      panel.includes("고객 공개 가능") &&
      panel.includes("링크 보강 필요") &&
      panel.includes("DB 링크 제약"),
    "admin readiness connection results summarize customer-visible deal count, hidden published rows, affiliate-link repair, and DB link constraint status",
    "required"
  );
  check(
    "admin: readiness public quality repair handoff",
    panel.includes("publicQualityActionButtonsFromDetail") &&
      panel.includes("바로 보강하기") &&
      panel.includes("링크 보강 큐로 이동") &&
      panel.includes("공개 보강 후보로 이동") &&
      panel.includes("admin-affiliate-links") &&
      panel.includes("admin-candidate-review") &&
      panel.includes("scrollToAdminAnchor(action.anchor)"),
    "admin readiness public-quality summary can send operators directly to affiliate-link repair or candidate public-repair queues",
    "required"
  );
  check(
    "admin: next launch action card",
    panel.includes("nextLaunchAction") &&
      panel.includes("Next Launch Action") &&
      panel.includes("실제 연결 테스트") &&
      panel.includes("목업 끄고 첫 후보 수집"),
    "admin shows the single next operator action for approval wait, env setup, connection checks, or first launch",
    "required"
  );
  check(
    "admin: readiness to first launch handoff",
    panel.includes('id="admin-api-readiness"') &&
      panel.includes("scrollToFirstLaunchRunner") &&
      panel.includes("scrollToAdminAnchor") &&
      panel.includes("admin-first-launch") &&
      panel.includes("첫 가동 실행으로 이동"),
    "admin readiness panel can send operators to the first-launch runner once live checks pass",
    "required"
  );
  check(
    "admin: vercel env copy checklist",
    panel.includes("Vercel Environment Variables") &&
      panel.includes("누락 키만 복사") &&
      panel.includes("NEXT_PUBLIC_COUPANG_APPROVAL_PRODUCT_URL") &&
      panel.includes("CRON_USE_MOCK_FALLBACK") &&
      panel.includes("SOURCING_TIME_BUDGET_MS") &&
      panel.includes("SOURCING_ENRICHMENT_CONCURRENCY") &&
      panel.includes("AFFILIATE_BACKFILL_LIMIT") &&
      panel.includes("PUBLIC_WEB_CRAWL_ENABLED"),
    "admin can copy the required and operational Vercel environment variable template after approval",
    "required"
  );
  check(
    "admin: operational secret generator",
    panel.includes("createOperationalSecret") &&
      panel.includes("generatedSecrets") &&
      panel.includes("generateOperationalSecrets") &&
      panel.includes("보안값 생성") &&
      panel.includes("ADMIN_PASSWORD") &&
      panel.includes("CRON_SECRET") &&
      panel.includes("cryptoSource.getRandomValues"),
    "admin can generate strong ADMIN_PASSWORD and CRON_SECRET values client-side for Vercel launch setup",
    "required"
  );
  check(
    "admin: GitHub scheduler manual readiness copy",
    panel.includes("githubSchedulerReadinessRunbook") &&
      panel.includes("copyGithubSchedulerReadinessRunbook") &&
      panel.includes("GitHub Actions 1시간 스케줄러 수동 확인") &&
      panel.includes("RETURNPICK_CRON_SECRET") &&
      panel.includes("RETURNPICK_SITE_URL") &&
      panel.includes("ReturnPick Hourly Scheduler") &&
      panel.includes("GitHub 스케줄러 체크 복사") &&
      panel.includes("앱 서버는 GitHub Repository secret 값을 직접 읽을 수 없습니다"),
    "admin readiness panel makes the GitHub hourly scheduler secret/variable check explicit because the app cannot read repository secrets",
    "required"
  );
  check(
    "admin: production deploy guard copy",
    panel.includes("productionDeployRunbook") &&
      panel.includes("copyProductionDeployRunbook") &&
      panel.includes("Production Deploy Guard") &&
      panel.includes("운영 전환 명령 복사") &&
      panel.includes("npm run doctor:production:launch:fresh") &&
      panel.includes("npm run deploy:production:launch -- confirm") &&
      panel.includes("npm run deploy:production:go-live -- confirm") &&
      panel.includes("confirm이 없으면 실제 배포나 데이터 작업을 시작하지 않습니다"),
    "admin readiness panel exposes the guarded production deploy and go-live command sequence after approval",
    "required"
  );
  check(
    "admin: readiness check failure feedback",
    panel.includes("data.message ?? data.error") &&
      panel.includes("네트워크 문제로 API 연결 테스트를 실행하지 못했습니다") &&
      panel.includes("setChecks([])") &&
      panel.includes("catch {"),
    "admin readiness panel shows API and network failures without leaving the connection check stuck",
    "required"
  );
}

if (fileExists("app/api/admin/keywords/route.ts")) {
  const keywordRoute = readText("app/api/admin/keywords/route.ts");
  check(
    "admin api: keyword input validation",
    keywordRoute.includes("INVALID_KEYWORD_PRICE") &&
      keywordRoute.includes("INVALID_KEYWORD_DISCOUNT_RATE") &&
      keywordRoute.includes("INVALID_KEYWORD_PRICE_RANGE") &&
      keywordRoute.includes("키워드는 2~80자 사이로 입력하세요") &&
      keywordRoute.includes("최소가는 최대가보다 클 수 없습니다"),
    "admin keyword API rejects invalid keyword, price, discount, and price-range values before sourcing",
    "required"
  );
}

if (fileExists("components/AdminKeywordManager.tsx")) {
  const keywordManager = readText("components/AdminKeywordManager.tsx");
  check(
    "admin: keyword manager save feedback",
    keywordManager.includes("notice") &&
      keywordManager.includes('id="admin-keyword-manager"') &&
      keywordManager.includes("!response.ok") &&
      keywordManager.includes("data.message ?? data.error") &&
      keywordManager.includes("role=\"status\"") &&
      keywordManager.includes("키워드를 저장했습니다"),
    "admin keyword manager shows API validation errors and success feedback",
    "required"
  );
}

if (fileExists("components/AdminSourcingRunner.tsx")) {
  const runner = readText("components/AdminSourcingRunner.tsx");
  check("admin: sourcing run diagnosis", runner.includes("diagnoseSourcingRun") && runner.includes("providerStats"), "admin shows first-run sourcing diagnostics", "required");
  check(
    "admin: sourcing immediate diagnosis feedback",
      runner.includes("immediateDiagnosisMessage") &&
      runner.includes("noticeTypeFromRun") &&
      runner.includes("data.diagnosis") &&
      runner.includes("notice.type === \"warning\"") &&
      runner.includes("다음 조치:") &&
      runner.includes("공급원 오류"),
    "admin sourcing runner shows diagnostics immediately after a run finishes and uses warning for recovered provider failures",
    "required"
  );
  check(
    "admin: sourcing run row diagnostics",
    runner.includes("runProviderSummary") &&
      runner.includes("runIssueSummary") &&
      runner.includes("가격 필터") &&
      runner.includes("robots 확인불가") &&
      runner.includes("공개웹 진단") &&
      runner.includes("publicWebDiagnosticStatuses") &&
      runner.includes("공급원 오류") &&
      runner.includes("providerIssueProviders") &&
      runner.includes("공급원") &&
      runner.includes("진단"),
    "admin sourcing run history shows provider-level and issue-level summaries for each run",
    "required"
  );
  check("admin: mock fallback follows API readiness", runner.includes("apiKeysReady") && runner.includes("setUseMockFallback(!nextReadiness.apiKeysReady)"), "admin disables mock fallback by default after API keys are detected", "required");
  check("admin: mock fallback control locks after API readiness", runner.includes("mockFallbackLocked") && runner.includes("disabled={mockFallbackLocked}") && runner.includes("mockFallbackBlockedReason"), "admin cannot accidentally request mock fallback after API keys are detected", "required");
  check(
    "admin: public web only sourcing control",
    runner.includes("public_web_only") &&
      runner.includes("publicWebOnly") &&
      runner.includes("공개 웹 후보 수집") &&
      runner.includes("반품 근거와 링크는 관리자 검수 후에만 공개됩니다"),
    "admin exposes an explicit public-web-only candidate run before Coupang API approval while keeping candidates behind review",
    "required"
  );
  check(
    "admin: sourcing diagnosis quick actions",
    runner.includes("diagnosisQuickActions") &&
      runner.includes('id="admin-sourcing-runner"') &&
      runner.includes("API 준비도 확인") &&
      runner.includes("키워드 조건 조정") &&
      runner.includes("공개웹 설정 확인") &&
      runner.includes("수집 이어서 실행") &&
      runner.includes("admin-api-readiness") &&
      runner.includes("admin-keyword-manager") &&
      runner.includes("scrollToAdminAnchor(action.anchor)"),
    "admin sourcing diagnosis cards send operators directly to readiness, keyword repair, public-web settings, or rerun context",
    "required"
  );
  check(
    "admin: sourcing runner surfaces execution failures",
    runner.includes("notice") &&
      runner.includes("!response.ok") &&
      runner.includes("data.message ?? data.error") &&
      runner.includes("role=\"status\"") &&
      runner.includes("네트워크 문제로 후보 수집을 실행하지 못했습니다"),
    "admin sourcing runner shows API and network failures instead of silently hiding failed runs",
    "required"
  );
  check(
    "admin: sourcing runner readable Korean copy",
    runner.includes("자동 후보 수집") &&
      runner.includes("후보 수집 실행") &&
      runner.includes("실제 연동 소스만 사용해 후보를 수집하고 있습니다") &&
      runner.includes("실행 기록이 없습니다") &&
      runner.includes("Crawl-delay 제외"),
    "admin sourcing runner uses readable Korean operator copy for run status and diagnostics",
    "required"
  );
}

if (fileExists("lib/sourcingDiagnostics.ts")) {
  const diagnostics = readText("lib/sourcingDiagnostics.ts");
  check(
    "sourcing diagnostics: readable Korean operator guidance",
    diagnostics.includes("후보 수집 정상") &&
      diagnostics.includes("수집 오류 확인 필요") &&
      diagnostics.includes("실제 소스 후보가 없습니다") &&
      diagnostics.includes("가격 필터가 후보를 모두 제외했습니다") &&
      diagnostics.includes("robots.txt의 Crawl-delay가 너무 긴 호스트"),
    "sourcing diagnostics explains first-run sourcing outcomes in readable Korean",
    "required"
  );
}

if (fileExists("components/AdminPriceBackfillPanel.tsx")) {
  const pricePanel = readText("components/AdminPriceBackfillPanel.tsx");
  const manualPriceRoute = fileExists("app/api/admin/prices/manual/route.ts") ? readText("app/api/admin/prices/manual/route.ts") : "";
  check(
    "admin: price backfill feedback",
    pricePanel.includes('id="admin-price-backfill"') &&
      pricePanel.includes("lastResult") &&
      pricePanel.includes("최근 보강 상세") &&
      pricePanel.includes("매칭 검색어와 실패 사유") &&
      pricePanel.includes("detailStatusLabel") &&
      pricePanel.includes("가격 보강 완료") &&
      pricePanel.includes("상품명이나 모델명을 보완") &&
      pricePanel.includes("includeCandidates") &&
      pricePanel.includes("검토 후보까지 포함") &&
      pricePanel.includes("publishedOnly: !includeCandidates") &&
      pricePanel.includes("!response.ok") &&
      pricePanel.includes("role=\"status\"") &&
      pricePanel.includes("네트워크 문제로 네이버 최저가 보강을 실행하지 못했습니다"),
    "admin price backfill panel shows API, network, per-product result feedback, and can include review candidates",
    "required"
  );
  check(
    "admin: price backfill retry query links",
    pricePanel.includes("naverShoppingSearchUrl") &&
      pricePanel.includes("detailQueries") &&
      pricePanel.includes("queries?: string[]") &&
      pricePanel.includes("재검색어") &&
      pricePanel.includes("search.shopping.naver.com/search/all") &&
      pricePanel.includes("target=\"_blank\"") &&
      pricePanel.includes("rel=\"noopener noreferrer\""),
    "admin price backfill details expose attempted Naver queries as safe manual retry links",
    "required"
  );
  check(
    "admin: price backfill SKU evidence",
    pricePanel.includes("동일 SKU만 채택") &&
      pricePanel.includes("matchSummary") &&
      pricePanel.includes("sku_rejection_reasons") &&
      pricePanel.includes("네이버 결과:") &&
      pricePanel.includes("동일 SKU 강한 일치"),
    "admin price repair results show the selected Naver title, SKU confidence, match signals, and rejection reasons",
    "required"
  );
  check(
    "admin: manual Naver price bulk confirmation",
    pricePanel.includes("수동 확인") &&
      pricePanel.includes("/api/admin/prices/manual") &&
      pricePanel.includes("상품 fingerprint") &&
      pricePanel.includes("확인 가격 저장") &&
      manualPriceRoute.includes("mergeManualNaverPriceEvidence") &&
      manualPriceRoute.includes("MAX_ROWS = 80") &&
      manualPriceRoute.includes("INVALID_NAVER_REFERENCE_URL") &&
      manualPriceRoute.includes("createDealScore"),
    "admin can persist bounded manual Naver price confirmations with product fingerprints, optional Naver provenance, and refreshed scores",
    "required"
  );
}

if (fileExists("lib/naverPriceBackfill.ts")) {
  const naverPriceBackfill = readText("lib/naverPriceBackfill.ts");
  check(
    "naver price backfill: per-item update failure isolation",
    naverPriceBackfill.includes("backfillErrorMessage") &&
      naverPriceBackfill.includes("NAVER_PRICE_BACKFILL_UPDATE_FAILED") &&
      naverPriceBackfill.includes("NAVER_PRICE_BACKFILL_SCORE_FAILED") &&
      naverPriceBackfill.includes("NAVER_PRICE_BACKFILL_LOG_FAILED") &&
      naverPriceBackfill.includes("continue;") &&
      naverPriceBackfill.includes("await updateProduct(product.id"),
    "a single product save, score, or log failure is reported on that item while the Naver price backfill continues",
    "required"
  );
  check(
    "naver price backfill: readable cleanup tokens",
    naverPriceBackfill.includes("반품|리퍼|중고|미개봉") &&
      naverPriceBackfill.includes("확인필요") &&
      naverPriceBackfill.includes("쿠팡|파트너스"),
    "Naver price backfill removes readable Korean condition and affiliate words before searching",
    "required"
  );
  check(
    "naver price backfill: no-match retry details",
    naverPriceBackfill.includes("NaverPriceBackfillDetail") &&
      naverPriceBackfill.includes("queries?: string[]") &&
      naverPriceBackfill.includes("firstQuery") &&
      naverPriceBackfill.includes("noMatchReason") &&
      naverPriceBackfill.includes("NO_RELEVANT_PRICED_MATCH") &&
      naverPriceBackfill.includes("NAVER_API_NOT_CONFIGURED") &&
      naverPriceBackfill.includes("queries: result.queries"),
    "Naver price backfill returns attempted query details when API is missing or no priced match is found",
    "required"
  );
  check(
    "naver price backfill: shared SKU matcher and evidence",
    naverPriceBackfill.includes("getLowestPriceFromQueries") &&
      naverPriceBackfill.includes("spec_json: product.spec_json") &&
      naverPriceBackfill.includes("NAVER_SKU_UNVERIFIED") &&
      naverPriceBackfill.includes("matched_url") &&
      naverPriceBackfill.includes("match: result.best.match ?? null") &&
      !naverPriceBackfill.includes("function relevance(product"),
    "manual price backfill uses the same conservative SKU matcher as automatic sourcing and persists review evidence",
    "required"
  );
}

if (fileExists("app/api/admin/sourcing/run/route.ts")) {
  const route = readText("app/api/admin/sourcing/run/route.ts");
  check(
    "admin api: sourcing run diagnosis response",
    route.includes("diagnoseSourcingRun") &&
      route.includes("diagnosis: diagnoseSourcingRun(run)") &&
      route.includes("defaults: mockFallbackDecision"),
    "admin sourcing run API returns immediate diagnostics with the run result",
    "required"
  );
  check("admin api: safe mock fallback default", route.includes("getApiReadinessSummary") && route.includes("readiness.apiKeysReady") && route.includes("mockFallbackDecision"), "admin sourcing API defaults to real-source mode when API keys are present", "required");
  check("admin api: production mock fallback hard block", route.includes("MOCK_FALLBACK_BLOCKED_AFTER_API_READY") && route.includes('process.env.NODE_ENV === "production"') && route.includes("requestedMockFallback === true"), "production admin sourcing blocks explicit mock fallback requests after API keys are present", "required");
  check(
    "admin api: bounded public web only sourcing",
    route.includes("public_web_only") &&
      route.includes("publicWebOnlyRequested") &&
      route.includes("publicWebOnlyAllowed") &&
      route.includes("readiness.runtimeReady") &&
      route.includes("source_mode"),
    "production admin sourcing permits only an explicit, runtime-ready public-web-only run when Coupang API is unavailable",
    "required"
  );
  check(
    "admin api: sourcing run safe error response",
    route.includes("sourcingErrorResponse") &&
      route.includes("SOURCING_RUN_FAILED") &&
      route.includes("message.slice(0, 300)") &&
      route.includes("catch (error)") &&
      route.includes("return sourcingErrorResponse(error)"),
    "admin sourcing API returns bounded JSON errors when run lookup or execution fails",
    "required"
  );
}

if (fileExists("app/api/admin/prices/backfill/route.ts")) {
  const priceRoute = readText("app/api/admin/prices/backfill/route.ts");
  check(
    "admin api: price backfill safe error response",
    priceRoute.includes("priceBackfillErrorResponse") &&
      priceRoute.includes("PRICE_BACKFILL_FAILED") &&
      priceRoute.includes("message.slice(0, 300)") &&
      priceRoute.includes("needs_review_missing_naver_lowest_price") &&
      priceRoute.includes("catch (error)") &&
      priceRoute.includes("return priceBackfillErrorResponse(error)"),
    "admin price backfill API returns bounded JSON errors and candidate-missing summary when summary or execution fails",
    "required"
  );
}

if (fileExists("app/api/admin/products/route.ts")) {
  const productsRoute = readText("app/api/admin/products/route.ts");
  check(
    "admin api: product list safe error response",
    productsRoute.includes("adminProductsErrorResponse") &&
      productsRoute.includes("ADMIN_PRODUCTS_FAILED") &&
      productsRoute.includes("message.slice(0, 300)") &&
      productsRoute.includes("catch (error)") &&
      productsRoute.includes("return adminProductsErrorResponse(error)"),
    "admin product list API returns bounded JSON errors when product lookup fails",
    "required"
  );
}

if (fileExists("app/api/admin/metrics/route.ts") && fileExists("app/api/admin/revenue-metrics/route.ts")) {
  const metricsRoute = readText("app/api/admin/metrics/route.ts");
  const revenueMetricsRoute = readText("app/api/admin/revenue-metrics/route.ts");
  check(
    "admin api: metrics safe error response",
    metricsRoute.includes("ADMIN_METRICS_FAILED") &&
      metricsRoute.includes("adminMetricsErrorResponse") &&
      revenueMetricsRoute.includes("REVENUE_METRICS_FAILED") &&
      revenueMetricsRoute.includes("revenueMetricsErrorResponse"),
    "admin operational and revenue metrics APIs return bounded JSON errors when lookup fails",
    "required"
  );
}

if (fileExists("app/api/admin/products/[id]/route.ts")) {
  const productRoute = readText("app/api/admin/products/[id]/route.ts");
  check(
    "admin api: affiliate required for publish",
    productRoute.includes("AFFILIATE_URL_REQUIRED_FOR_PUBLISH") && productRoute.includes("isUsableAffiliateUrl"),
    "server blocks publishing products without usable affiliate links",
    "required"
  );
  check(
    "admin api: approval sample link blocked for publish",
    productRoute.includes("APPROVAL_SAMPLE_LINK_NOT_ALLOWED_FOR_PUBLISH") &&
      productRoute.includes("isApprovalSampleAffiliateUrl") &&
      productRoute.includes("/products/approval-sample 전용"),
    "server blocks reusing the approval sample affiliate link on real published products",
    "required"
  );
  check(
    "admin api: approval sample link blocked for save",
    productRoute.includes('"affiliate_url" in body') &&
      productRoute.includes("APPROVAL_SAMPLE_LINK_NOT_ALLOWED_FOR_PRODUCT") &&
      productRoute.includes("실상품에는 상품별 파트너스 링크를 저장하세요"),
    "server blocks saving the approval sample affiliate link on real products before it can become bad inventory",
    "required"
  );
  check(
    "admin api: invalid affiliate url blocked for save",
    productRoute.includes("INVALID_AFFILIATE_URL_FOR_PRODUCT") &&
      productRoute.includes("invalidAffiliateUrlMessage") &&
      productRoute.includes("일반 쿠팡 상품 URL은 affiliate_url에 저장할 수 없습니다") &&
      productRoute.includes("nextPublishedStatus") &&
      productRoute.includes("current.sourcing_status") &&
      productRoute.includes("hasAffiliateUrlPatch ? patch.affiliate_url : current.affiliate_url"),
    "server blocks regular Coupang URLs or invalid affiliate_url values and prevents clearing a published CTA link",
    "required"
  );
  check(
    "admin api: product mutation safe error response",
    productRoute.includes("productMutationErrorResponse") &&
      productRoute.includes("ADMIN_PRODUCT_MUTATION_FAILED") &&
      productRoute.includes("message.slice(0, 300)") &&
      productRoute.includes("catch (error)") &&
      productRoute.includes("return productMutationErrorResponse(error)"),
    "admin product detail and mutation API returns bounded JSON errors for unexpected failures",
    "required"
  );
  check(
    "admin api: customer-ready publish gate",
    productRoute.includes("getCustomerPublishReadiness") &&
      productRoute.includes("PUBLIC_QUALITY_BLOCKERS_FOR_PUBLISH") &&
      productRoute.includes("projectProductForPublishCheck") &&
      productRoute.includes("publicQualityBlockResponse") &&
      productRoute.includes("게시 전 ${blockers") &&
      productRoute.includes("qualityBlock"),
    "server-side product publish blocks public quality issues even when the admin UI is bypassed",
    "required"
  );
}

if (fileExists("components/AdminOpsDashboard.tsx")) {
  const opsDashboard = readText("components/AdminOpsDashboard.tsx");
  const dataStore = fileExists("lib/dataStore.ts") ? readText("lib/dataStore.ts") : "";
  check(
    "admin: ops dashboard feedback",
    opsDashboard.includes("notice") &&
      opsDashboard.includes('id="admin-ops-dashboard"') &&
      opsDashboard.includes("role=\"status\"") &&
      opsDashboard.includes("운영 지표를 불러오지 못했습니다") &&
      opsDashboard.includes("수익 퍼널을 불러오지 못했습니다") &&
      opsDashboard.includes("네트워크 문제로 운영 지표를 불러오지 못했습니다"),
    "admin ops dashboard shows metrics, revenue metrics, and network failures inline",
    "required"
  );
  check(
    "admin: ops dashboard public-ready metrics",
    opsDashboard.includes("publishedStatusCount") &&
      opsDashboard.includes("공개 가능") &&
      opsDashboard.includes("공개 보강 대기") &&
      opsDashboard.includes("실제 사용자 화면에 보이는 공개 가능 상품") &&
      opsDashboard.includes("고객공개 품질 블로커") &&
      opsDashboard.includes("상품별 링크 보강") &&
      opsDashboard.includes("품질 보강 대기") &&
      opsDashboard.includes("링크 보강 큐로 이동") &&
      opsDashboard.includes("품질 보강 후보로 이동") &&
      opsDashboard.includes("scrollToAdminAnchor(\"admin-affiliate-links\")") &&
      opsDashboard.includes("openAdminCandidateQueue(\"public_repair\")") &&
      opsDashboard.includes("공개 목록과 텔레그램 발송에서 숨겨집니다"),
    "admin dashboard separates truly visible public deals from published products missing links or quality readiness and links directly to repair queues",
    "required"
  );
  check(
    "admin: ops revenue recovery plan",
    opsDashboard.includes("수익 회복 플랜") &&
      opsDashboard.includes("Revenue Recovery") &&
      opsDashboard.includes("primaryRecoveryAction") &&
      opsDashboard.includes("상품별 파트너스 링크 보강") &&
      opsDashboard.includes("공개 품질 보강") &&
      opsDashboard.includes("검토 대기 후보 처리") &&
      opsDashboard.includes("텔레그램 유입 시작") &&
      opsDashboard.includes("openAdminCandidateQueue(\"review\")") &&
      opsDashboard.includes("admin-telegram-distribution"),
    "admin ops dashboard ranks the next revenue recovery action and sends operators to the exact repair queue",
    "required"
  );
  check(
    "admin: ops dashboard cta placement metrics",
    opsDashboard.includes("channelMetrics") &&
      opsDashboard.includes("CTA 위치별 클릭") &&
      opsDashboard.includes("channelLabel") &&
      opsDashboard.includes("web_detail_hero") &&
      opsDashboard.includes("web_detail_mobile_sticky") &&
      dataStore.includes("channelMetrics") &&
      dataStore.includes("b.affiliate_clicks - a.affiliate_clicks"),
    "admin revenue dashboard shows which explicit detail-page CTA placement generates Coupang clicks",
    "required"
  );
  check(
    "admin: acquisition source conversion metrics",
    opsDashboard.includes("sourceMetrics") &&
      opsDashboard.includes("sourceLabel") &&
      opsDashboard.includes("유입 채널별 전환") &&
      opsDashboard.includes("네이버 블로그") &&
      opsDashboard.includes("상세 → 쿠팡") &&
      dataStore.includes("function attributionSource") &&
      dataStore.includes('return "direct"') &&
      dataStore.includes("sourceMetrics") &&
      dataStore.includes("affiliate_ctr: ratio(affiliateClicks, detailViews)"),
    "admin revenue dashboard separates acquisition-source conversion from CTA placement metrics",
    "required"
  );
  check(
    "admin: conversion recovery opportunities",
    opsDashboard.includes("admin-revenue-opportunities") &&
      opsDashboard.includes("conversionOpportunities") &&
      opsDashboard.includes("상세 방문 후 멈춘 상품") &&
      dataStore.includes("conversionOpportunities") &&
      dataStore.includes("item.detail_views > 0") &&
      dataStore.includes("item.affiliate_clicks === 0"),
    "admin revenue dashboard exposes detail-without-click recovery candidates",
    "required"
  );
}

if (fileExists("components/AdminCandidateTable.tsx")) {
  const candidateTable = readText("components/AdminCandidateTable.tsx");
  const adminNavigation = fileExists("lib/adminNavigation.ts") ? readText("lib/adminNavigation.ts") : "";
  const quality = fileExists("lib/quality.ts") ? readText("lib/quality.ts") : "";
  check(
    "admin: publish button requires affiliate",
    candidateTable.includes("상품별 파트너스 링크 필요") &&
      candidateTable.includes("isApprovalSampleAffiliateUrl") &&
      candidateTable.includes("publishReady") &&
      (candidateTable.includes("disabled={!publishReady}") || candidateTable.includes("disabled={!publishReady || actionProductId === product.id}")),
    "admin publish button is disabled until a non-sample product affiliate link is ready",
    "required"
  );
  check(
    "admin: candidate table feedback",
    candidateTable.includes("notice") &&
      candidateTable.includes("!response.ok") &&
      candidateTable.includes("role=\"status\"") &&
      candidateTable.includes("네트워크 문제로 후보 목록을 불러오지 못했습니다") &&
      candidateTable.includes("네트워크 문제로 후보 상태를 변경하지 못했습니다"),
    "admin candidate table shows product-list, metrics, action, and network failures inline",
    "required"
  );
  check(
    "admin: candidate review anchor",
    candidateTable.includes('id="admin-candidate-review"') && candidateTable.includes("scroll-mt-4"),
    "admin candidate review queue has a stable anchor for post-launch handoff",
    "required"
  );
  check(
    "admin: candidate publish-ready fast filter",
    candidateTable.includes("publishReadyOnly") &&
      candidateTable.includes("바로 게시 가능") &&
      candidateTable.includes("게시 가능만 보기") &&
      candidateTable.includes("showPublishReadyQueue") &&
      candidateTable.includes("setMissingAffiliateOnly(false)") &&
      candidateTable.includes("reviewStats.publishReadyCount"),
    "admin candidate review queue can focus on product-level affiliate-ready deals first",
    "required"
  );
  check(
    "admin: candidate public repair fast filter",
    candidateTable.includes("publicBlockedOnly") &&
      candidateTable.includes("isPublishedPublicBlocked") &&
      candidateTable.includes("showPublicRepairQueue") &&
      candidateTable.includes("공개 보강 대기") &&
      candidateTable.includes("공개 보강 대기만 보기") &&
      candidateTable.includes("게시됐지만 고객 화면 숨김") &&
      candidateTable.includes('setStatus("published")'),
    "admin candidate review queue can focus on published products hidden by customer-facing quality rules",
    "required"
  );
  check(
    "admin: cross-panel candidate queue handoff",
    adminNavigation.includes("ADMIN_CANDIDATE_QUEUE_EVENT") &&
      adminNavigation.includes("openAdminCandidateQueue") &&
      adminNavigation.includes("returnpick_admin_candidate_queue") &&
      candidateTable.includes("ADMIN_CANDIDATE_QUEUE_EVENT") &&
      candidateTable.includes("applyCandidateQueue") &&
      candidateTable.includes("publish_ready") &&
      candidateTable.includes("affiliate_backfill") &&
      candidateTable.includes("public_repair") &&
      candidateTable.includes("window.addEventListener(ADMIN_CANDIDATE_QUEUE_EVENT"),
    "admin recovery CTAs can open the candidate table with the intended review, publish-ready, affiliate-backfill, or public-repair filter",
    "required"
  );
  check(
    "admin: customer-ready publish gate",
    candidateTable.includes("getCustomerPublishReadiness") &&
      candidateTable.includes("isCustomerPublishReady") &&
      candidateTable.includes("링크와 공개 품질 블로커 없음") &&
      candidateTable.includes("고객공개 준비") &&
      quality.includes("상품 이미지 확인 필요") &&
      quality.includes("quality.blockers") &&
      candidateTable.includes("게시 전 ${publishReadiness.blockers"),
    "admin bulk and one-click publishing only targets customer-ready deals without public quality blockers",
    "required"
  );
  check(
    "admin: candidate bulk publish ready selection",
    candidateTable.includes("selectedProductIds") &&
      candidateTable.includes("selectedPublishReady") &&
      candidateTable.includes("toggleAllPublishReadyFiltered") &&
      candidateTable.includes("publishSelectedReady") &&
      candidateTable.includes("선택 승인+게시") &&
      candidateTable.includes("게시 가능 전체 선택") &&
      candidateTable.includes('JSON.stringify({ action: "publish" })'),
    "admin candidate review queue can publish selected product-level affiliate-ready deals in one explicit operator action",
    "required"
  );
  check(
    "admin: candidate post-publish telegram handoff",
    candidateTable.includes("publishedActionCount") &&
      candidateTable.includes("scrollToTelegramDistribution") &&
      candidateTable.includes("admin-telegram-distribution") &&
      candidateTable.includes("텔레그램 후보 발송으로 이동"),
    "admin candidate review queue points operators to Telegram distribution after explicit publish actions",
    "required"
  );
}

if (fileExists("components/AdminAffiliateLinkQueue.tsx")) {
  const linkQueue = readText("components/AdminAffiliateLinkQueue.tsx");
  check(
    "admin: affiliate link queue",
    linkQueue.includes("상품별 파트너스 링크 보강") && linkQueue.includes("buildCoupangSearchUrl") && linkQueue.includes("저장 후 게시") && linkQueue.includes("/api/admin/affiliate-links/backfill") && linkQueue.includes('id="admin-affiliate-links"'),
    "admin can find products, paste product-level affiliate links, publish after saving, and run API backfill",
    "required"
  );
  check(
    "admin: affiliate link queue feedback",
    linkQueue.includes("notice") &&
      linkQueue.includes("role=\"status\"") &&
      linkQueue.includes("!response.ok") &&
      linkQueue.includes("backfillMessage") &&
      linkQueue.includes("네트워크 문제로 API 기반 파트너스 링크 보강을 실행하지 못했습니다") &&
      linkQueue.includes("네트워크 문제로 파트너스 링크를 저장하지 못했습니다"),
    "affiliate link queue shows load, save, API backfill, and network failures inline",
    "required"
  );
  check(
    "admin: affiliate link queue blocks approval sample",
    linkQueue.includes("isApprovalSampleAffiliateUrl") &&
      linkQueue.includes("승인용 샘플 링크는 심사용 페이지 전용") &&
      linkQueue.includes("저장하거나 게시할 수 없습니다"),
    "affiliate link queue prevents saving or publishing the approval sample link for real products",
    "required"
  );
  check(
    "admin: bulk affiliate link import UI",
    linkQueue.includes("대량 링크 입력") &&
      linkQueue.includes("템플릿 복사") &&
      linkQueue.includes("/api/admin/affiliate-links/import") &&
      linkQueue.includes("검증만") &&
      linkQueue.includes("대량 저장 후 게시") &&
      linkQueue.includes("상품 ID") &&
      linkQueue.includes("한 번에 최대 80줄"),
    "admin can validate, save, or save-and-publish many product-level affiliate links at once from product-id templates",
    "required"
  );
  check(
    "admin: affiliate link result readability",
    linkQueue.includes("linkResultStatusLabel") &&
      linkQueue.includes("linkResultReasonLabel") &&
      linkQueue.includes("API 키 필요") &&
      linkQueue.includes("저장 완료") &&
      linkQueue.includes("쿠팡 검색에서 매칭 상품을 찾지 못했습니다") &&
      linkQueue.includes("상품별 쿠팡 파트너스 단축 링크 형식이 아닙니다") &&
      linkQueue.includes("링크는 저장했지만 게시 전 품질 확인이 필요합니다"),
    "affiliate link queue translates API/import item statuses and reasons into readable operator guidance",
    "required"
  );
  check(
    "admin: bulk publish identity accounting",
    linkQueue.includes("AFFILIATE_IDENTITY_VERIFICATION_REQUIRED") &&
      linkQueue.includes("identity_pending_count") &&
      linkQueue.includes("published_count ?? 0") &&
      linkQueue.includes("목적지 확인 필요") &&
      linkQueue.includes("저장된 링크는 각 상품 행에서 링크 확인을 실행한 뒤에만 게시할 수 있습니다"),
    "bulk save-and-publish results distinguish saved links from links still waiting for destination identity verification",
    "required"
  );
  check(
    "admin: verified affiliate bulk publish handoff",
    linkQueue.includes("verifiedVisibleProducts") &&
      linkQueue.includes("publishVerifiedVisibleLinks") &&
      linkQueue.includes("확인된 링크") &&
      linkQueue.includes("품질 게이트와 함께 게시하는 중입니다") &&
      linkQueue.includes("identity_status === \"MATCH\"") &&
      linkQueue.includes("MANUAL_CONFIRMED"),
    "admin can explicitly publish only links whose product identity was already matched or manually confirmed, while reusing the public quality gate",
    "required"
  );
  check(
    "admin: affiliate link queue verifies pending links first",
    linkQueue.includes("pendingVerificationVisibleProducts") &&
      linkQueue.includes("verification?.checked_url !== affiliateUrl") &&
      linkQueue.includes("pendingVerificationVisibleProducts.slice(0, MAX_BULK_LINK_CHECKS)") &&
      linkQueue.includes("미확인 링크"),
    "affiliate link queue advances through visible pasted links without rechecking already verified entries, while retaining per-row rechecks",
    "required"
  );
  check(
    "admin: affiliate link queue paginates large queues",
    linkQueue.includes("LINK_QUEUE_PAGE_SIZE = 24") &&
      linkQueue.includes("totalQueuePages") &&
      linkQueue.includes("링크 보강 대상") &&
      linkQueue.includes("onClick={() => setQueuePage(Math.max(0, currentQueuePage - 1))") &&
      linkQueue.includes("onClick={() => setQueuePage(Math.min(totalQueuePages - 1, currentQueuePage + 1))"),
    "affiliate-link queue exposes every pending product through explicit page navigation instead of silently hiding rows after the first 24",
    "required"
  );
  check(
    "admin: affiliate backfill manual retry links",
    linkQueue.includes("backfillResultLinks") &&
      linkQueue.includes("manual_search_url") &&
      linkQueue.includes("쿠팡 검색 열기") &&
      linkQueue.includes("검색어") &&
      linkQueue.includes("원본 보기"),
    "automatic affiliate-link backfill results expose the attempted Coupang query and safe manual retry links",
    "required"
  );
  check(
    "admin: affiliate backfill match evidence",
    linkQueue.includes("BackfillMatchEvidence") &&
      linkQueue.includes("backfillMatchSummary") &&
      linkQueue.includes("matched_tokens") &&
      linkQueue.includes("관련도 제외") &&
      linkQueue.includes("COUPANG_MATCH_RELEVANCE_TOO_LOW"),
    "automatic affiliate-link backfill results show relevance scores, matched tokens, and rejected candidate counts",
    "required"
  );
  check(
    "admin: affiliate backfill failure bulk handoff",
    linkQueue.includes("fillBackfillFailuresTemplate") &&
      linkQueue.includes("buildBackfillManualTemplate") &&
      linkQueue.includes("실패") &&
      linkQueue.includes("대량 입력으로 보내기") &&
      linkQueue.includes("상품별 파트너스 링크 붙여넣기") &&
      linkQueue.includes("검색 URL은 참고용입니다"),
    "operators can turn failed automatic affiliate-link backfill items into a bulk manual import template",
    "required"
  );
}

if (fileExists("lib/affiliateLinkBackfill.ts")) {
  const affiliateBackfill = readText("lib/affiliateLinkBackfill.ts");
  check(
    "affiliate backfill: API deeplink",
    affiliateBackfill.includes("backfillCoupangAffiliateLinks") && affiliateBackfill.includes("searchCoupangProducts") && affiliateBackfill.includes("createCoupangDeeplink"),
    "existing missing-affiliate products can be converted through Coupang search and deeplink APIs after approval",
    "required"
  );
  check(
    "affiliate backfill: destination identity verification",
    affiliateBackfill.includes("getAffiliateIdentityReadiness") &&
      affiliateBackfill.includes("verifyCoupangAffiliateLinkResolution") &&
      affiliateBackfill.includes("assessAffiliateIdentity") &&
      affiliateBackfill.includes("mergeAffiliateIdentityRecord") &&
      affiliateBackfill.includes("affiliate_verification_response"),
    "successful product links record a verified Coupang destination before the public quality gate can expose them",
    "required"
  );
  check(
    "affiliate backfill: direct deeplink fallback",
    affiliateBackfill.includes("directDeeplinkFailureReason") &&
      affiliateBackfill.includes("DIRECT_DEEPLINK_FAILED") &&
      affiliateBackfill.includes("combineBackfillReasons") &&
      affiliateBackfill.includes('if (deeplink.status === "ok" && isUsableAffiliateUrl(deeplink.url))') &&
      affiliateBackfill.includes('if (deeplink.status === "API_NOT_CONFIGURED")'),
    "automatic affiliate-link backfill falls back to Coupang search when a stored product URL cannot be deeplinked",
    "required"
  );
  check(
    "affiliate backfill: per-item update failure isolation",
    affiliateBackfill.includes("backfillErrorMessage") &&
      affiliateBackfill.includes("AFFILIATE_BACKFILL_UPDATE_FAILED") &&
      affiliateBackfill.includes("continue;") &&
      affiliateBackfill.includes("result.error_count += 1") &&
      affiliateBackfill.includes("await updateProduct(product.id"),
    "a single product save failure is reported on that item while the automatic affiliate-link backfill continues",
    "required"
  );
  check(
    "affiliate backfill: manual retry details",
    affiliateBackfill.includes("query?: string | null") &&
      affiliateBackfill.includes("manual_search_url?: string | null") &&
      affiliateBackfill.includes("const manualSearchUrl = buildCoupangSearchUrl(product)") &&
      affiliateBackfill.includes("manual_search_url: resolved.manualSearchUrl") &&
      affiliateBackfill.includes("query: resolved.query"),
    "affiliate-link backfill returns attempted Coupang search details when API configuration or product matching needs manual follow-up",
    "required"
  );
  check(
    "affiliate backfill: search result relevance guard",
    affiliateBackfill.includes("buildAffiliateBackfillRelevanceTokens") &&
      affiliateBackfill.includes("affiliateItemRelevance") &&
      affiliateBackfill.includes("MATCH_RELEVANCE_TOO_LOW") &&
      affiliateBackfill.includes("COUPANG_MATCH_RELEVANCE_TOO_LOW") &&
      affiliateBackfill.includes("rejected_by_relevance_count") &&
      affiliateBackfill.includes("relevance_tokens") &&
      affiliateBackfill.includes("match: resolved.match ?? null"),
    "automatic affiliate-link backfill rejects weak Coupang search matches and stores matching evidence",
    "required"
  );
}

if (fileExists("app/api/admin/affiliate-links/backfill/route.ts")) {
  const affiliateBackfillRoute = readText("app/api/admin/affiliate-links/backfill/route.ts");
  check(
    "admin api: affiliate backfill route",
    affiliateBackfillRoute.includes("requireAdmin") && affiliateBackfillRoute.includes("backfillCoupangAffiliateLinks"),
    "admin-protected route runs the Coupang affiliate link backfill",
    "required"
  );
  check(
    "admin api: affiliate backfill safe error response",
    affiliateBackfillRoute.includes("affiliateBackfillErrorResponse") &&
      affiliateBackfillRoute.includes("AFFILIATE_BACKFILL_FAILED") &&
      affiliateBackfillRoute.includes("message.slice(0, 300)") &&
      affiliateBackfillRoute.includes("positiveInteger") &&
      affiliateBackfillRoute.includes("return affiliateBackfillErrorResponse(error)"),
    "admin affiliate-link backfill API returns bounded JSON errors and clamps requested limits",
    "required"
  );
}

if (fileExists("app/api/admin/affiliate-links/import/route.ts")) {
  const affiliateImportRoute = readText("app/api/admin/affiliate-links/import/route.ts");
  check(
    "admin api: bulk affiliate link import route",
    affiliateImportRoute.includes("requireAdmin") &&
      affiliateImportRoute.includes("BULK_AFFILIATE_LINK_IMPORT_FAILED") &&
      affiliateImportRoute.includes("getProductById") &&
      affiliateImportRoute.includes("updateProduct") &&
      affiliateImportRoute.includes("isUsableAffiliateUrl") &&
      affiliateImportRoute.includes("isApprovalSampleAffiliateUrl") &&
      affiliateImportRoute.includes("getCoupangPartnersLinkIssue") &&
      affiliateImportRoute.includes("dryRun") &&
      affiliateImportRoute.includes("publish_requested") &&
      affiliateImportRoute.includes("published_count") &&
      affiliateImportRoute.includes("identity_pending_count") &&
      affiliateImportRoute.includes("AFFILIATE_IDENTITY_VERIFICATION_REQUIRED") &&
      affiliateImportRoute.includes('sourcing_status: "published"') &&
      affiliateImportRoute.includes(".slice(0, 80)"),
    "admin-protected bulk import route validates, updates, or publishes only product-id matched, non-sample Coupang Partners links and clamps batch size",
    "required"
  );
  check(
    "admin api: bulk import customer-ready publish gate",
    affiliateImportRoute.includes("getCustomerPublishReadiness") &&
      affiliateImportRoute.includes("PUBLISH_BLOCKED_PUBLIC_QUALITY") &&
      affiliateImportRoute.includes("readiness.blockers") &&
      affiliateImportRoute.includes('await updateProduct(productId, { affiliate_url: affiliateUrl })') &&
      affiliateImportRoute.includes("publishBlockedCount") &&
      affiliateImportRoute.includes("publishedCount += 1"),
    "bulk link import saves valid links but does not publish products before identity or public quality checks",
    "required"
  );
}

if (fileExists("app/api/admin/launch/route.ts")) {
  const launchRoute = readText("app/api/admin/launch/route.ts");
  check(
    "admin api: post-approval launch route",
    launchRoute.includes("runSourcing") &&
      launchRoute.includes("backfillCoupangAffiliateLinks") &&
      launchRoute.includes("backfillNaverLowestPrices") &&
      launchRoute.includes("launchReady") &&
      launchRoute.includes("runApiConnectionChecks") &&
      launchRoute.includes("connection_checks") &&
      launchRoute.includes("readiness.requiredConnectionCheckIds"),
    "admin can run a bounded first-launch sequence only after production envs, live connections, public data quality, and Cron auth are ready",
    "required"
  );
  check(
    "admin api: launch required connection check completeness",
    launchRoute.includes("missingRequiredConnectionCheckIds") &&
      launchRoute.includes("MISSING_REQUIRED_CONNECTION_CHECK") &&
      launchRoute.includes("missing_required_connection_check_ids") &&
      launchRoute.includes("requiredConnectionCheckIds.filter"),
    "first launch fails closed when a required live connection check is missing from the readiness response",
    "required"
  );
  check(
    "admin api: optional integration failures do not block core launch",
    launchRoute.includes("hasBlockingLaunchError") &&
      launchRoute.includes("blocking: false") &&
      launchRoute.includes("optionalConnectionCheckIds") &&
      launchRoute.includes("네이버와 텔레그램은 설정된 경우 별도 기능으로 동작합니다."),
    "first launch can confirm after core checks even when Naver backfill or Telegram delivery is not configured",
    "required"
  );
  check(
    "admin api: launch operator actions",
    launchRoute.includes("getReadinessBlockingActions") &&
      launchRoute.includes("getConnectionFailureActions") &&
      launchRoute.includes("blocking_items") &&
      launchRoute.includes("failed_connection_checks") &&
      launchRoute.includes("operator_next_action"),
    "first-launch not-ready and connection-failure responses include operator next actions",
    "required"
  );
  check(
    "admin api: launch before-after delta",
    launchRoute.includes("before_summary") && launchRoute.includes("delta_summary") && launchRoute.includes("deltaSummary"),
    "post-approval launch response includes before/after summaries and per-run deltas",
    "required"
  );
  check(
    "admin api: launch batch controls",
    launchRoute.includes("sourcingTimeBudgetMs") &&
      launchRoute.includes("positiveInteger(body.sourcingKeywordLimit, 6, 12)") &&
      launchRoute.includes("positiveInteger(body.affiliateLimit, 8, 20)") &&
      launchRoute.includes("positiveInteger(body.priceLimit, 5, 12)"),
    "post-approval launch can run a practical first batch while staying bounded",
    "required"
  );
  check(
    "admin api: first-launch marker precedes enrichment",
    launchRoute.includes("LAUNCH_RESPONSE_BUDGET_MS") &&
      launchRoute.includes("enrichmentBudget") &&
      launchRoute.includes("timeBudgetMs: affiliateTimeBudgetMs") &&
      launchRoute.includes("timeBudgetMs: naverTimeBudgetMs") &&
      launchRoute.indexOf("markFirstLaunchConfirmed") < launchRoute.indexOf("backfillCoupangAffiliateLinks({ limit") &&
      launchRoute.indexOf("markFirstLaunchConfirmed") < launchRoute.indexOf("backfillNaverLowestPrices({ publishedOnly") &&
      readText("lib/affiliateLinkBackfill.ts").includes("timed_out") &&
      readText("lib/naverPriceBackfill.ts").includes("timeBudgetMs"),
    "first-launch confirmation is persisted before bounded affiliate and Naver enrichment can time out",
    "required"
  );
  check(
    "admin api: first-launch confirmation",
    launchRoute.includes("markFirstLaunchConfirmed") &&
      launchRoute.includes("launch_confirmed") &&
      launchRoute.includes("자동 운영 시작 확인"),
    "successful post-approval first launch records a confirmation before scheduled jobs can run",
    "required"
  );
  check(
    "admin api: first-launch confirmation failure is actionable",
    launchRoute.includes("FIRST_LAUNCH_CONFIRMATION_FAILED") &&
      launchRoute.includes("finalHasError") &&
      launchRoute.includes("자동 운영 시작 확인 기록을 저장하지 못했습니다") &&
      launchRoute.includes("Supabase sourcing_runs 쓰기 권한"),
    "first-launch confirmation write failures return an actionable step result instead of erasing prior launch progress with a generic 500",
    "required"
  );
  check(
    "admin api: first-launch data signal gate",
    launchRoute.includes("getLaunchDataSignal") &&
      launchRoute.includes("NO_LAUNCH_DATA_SIGNAL") &&
      launchRoute.includes("isPublicDealReady") &&
      launchRoute.includes("published_public_ready") &&
      launchRoute.includes("launch_data_signal") &&
      launchRoute.includes("current_launch_progress") &&
      launchRoute.includes("existing_public_affiliate_ready") &&
      launchRoute.includes("existing_public_customer_ready") &&
      launchRoute.includes("getLaunchRecoveryActions") &&
      launchRoute.includes("recovery_actions") &&
      launchRoute.includes("operator_next_action") &&
      launchRoute.includes("admin-affiliate-links") &&
      launchRoute.includes("admin-price-backfill") &&
      launchRoute.includes("admin-sourcing-runner"),
    "first launch is not confirmed when live connections pass but no candidate, link, price, or customer-ready public data signal exists, and returns concrete recovery actions",
    "required"
  );
  check(
    "admin api: launch safe error response",
    launchRoute.includes("launchErrorResponse") &&
      launchRoute.includes("LAUNCH_RUN_FAILED") &&
      launchRoute.includes("message.slice(0, 300)") &&
      launchRoute.includes("catch (error)") &&
      launchRoute.includes("return launchErrorResponse(error)"),
    "post-approval launch route returns bounded JSON errors if preflight or summary lookup throws",
    "required"
  );
}

if (fileExists("lib/launchState.ts")) {
  const launchState = readText("lib/launchState.ts");
  check(
    "launch state: first-launch marker",
    launchState.includes("FIRST_LAUNCH_CONFIRMED_STATUS") &&
      launchState.includes("FIRST_LAUNCH_MARKER") &&
      launchState.includes("getFirstLaunchConfirmation") &&
      launchState.includes("markFirstLaunchConfirmed"),
    "first-launch completion is recorded in sourcing_runs as an operational marker",
    "required"
  );
}

if (fileExists("lib/sourcingRunKinds.ts")) {
  const sourcingRunKinds = readText("lib/sourcingRunKinds.ts");
  check(
    "sourcing runs: shared operational marker filter",
    sourcingRunKinds.includes("FIRST_LAUNCH_CONFIRMED_STATUS") &&
      sourcingRunKinds.includes("FIRST_LAUNCH_MARKER") &&
      sourcingRunKinds.includes("isFirstLaunchConfirmationRun") &&
      sourcingRunKinds.includes("isSourcingExecutionRun"),
    "sourcing run marker filtering is shared across cursor, metrics, and admin views",
    "required"
  );
}

if (fileExists("components/AdminLaunchRunner.tsx")) {
  const launchRunner = readText("components/AdminLaunchRunner.tsx");
  check(
    "admin: post-approval launch runner",
    launchRunner.includes("승인 후 첫 가동 실행") && launchRunner.includes("/api/admin/launch") && launchRunner.includes("첫 가동 실행"),
    "admin exposes the first-launch sequence as a clear operator action",
    "required"
  );
  check(
    "admin: launch delta display",
    launchRunner.includes("delta_summary") && launchRunner.includes("이번 실행 변화"),
    "admin launch panel shows what changed during the first-launch run",
    "required"
  );
  check(
    "admin: launch step detail display",
    launchRunner.includes("formatLaunchDetailValue") &&
      launchRunner.includes("launchDetailEntries") &&
      launchRunner.includes("실행 세부정보") &&
      launchRunner.includes("operatorNextActionFromLaunchDetail") &&
      launchRunner.includes("단계 다음 조치") &&
      launchRunner.includes('key !== "operator_next_action"'),
    "admin launch panel shows per-step details for connection checks, sourcing, affiliate backfill, and price backfill",
    "required"
  );
  check(
    "admin: launch batch presets",
    launchRunner.includes("launchPresets") &&
      launchRunner.includes('"standard"') &&
      launchRunner.includes('"wide"') &&
      launchRunner.includes('"quick"') &&
      launchRunner.includes("sourcingTimeBudgetMs"),
    "admin can choose quick, standard, or wider first-launch batches after approval",
    "required"
  );
  check(
    "admin: launch run feedback",
    launchRunner.includes("notice") &&
      launchRunner.includes("data.message ?? data.error") &&
      launchRunner.includes("네트워크 문제로 첫 가동 실행을 시작하지 못했습니다") &&
      launchRunner.includes("role=\"status\"") &&
      !launchRunner.includes("window.alert"),
    "admin launch runner shows API and network failures inline instead of using alert dialogs",
    "required"
  );
  check(
    "admin: launch next action guidance",
    launchRunner.includes("getLaunchNextAction") &&
      launchRunner.includes("Next Action") &&
      launchRunner.includes("setResult(null)") &&
      launchRunner.includes("다음 조치: 준비도 패널에서 누락 환경변수를 채우세요") &&
      launchRunner.includes("다음 조치: 실제 연결 테스트 실패 카드를 먼저 고치세요") &&
      launchRunner.includes("다음 조치: 키워드 범위를 넓혀 첫 실데이터 신호를 만드세요") &&
      launchRunner.includes("다음 조치: 첫 가동 확인 기록을 다시 남기세요"),
    "admin launch runner clears stale results and shows the next operator action after first-launch outcomes",
    "required"
  );
  check(
    "admin: launch blocking action display",
    launchRunner.includes("blockingItems") &&
      launchRunner.includes("막힌 준비 항목과 바로 할 일") &&
      launchRunner.includes("failedConnectionChecks") &&
      launchRunner.includes("실패한 연결 테스트 조치"),
    "admin launch runner displays concrete fixes for blocked readiness and failed connection checks",
    "required"
  );
  check(
    "admin: launch to review handoff",
    launchRunner.includes("scrollToCandidateReviewQueue") &&
      launchRunner.includes("admin-candidate-review") &&
      launchRunner.includes("검토 대기 상품 보기") &&
      launchRunner.includes("needs_review"),
    "admin launch runner can send operators directly to the needs-review candidate queue after first launch",
    "required"
  );
  check(
    "admin: launch to scheduler handoff",
    launchRunner.includes("scrollToSchedulerControl") &&
      launchRunner.includes("admin-telegram-distribution") &&
      launchRunner.includes("자동 운영 센터 보기") &&
      launchRunner.includes('result.status === "completed"'),
    "admin launch runner can send operators to scheduler health and Telegram distribution after a confirmed first launch",
    "required"
  );
  check(
    "admin: first launch repair handoff",
    launchRunner.includes("scrollToAffiliateLinkQueue") &&
      launchRunner.includes("scrollToPriceBackfill") &&
      launchRunner.includes("scrollToSourcingRunner") &&
      launchRunner.includes("admin-affiliate-links") &&
      launchRunner.includes("admin-price-backfill") &&
      launchRunner.includes("admin-sourcing-runner") &&
      launchRunner.includes("파트너스 링크 보강") &&
      launchRunner.includes("네이버 가격 보강") &&
      launchRunner.includes("수집 진단 보기") &&
      launchRunner.includes("missingAffiliateCount") &&
      launchRunner.includes("missingNaverPriceCount"),
    "admin first-launch results send operators directly to affiliate-link, Naver price, or sourcing repair panels when launch gaps remain",
    "required"
  );
  check(
    "admin: first launch back to readiness handoff",
    launchRunner.includes('id="admin-first-launch"') &&
      launchRunner.includes("scrollToApiReadinessPanel") &&
      launchRunner.includes("scrollToAdminAnchor") &&
      launchRunner.includes("admin-api-readiness") &&
      launchRunner.includes("준비도 패널로 이동"),
    "admin first-launch runner can send operators back to readiness when envs or live checks block launch",
    "required"
  );
}

if (fileExists("components/AdminProductEditor.tsx")) {
  const productEditor = readText("components/AdminProductEditor.tsx");
  const productRoute = readText("app/api/admin/products/[id]/route.ts");
  const quality = readText("lib/quality.ts");
  check(
    "admin: no approval link bulk misuse",
    !productEditor.includes("승인용 파트너스 링크 채우기") && !productEditor.includes("NEXT_PUBLIC_COUPANG_APPROVAL_PRODUCT_URL"),
    "product editor does not encourage reusing the approval sample link for unrelated products",
    "required"
  );
  check(
    "admin: product editor warns on approval sample link",
    productEditor.includes("isApprovalSampleAffiliateUrl") &&
      productEditor.includes("승인용 샘플 링크입니다") &&
      productEditor.includes("실상품 게시에는 사용할 수 없습니다"),
    "product editor clearly warns when a real product uses the approval sample link",
    "required"
  );
  check(
    "admin: product editor surfaces save failures",
    productEditor.includes("saveNotice") &&
      productEditor.includes("!response.ok") &&
    productEditor.includes("data.message ?? data.error") &&
      productEditor.includes("role=\"status\"") &&
      productEditor.includes("저장 중"),
    "product editor shows API validation errors and network failures instead of silently refreshing",
    "required"
  );
  check(
    "admin: missing product image repair path",
    productEditor.includes("image_url") &&
      productEditor.includes("상품 이미지 URL") &&
      productEditor.includes("isUsableProductImageUrl") &&
      productEditor.includes("새 탭에서 이미지 확인") &&
      productRoute.includes('"image_url"') &&
      productRoute.includes("getProductImageUrlIssue") &&
      productRoute.includes("INVALID_IMAGE_URL_FOR_PRODUCT") &&
      quality.includes("isUsableProductImageUrl(product.image_url)") &&
      quality.includes("상품 이미지 URL 확인 필요"),
    "admin can safely repair a missing product image and unsafe image URLs cannot pass the public quality gate",
    "required"
  );
  check(
    "admin: atomic save and publish",
    productEditor.includes("getCustomerPublishReadiness") &&
      productEditor.includes("naver_price_confirmed: naverPriceConfirmed") &&
      productEditor.includes("저장 후 게시") &&
      productEditor.includes("게시 전 보강이 필요합니다") &&
      productEditor.includes("disabled={saving || !publishReady || (naverPriceNeedsConfirmation && !naverPriceConfirmed)}") &&
      productRoute.includes('if (action === "publish")') &&
      productRoute.includes("projectProductForPublishCheck") &&
      productRoute.includes("PUBLIC_QUALITY_BLOCKERS_FOR_PUBLISH"),
    "product editor can atomically save and publish only when the same customer quality gate is ready",
    "required"
  );
}

if (fileExists("lib/publicDeal.ts")) {
  const publicDeal = readText("lib/publicDeal.ts");
  check(
    "public deals: customer-ready only",
    publicDeal.includes("isDemoProduct") &&
      publicDeal.includes("isLocalDemoModeEnabled") &&
      publicDeal.includes('process.env.NODE_ENV === "production"') &&
      publicDeal.includes("!isDemoProduct(product)") &&
      publicDeal.includes("isPublicDealReady") &&
      publicDeal.includes("getCustomerPublishReadiness(product).ready") &&
      publicDeal.includes('product.sourcing_status === "published"'),
    "production deal surfaces require published customer-ready products, while synthetic fixtures are local-only",
    "required"
  );
}

if (fileExists("lib/publicDeal.ts") && fileExists("components/DemoModeNotice.tsx") && fileExists(".env.example")) {
  const publicDeal = readText("lib/publicDeal.ts");
  const demoNotice = readText("components/DemoModeNotice.tsx");
  const envExample = readText(".env.example");
  const homePage = readText("app/page.tsx");
  const dealsPage = readText("app/deals/page.tsx");
  check(
    "public UX: local demo catalog isolation",
    publicDeal.includes("isPublicDealVisible") &&
      publicDeal.includes("isDemoProduct") &&
      publicDeal.includes("isLocalDemoModeEnabled") &&
      publicDeal.includes('process.env.NODE_ENV === "production"') &&
      demoNotice.includes("구매 버튼은 비활성화되어 있습니다") &&
      envExample.includes("RETURNPICK_DEMO_MODE=") &&
      homePage.includes("DemoModeNotice") &&
      dealsPage.includes("DemoModeNotice"),
    "local UI fixtures are labelled and production cannot expose demo products or their purchase links",
    "required"
  );
}

if (fileExists("lib/quality.ts") && fileExists("components/DealDetail.tsx") && fileExists("components/PriceComparison.tsx")) {
  const quality = readText("lib/quality.ts");
  const dealDetail = readText("components/DealDetail.tsx");
  const priceComparison = readText("components/PriceComparison.tsx");
  check(
    "public deals: price-only return evidence mode",
    quality.includes('if (!dealPrice) blockers.push("판매 가격 확인 필요")') &&
      quality.includes('warnings.push("반품가 확인 필요")') &&
      quality.includes('warnings.push("반품등급 확인 필요")') &&
      quality.includes('return "현재 판매가"') &&
      dealDetail.includes("getDealPriceLabel(product)") &&
      dealDetail.includes("반품 정보가 확인되지 않은 항목은 쿠팡 상품 페이지에서 최종 확인하세요") &&
      priceComparison.includes("getDealPriceLabel(product)") &&
      priceComparison.includes("search.shopping.naver.com/search/all") &&
      priceComparison.includes("네이버에서 동일 모델 가격 확인") &&
      priceComparison.includes('target="_blank"') &&
      priceComparison.includes('rel="noopener noreferrer"'),
    "products with a verified selling price but missing return evidence can be published with explicit customer-facing warnings; products without any price remain blocked",
    "required"
  );
}

if (fileExists("lib/telegram.ts")) {
  const telegram = readText("lib/telegram.ts");
  check(
    "telegram: public customer-ready only",
    telegram.includes("isPublicDealReady(product)") &&
      telegram.includes("ONLY_PUBLIC_CUSTOMER_READY_PRODUCTS_CAN_BE_SENT") &&
      telegram.includes("getSiteUrl()"),
    "Telegram sends only public customer-ready products and uses the configured public site URL",
    "required"
  );
  check(
    "telegram: send timeout and safe error log",
    telegram.includes("TELEGRAM_SEND_TIMEOUT_MS") &&
      telegram.includes("AbortController") &&
      telegram.includes("telegramErrorMessage") &&
      telegram.includes("telegramSendFailureMessage") &&
      telegram.includes("createTelegramLog({ product_id: productId, target_type: target.type, target_key: target.key, message, status: \"error\", error: safeError })"),
    "Telegram send uses a bounded request and logs safe failure summaries for HTTP errors, network errors, and timeouts",
    "required"
  );
  check(
    "telegram: editorial first-sale campaign",
    telegram.includes("buildEditorialPickTelegramMessage") &&
      telegram.includes("sendTelegramEditorialPick") &&
      telegram.includes('type: "editorial_pick"') &&
      telegram.includes("approvalSampleProduct.editorialTelegramTarget") &&
      telegram.includes("TELEGRAM_EDITORIAL_COOLDOWN_MS") &&
      telegram.includes("TELEGRAM_CAMPAIGN_RECENTLY_SENT"),
    "the pre-API editorial campaign links to the disclosed ReturnPick detail, records a stable target, and rejects rapid duplicate sends",
    "required"
  );
  check(
    "telegram: message length guard",
    telegram.includes("TELEGRAM_MESSAGE_LIMIT") &&
      telegram.includes("fitTelegramMessage") &&
      telegram.includes("TELEGRAM_AFFILIATE_NOTICE") &&
      telegram.includes("return fitTelegramMessage(message, detailUrl)") &&
      telegram.includes("\uC81C\uD734 \uC548\uB0B4:") &&
      telegram.includes("\uC790\uC138\uD788 \uBCF4\uAE30:") &&
      telegram.includes("getDealPriceLabel") &&
      telegram.includes("getReturnEvidenceLabel") &&
      telegram.includes("\uCFE0\uD321 \uD30C\uD2B8\uB108\uC2A4 \uD65C\uB3D9\uC758 \uC77C\uD658"),
    "Telegram message generation stays below Telegram length limits while preserving readable Korean copy, detail URL, and affiliate notice",
    "required"
  );
}

if (fileExists("lib/editorialCampaign.ts")) {
  const editorialCampaign = readText("lib/editorialCampaign.ts");
  check(
    "editorial campaign: disclosed channel kit",
    editorialCampaign.includes("buildEditorialCampaignKit") &&
      editorialCampaign.includes("buildEditorialPickTelegramMessage") &&
      editorialCampaign.includes('trackedDetailUrl("telegram", "channel")') &&
      editorialCampaign.includes('trackedDetailUrl("naver_blog", "owned")') &&
      editorialCampaign.includes("utm_source=${source}&utm_medium=${medium}&utm_campaign=${CAMPAIGN_ID}") &&
      editorialCampaign.includes("[제휴 안내]") &&
      editorialCampaign.includes("쿠팡 파트너스 활동의 일환") &&
      editorialCampaign.includes("가격, 재고, 배송 조건은 구매 직전 쿠팡 페이지를 기준으로 확인하세요") &&
      editorialCampaign.includes("EDITORIAL_CAMPAIGN_LINK_NOT_CONFIGURED") &&
      !editorialCampaign.includes("https://link.coupang.com/"),
    "fixed Telegram and Naver Blog copy uses channel UTM links, visible disclosure, and no direct hidden affiliate destination",
    "required"
  );
}

if (fileExists("lib/format.ts")) {
  const format = readText("lib/format.ts");
  check(
    "format: readable Korean price placeholders",
    format.includes('return "\uD655\uC778\uD544\uC694"') && format.includes('toLocaleString("ko-KR")') && format.includes("}\uC6D0`"),
    "public and Telegram price copy uses readable Korean instead of mojibake placeholders",
    "required"
  );
}

if (fileExists("app/api/admin/telegram/route.ts")) {
  const telegramRoute = readText("app/api/admin/telegram/route.ts");
  check(
    "admin api: telegram preview readiness gate",
    telegramRoute.includes("TELEGRAM_PRODUCT_NOT_PUBLIC_READY") &&
      telegramRoute.includes("isPublicDealReady(product)") &&
      telegramRoute.includes("고객공개 품질 블로커"),
    "admin Telegram preview/send endpoints reject products that are not public customer-ready",
    "required"
  );
  check(
    "admin api: telegram safe error response",
    telegramRoute.includes("telegramAdminErrorResponse") &&
      telegramRoute.includes("TELEGRAM_ADMIN_FAILED") &&
      telegramRoute.includes("message.slice(0, 300)") &&
      telegramRoute.includes("INVALID_TELEGRAM_MODE"),
    "admin Telegram API returns bounded JSON errors and rejects invalid modes",
    "required"
  );
  check(
    "admin api: editorial Telegram target allowlist",
    telegramRoute.includes('body.campaign !== "editorial_pick"') &&
      telegramRoute.includes("INVALID_TELEGRAM_CAMPAIGN") &&
      telegramRoute.includes("AMBIGUOUS_TELEGRAM_TARGET") &&
      telegramRoute.includes('body.campaign === "editorial_pick"') &&
      telegramRoute.includes("buildEditorialPickTelegramMessage") &&
      telegramRoute.includes("sendTelegramEditorialPick"),
    "the admin endpoint accepts only the fixed server-authored editorial campaign and never accepts arbitrary message text or URLs",
    "required"
  );
}

if (fileExists("components/TelegramPreview.tsx")) {
  const telegramPreview = readText("components/TelegramPreview.tsx");
  check(
    "admin: telegram preview feedback",
    telegramPreview.includes("runningMode") &&
      telegramPreview.includes("role=\"status\"") &&
      telegramPreview.includes("!response.ok") &&
      telegramPreview.includes("네트워크 문제로 텔레그램 발송을 실행하지 못했습니다") &&
      telegramPreview.includes("텔레그램 미리보기를 생성했습니다") &&
      telegramPreview.includes("TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID"),
    "admin Telegram panel shows preview/send progress, API errors, and network failures",
    "required"
  );
}

if (fileExists("app/api/admin/editorial-campaign/route.ts")) {
  const editorialCampaignRoute = readText("app/api/admin/editorial-campaign/route.ts");
  check(
    "admin api: fixed editorial campaign kit",
    editorialCampaignRoute.includes("requireAdmin(request)") &&
      editorialCampaignRoute.includes("buildEditorialCampaignKit()") &&
      editorialCampaignRoute.includes("EDITORIAL_CAMPAIGN_LINK_NOT_CONFIGURED") &&
      editorialCampaignRoute.includes("message.slice(0, 240)") &&
      !editorialCampaignRoute.includes("request.json"),
    "admin-only campaign API returns server-authored channel copy and accepts no arbitrary message or destination input",
    "required"
  );
}

if (fileExists("components/AdminEditorialTelegramCampaign.tsx") && fileExists("app/admin/page.tsx")) {
  const editorialCampaign = readText("components/AdminEditorialTelegramCampaign.tsx");
  const adminPage = readText("app/admin/page.tsx");
  check(
    "admin: editorial channel kit preview-first flow",
    editorialCampaign.includes('/api/admin/editorial-campaign') &&
      editorialCampaign.includes("navigator.clipboard.writeText") &&
      editorialCampaign.includes('activeChannel') &&
      editorialCampaign.includes('"naverBlog"') &&
      editorialCampaign.includes("네이버 블로그 원고") &&
      editorialCampaign.includes("본문 복사") &&
      editorialCampaign.includes('campaign: "editorial_pick"') &&
      editorialCampaign.includes('mode: "send"') &&
      editorialCampaign.includes("if (!kit) return") &&
      editorialCampaign.includes("TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID") &&
      editorialCampaign.includes('role="status"') &&
      adminPage.includes("<AdminEditorialTelegramCampaign password={password} />"),
    "admins can preview and copy fixed Telegram or Naver Blog copy before an explicit Telegram send",
    "required"
  );
}
if (fileExists("app/api/admin/content-kit/route.ts") && fileExists("components/AdminProductDistributionKit.tsx") && fileExists("lib/productDistributionKit.ts")) {
  const contentKitRoute = readText("app/api/admin/content-kit/route.ts");
  const contentKit = readText("components/AdminProductDistributionKit.tsx");
  const productDistributionKit = readText("lib/productDistributionKit.ts");
  const adminPage = readText("app/admin/page.tsx");
  check(
    "admin api: product distribution kit is gated",
    contentKitRoute.includes("requireAdmin(request)") &&
      contentKitRoute.includes("product_id") &&
      contentKitRoute.includes("getProductById") &&
      contentKitRoute.includes("getProductDistributionReadiness") &&
      contentKitRoute.includes("PRODUCT_NOT_PUBLIC_READY") &&
      contentKitRoute.includes("buildProductDistributionKit"),
    "product-specific channel copy is only generated for authenticated, customer-ready products",
    "required"
  );
  check(
    "admin: product distribution kit preview-first flow",
    contentKit.includes("/api/admin/content-kit?product_id=") &&
      contentKit.includes("customer_ready=true") &&
      contentKit.includes("navigator.clipboard.writeText") &&
      contentKit.includes("/api/admin/telegram") &&
      contentKit.includes("productId: kit.productId") &&
      contentKit.includes("네이버 블로그 원고") &&
      contentKit.includes("제휴 안내") &&
      contentKit.includes('id="admin-product-distribution"') &&
      adminPage.includes("<AdminProductDistributionKit password={password} refreshToken={refreshToken} />"),
    "admins can select a public product, review tracked channel copy, copy it, or explicitly send Telegram",
    "required"
  );
  check(
    "product distribution kit: disclosure and tracked detail links",
    productDistributionKit.includes("AFFILIATE_DISCLOSURE") &&
      productDistributionKit.includes("utm_source") &&
      productDistributionKit.includes("utm_campaign") &&
      productDistributionKit.includes("buildTelegramMessage(product, { detailUrl: telegramUrl })") &&
      productDistributionKit.includes("approvalSampleProduct.registeredNaverBlogUrl"),
    "generated channel copy keeps affiliate disclosure and sends users to the ReturnPick detail page with attribution",
    "required"
  );
}
if (fileExists("app/deals/[id]/page.tsx")) {
  const dealPage = readText("app/deals/[id]/page.tsx");
  check(
    "public detail: hides non-purchasable deals",
    dealPage.includes("isPublicDealVisible(product)") && dealPage.includes("notFound()"),
    "deal detail 404s when the published product has no usable affiliate link",
    "required"
  );
  check(
    "public detail: safe product JSON-LD",
    dealPage.includes('"@type": "Product"') &&
      dealPage.includes('"@id": `${canonicalUrl}#product`') &&
      dealPage.includes("isUsableProductImageUrl(product.image_url)") &&
      dealPage.includes("serializeJsonLd(productJsonLd)") &&
      dealPage.includes('replace(/</g, "\\\\u003c")') &&
      !dealPage.includes('"@type": "Offer"') &&
      !dealPage.includes("availability"),
    "customer-ready deal details expose stable Product identity data without price, stock, availability, or Offer claims",
    "required"
  );
}

if (fileExists("vercel.json")) {
  const vercel = JSON.parse(readText("vercel.json"));
  const crons = Array.isArray(vercel.crons) ? vercel.crons : [];
  check("cron: sourcing Vercel deployable fallback", crons.some((cron) => cron.path === "/api/cron/sourcing" && cron.schedule === "0 0 * * *"), "/api/cron/sourcing 0 0 * * *", "required");
  check("cron: affiliate backfill Vercel deployable fallback", crons.some((cron) => cron.path === "/api/cron/affiliate-backfill" && cron.schedule === "5 0 * * *"), "/api/cron/affiliate-backfill 5 0 * * *", "required");
  check(
    "cron: telegram digest Vercel deployable fallback",
    crons.some((cron) => cron.path === "/api/cron/telegram-digest" && cron.schedule === "10 0 * * *"),
    "/api/cron/telegram-digest 10 0 * * *",
    "required"
  );
}

if (fileExists(".github/workflows/returnpick-hourly.yml")) {
  const hourlyWorkflow = readText(".github/workflows/returnpick-hourly.yml");
  check(
    "cron: GitHub Actions hourly scheduler",
    hourlyWorkflow.includes('cron: "0 * * * *"') &&
      hourlyWorkflow.includes("RETURNPICK_CRON_SECRET") &&
      hourlyWorkflow.includes("RETURNPICK_SITE_URL") &&
      hourlyWorkflow.includes("/api/cron/sourcing") &&
      hourlyWorkflow.includes("/api/cron/affiliate-backfill") &&
      hourlyWorkflow.includes("/api/cron/telegram-digest?limit=1") &&
      hourlyWorkflow.includes("Authorization: Bearer") &&
      hourlyWorkflow.includes("--fail-with-body") &&
      hourlyWorkflow.includes("concurrency:"),
    "GitHub Actions can call protected ReturnPick Cron endpoints hourly when Vercel Hobby cannot deploy hourly Cron",
    "required"
  );
}

if (fileExists("lib/cron.ts")) {
  const cron = readText("lib/cron.ts");
  check("cron: auth probe mode", cron.includes("isCronProbeRequest") && cron.includes("cronProbeJson") && cron.includes("job_started"), "cron endpoints support an authenticated no-op probe", "required");
  check(
    "cron: bounded error json",
    cron.includes("cronErrorJson") && cron.includes("UNKNOWN_") && cron.includes('status: "error"'),
    "cron endpoints can return safe JSON errors instead of opaque 500 responses",
    "required"
  );
}

if (fileExists("app/api/cron/sourcing/route.ts") && fileExists("app/api/cron/affiliate-backfill/route.ts") && fileExists("app/api/cron/telegram-digest/route.ts")) {
  const cronSourcingRoute = readText("app/api/cron/sourcing/route.ts");
  const cronAffiliateBackfillRoute = readText("app/api/cron/affiliate-backfill/route.ts");
  const cronTelegramRoute = readText("app/api/cron/telegram-digest/route.ts");
  check(
    "cron: scheduled routes catch execution failures",
    cronSourcingRoute.includes("CRON_SOURCING_FAILED") &&
      cronSourcingRoute.includes("cronErrorJson") &&
      cronAffiliateBackfillRoute.includes("CRON_AFFILIATE_BACKFILL_FAILED") &&
      cronAffiliateBackfillRoute.includes("cronErrorJson") &&
      cronTelegramRoute.includes("CRON_TELEGRAM_DIGEST_FAILED") &&
      cronTelegramRoute.includes("cronErrorJson"),
    "scheduled sourcing and Telegram digest routes return bounded JSON when execution throws",
    "required"
  );
}

if (fileExists("lib/scheduler.ts")) {
  const scheduler = readText("lib/scheduler.ts");
  const sourcingSource = fileExists("lib/sourcing.ts") ? readText("lib/sourcing.ts") : "";
  check("cron: production real-source default", scheduler.includes("getScheduledMockFallback") && scheduler.includes('process.env.NODE_ENV !== "production"'), "production cron does not use mock fallback unless explicitly enabled", "required");
  check("cron: sourcing time budget env", scheduler.includes("SOURCING_TIME_BUDGET_MS") && scheduler.includes("SOURCING_KEYWORD_LIMIT") && sourcingSource.includes("SOURCING_ENRICHMENT_CONCURRENCY"), "cron sourcing can be bounded by time, keyword, and enrichment concurrency settings", "required");
  check("cron: affiliate link backfill isolation", scheduler.includes("runScheduledAffiliateBackfill") && scheduler.includes("backfillCoupangAffiliateLinks") && scheduler.includes("AFFILIATE_BACKFILL_LIMIT"), "scheduled Partners link repair runs in a separate bounded job after sourcing", "required");
  check("cron: keyword cursor resume", scheduler.includes("getNextSourcingKeywordOffset") && scheduler.includes("keywordOffset"), "scheduled sourcing resumes from the previous keyword cursor", "required");
  check("cron: persistent storage signal", scheduler.includes("persistent_storage") && scheduler.includes("hasSupabaseConfig"), "scheduler result exposes whether run logs are persisted", "required");
  check(
    "cron: launch readiness gate",
    scheduler.includes("getScheduledAutomationGate") &&
      scheduler.includes("LAUNCH_NOT_READY") &&
      scheduler.includes("readiness.launchReady") &&
      scheduler.includes("getSchedulerBlockingItems") &&
      scheduler.includes("getSchedulerOperatorAction") &&
      scheduler.includes("blocking_items"),
    "production scheduled jobs wait until launch readiness is complete and return concrete blocking items",
    "required"
  );
  check(
    "cron: public web only fallback",
    scheduler.includes('isCapabilityReady(gate.readiness.items, "public_web")') &&
      scheduler.includes("const publicWebOnly") &&
      scheduler.includes('sourceMode: publicWebOnly ? "public_web_only" : "auto"') &&
      scheduler.includes('status: "waiting_for_api"'),
    "hourly sourcing can use the explicitly enabled, runtime-ready public-web source before Coupang API approval and otherwise remains gated",
    "required"
  );
  check(
    "cron: first-launch confirmation gate",
    scheduler.includes("getFirstLaunchConfirmation") &&
      scheduler.includes("FIRST_LAUNCH_NOT_CONFIRMED") &&
      scheduler.includes("RUN_FIRST_LAUNCH") &&
      scheduler.includes("operator_action") &&
      scheduler.includes("first_launch_confirmed") &&
      scheduler.includes("launch_confirmation_id"),
    "scheduled sourcing and telegram jobs wait for a successful post-approval first launch and return the first-launch operator action",
    "required"
  );
  check(
    "cron: Telegram capability-only gate",
    scheduler.includes("TELEGRAM_NOT_READY") &&
      scheduler.includes('getSchedulerBlockingItems(gate.readiness, ["telegram"])') &&
      scheduler.includes('isCapabilityReady(gate.readiness.items, "telegram")') &&
      scheduler.includes('code: "CONFIGURE_TELEGRAM"'),
    "missing Telegram credentials pause only the Telegram job after core launch without stopping scheduled sourcing",
    "required"
  );
  check(
    "cron: telegram digest customer-ready candidates",
    scheduler.includes("isPublicDealReady") &&
      scheduler.includes("NO_UNSENT_PUBLIC_CUSTOMER_READY_DEALS") &&
      !scheduler.includes("NO_UNSENT_PUBLISHED_DEALS_WITH_AFFILIATE_URL"),
    "scheduled Telegram digest uses customer-ready public deal visibility",
    "required"
  );
  check(
    "cron: telegram digest error summary",
    scheduler.includes("const errorCount = results.filter") &&
      scheduler.includes('item.status === "API_NOT_CONFIGURED"') &&
      scheduler.includes('const status = !candidates.length ? "skipped"') &&
      scheduler.includes("error_count: errorCount") &&
      scheduler.includes("sent_count: sentCount"),
    "scheduled Telegram digest summarizes send failures so admin and cron callers do not mistake partial sends for success",
    "required"
  );
}

if (fileExists("lib/sourcingCursor.ts")) {
  const sourcingCursor = readText("lib/sourcingCursor.ts");
  check(
    "cron: cursor ignores launch markers",
    sourcingCursor.includes("isSourcingExecutionRun") &&
      sourcingCursor.includes("@/lib/sourcingRunKinds") &&
      sourcingCursor.includes("continue"),
    "keyword cursor resumes from real sourcing runs, not first-launch confirmation markers",
    "required"
  );
}

if (fileExists("app/api/admin/scheduler/run/route.ts")) {
  const schedulerRunRoute = readText("app/api/admin/scheduler/run/route.ts");
  check(
    "admin: scheduler run bounded errors",
    schedulerRunRoute.includes("SCHEDULER_RUN_FAILED") &&
      schedulerRunRoute.includes("INVALID_SCHEDULER_JOB") &&
      schedulerRunRoute.includes("positiveInteger") &&
      schedulerRunRoute.includes('job === "affiliate_backfill"') &&
      schedulerRunRoute.includes("runScheduledAffiliateBackfill"),
    "admin manual scheduler execution returns safe JSON errors, clamps Telegram digest limits, and exposes isolated link backfill",
    "required"
  );
}

if (fileExists("app/api/admin/scheduler-health/route.ts")) {
  const schedulerHealthRoute = readText("app/api/admin/scheduler-health/route.ts");
  check(
    "admin: scheduler health bounded errors",
    schedulerHealthRoute.includes("SCHEDULER_HEALTH_FAILED") && schedulerHealthRoute.includes("schedulerHealthErrorResponse"),
    "admin scheduler health lookup returns safe JSON errors if insight generation fails",
    "required"
  );
}

if (fileExists("lib/schedulerInsights.ts")) {
  const schedulerInsights = readText("lib/schedulerInsights.ts");
  check(
    "admin: scheduler insights ignore launch markers",
    schedulerInsights.includes("isSourcingExecutionRun") &&
      schedulerInsights.includes("sourcingRuns") &&
      schedulerInsights.includes("recent_runs: sourcingRuns"),
    "admin scheduler health and recent runs ignore first-launch confirmation markers",
    "required"
  );
  check(
    "admin: scheduler insights customer-ready queues",
    schedulerInsights.includes("isPublicDealReady") &&
      schedulerInsights.includes("getCustomerPublishReadiness") &&
      schedulerInsights.includes("qualityBlockedPublished") &&
      schedulerInsights.includes("quality_blocked_published_count") &&
      schedulerInsights.includes(".filter(isPublicDealReady)"),
    "admin scheduler insights use customer-ready products for Telegram candidates and quality-blocked queues",
    "required"
  );
  check(
    "admin: scheduler insights use source observation time",
    schedulerInsights.includes("getDealFreshness") &&
      schedulerInsights.includes('freshness.status === "stale"') &&
      schedulerInsights.includes('freshness.status === "unknown"') &&
      schedulerInsights.includes('getDealFreshness(product).status !== "fresh"'),
    "admin action queues explain stale or missing automatic source observations using the same 24-hour rule as the purchase page",
    "required"
  );
  check(
    "admin: scheduler insights blocking item details",
    schedulerInsights.includes("getSchedulerBlockingItems") &&
      schedulerInsights.includes("getSchedulerOperatorAction") &&
      schedulerInsights.includes("blocking_items") &&
      schedulerInsights.includes("operator_action"),
    "admin scheduler health includes readiness labels, missing envs, next actions, and the next operator action for blocked automation",
    "required"
  );
}

if (fileExists("app/api/admin/sourcing/run/route.ts") && fileExists("lib/dataStore.ts")) {
  const sourcingRunRoute = readText("app/api/admin/sourcing/run/route.ts");
  const dataStore = readText("lib/dataStore.ts");
  const manualProductRoute = readText("app/api/admin/products/route.ts");
  const manualProductImportRoute = readText("app/api/admin/products/import/route.ts");
  const dealFreshness = readText("lib/dealFreshness.ts");
  const updateProductBody = dataStore.slice(
    dataStore.indexOf("export async function updateProduct"),
    dataStore.indexOf("export async function createDealScore")
  );
  check(
    "admin: sourcing run list ignores launch markers",
    sourcingRunRoute.includes("listSourcingExecutionRuns") &&
      dataStore.includes("listSourcingExecutionRuns") &&
      dataStore.includes("isSourcingExecutionRun") &&
      dataStore.includes("getAdminMetrics"),
    "admin recent sourcing runs and metrics list real sourcing executions, not launch confirmation markers",
    "required"
  );
  check(
    "admin: metrics separate public ready from published status",
    dataStore.includes("publishedStatusCount") &&
      dataStore.includes("const published = publicReady") &&
      dataStore.includes("hiddenPublishedWithoutAffiliate") &&
      dataStore.includes("hiddenPublishedWithQualityBlockers") &&
      dataStore.includes("getCustomerPublishReadiness(product).ready"),
    "admin metrics use customer-ready public visibility for the main public count and keep hidden published products separate",
    "required"
  );
  check(
    "data store: product snapshot failure does not block product save",
    dataStore.includes("createProductSnapshotSafely") &&
      dataStore.includes("PRODUCT_SNAPSHOT_SAVE_FAILED") &&
      dataStore.includes("console.warn") &&
      dataStore.includes("await createProductSnapshotSafely(product, getSnapshotChangeFlags(existing, product))") &&
      dataStore.includes('await createProductSnapshotSafely(product, ["NEW_PRODUCT"])') &&
      dataStore.includes("await createProductSnapshotSafely(product, changeFlags)"),
    "product save/update returns after core product write even if snapshot logging fails",
    "required"
  );
  check(
    "data store: resourcing preserves admin review fields",
    dataStore.includes("preserveExistingReviewFields") &&
      dataStore.includes("weakConditionGrades") &&
      dataStore.includes("payload.return_price ?? existing.return_price") &&
      dataStore.includes("payload.naver_lowest_price ?? existing.naver_lowest_price") &&
      dataStore.includes("payload.stock_count ?? existing.stock_count") &&
      dataStore.includes("isUsableProductImageUrl(existing.image_url)") &&
      dataStore.includes("isUsableAffiliateUrl(existing.affiliate_url)") &&
      dataStore.includes("...preserveExistingReviewFields(existing, payload)") &&
      dataStore.includes("...preserveExistingReviewFields(memoryProducts[existingIndex], payload)"),
    "hourly resourcing keeps manual return price, condition, stock, public notes, verified images, and product-level affiliate links when providers return weak or empty values",
    "required"
  );
  check(
    "data store: source observation is automatic-only",
    dataStore.includes("last_observed_at: input.last_observed_at === undefined ? stamp : input.last_observed_at") &&
      dataStore.includes("last_observed_at: payload.last_observed_at ?? existing.last_observed_at") &&
      manualProductRoute.includes("last_observed_at: null") &&
      manualProductImportRoute.includes("last_observed_at: null") &&
      dealFreshness.includes('product.source === "manual_admin"') &&
      dataStore.includes("export async function upsertSourcedProduct") &&
      !updateProductBody.includes("last_observed_at"),
    "automatic sourcing refreshes last_observed_at while ordinary admin edits do not impersonate a source observation",
    "required"
  );
  check(
    "data store: production memory excludes demo catalog",
    dataStore.includes("isDemoProduct") &&
      dataStore.includes("isLocalDemoModeEnabled") &&
      dataStore.includes("if (!isLocalDemoModeEnabled()) return []") &&
      dataStore.includes("removeDemoProductsFromMemoryState") &&
      dataStore.includes("state.products = state.products.filter((product) => !demoProductIds.has(product.id))"),
    "Production memory fallback never seeds or restores synthetic demo products into the admin catalog",
    "required"
  );
}

if (fileExists("components/AdminSchedulerPanel.tsx")) {
  const schedulerPanel = readText("components/AdminSchedulerPanel.tsx");
  check(
    "admin: scheduler launch gate visible",
    schedulerPanel.includes("첫 가동 준비 전이라 운영 스케줄러는 대기합니다") &&
      schedulerPanel.includes("!insights.sourcing.launch_ready") &&
      schedulerPanel.includes("blocking_items") &&
      schedulerPanel.includes("누락 환경변수") &&
      schedulerPanel.includes("next_action") &&
      schedulerPanel.includes("scrollToAnchor") &&
      schedulerPanel.includes("scrollToAdminAnchor") &&
      schedulerPanel.includes("operatorActionButtonLabel") &&
      schedulerPanel.includes("admin-api-readiness") &&
      schedulerPanel.includes("준비도 패널로 이동"),
    "admin scheduler explains launch blockers and sends operators back to the readiness panel with concrete next actions",
    "required"
  );
  check(
    "admin: scheduler first-launch confirmation gate visible",
    schedulerPanel.includes("first_launch_confirmed") &&
      schedulerPanel.includes("scheduler_ready") &&
      schedulerPanel.includes("FIRST_LAUNCH_NOT_CONFIRMED") &&
      schedulerPanel.includes("operator_action") &&
      schedulerPanel.includes("scrollToAnchor") &&
      schedulerPanel.includes("scrollToAdminAnchor") &&
      schedulerPanel.includes("operatorActionButtonLabel") &&
      schedulerPanel.includes("승인 후 첫 가동 실행으로 이동"),
    "admin scheduler waits for a successful first-launch confirmation and sends operators to the first-launch runner",
    "required"
  );
  check(
    "admin: scheduler operation feedback visible",
    schedulerPanel.includes("noticeClassName") &&
      schedulerPanel.includes("자동 운영 상태를 불러오지 못했습니다") &&
      schedulerPanel.includes("네트워크 문제로 자동 운영 작업을 실행하지 못했습니다") &&
      schedulerPanel.includes("최근 수동 실행 응답") &&
      schedulerPanel.includes("오류 ${result.error_count ?? 0}건"),
    "admin scheduler panel shows inline load, run, network, and not-ready feedback",
    "required"
  );
  check(
    "admin: scheduler quality-blocked queue visible",
    schedulerPanel.includes("quality_blocked_published_count") &&
      schedulerPanel.includes("품질 보강") &&
      schedulerPanel.includes("고객공개 발송 후보"),
    "admin scheduler panel shows products that are published but blocked by customer-facing quality rules",
    "required"
  );
  check(
    "admin: scheduler refreshes after launch actions",
    schedulerPanel.includes("refreshToken = 0") && schedulerPanel.includes("[password, refreshToken]"),
    "admin scheduler panel reloads when first-launch or related admin actions update the shared refresh token",
    "required"
  );
  check(
    "admin: scheduler telegram distribution anchor",
    schedulerPanel.includes('id="admin-telegram-distribution"') && schedulerPanel.includes("scroll-mt-4"),
    "admin scheduler panel has a stable anchor for post-publish Telegram handoff",
    "required"
  );
  check(
    "admin: GitHub hourly scheduler setup copy",
    schedulerPanel.includes("copyGithubSchedulerSetup") &&
      schedulerPanel.includes("githubSchedulerSetupText") &&
      schedulerPanel.includes("GitHub Actions 1시간 스케줄러 설정값을 복사했습니다") &&
      schedulerPanel.includes("RETURNPICK_CRON_SECRET") &&
      schedulerPanel.includes("RETURNPICK_SITE_URL") &&
      schedulerPanel.includes("ReturnPick Hourly Scheduler") &&
      schedulerPanel.includes("/api/cron/sourcing") &&
      schedulerPanel.includes("/api/cron/affiliate-backfill") &&
      schedulerPanel.includes("/api/cron/telegram-digest?limit=1"),
    "admin scheduler panel can copy the GitHub Actions hourly scheduler setup for Vercel Hobby operation",
    "required"
  );
}

if (fileExists("app/admin/page.tsx")) {
  const adminPage = readText("app/admin/page.tsx");
  check(
    "admin auth: legacy password storage removed",
    adminPage.includes('fetch("/api/admin/session"') &&
      adminPage.includes('window.localStorage.removeItem("returnpick_admin_password")') &&
      !adminPage.includes("localStorage.setItem") &&
      adminPage.includes('const password = ""'),
    "admin clears the legacy saved password and uses the cookie session without forwarding the real password to child components",
    "required"
  );
  check(
    "admin: launch status bar mounted first",
    adminPage.includes("AdminLaunchStatusBar") &&
      adminPage.indexOf("<AdminLaunchStatusBar password={password} />") < adminPage.indexOf("<AdminApiReadinessPanel password={password} />"),
    "admin shows the approval/API/go-live command center before the detailed readiness panel",
    "required"
  );
  check(
    "admin: scheduler wired to shared refresh token",
    adminPage.includes("<AdminSchedulerPanel password={password} refreshToken={refreshToken}") &&
      adminPage.includes("setRefreshToken((value) => value + 1)"),
    "first-launch completion can refresh scheduler health without a manual page reload",
    "required"
  );
  check(
    "admin: hash anchor resumes after login",
    adminPage.includes("scrollToAdminAnchor") &&
      adminPage.includes("window.location.hash") &&
      adminPage.includes("hashchange") &&
      adminPage.includes("decodeURIComponent") &&
      adminPage.includes("window.clearTimeout"),
    "admin deep links like /admin#admin-api-readiness still scroll and highlight the target after password login",
    "required"
  );
}

checkEnvGroup("env: approval page", ["NEXT_PUBLIC_COUPANG_APPROVAL_PRODUCT_URL"], mode === "launch" ? "required" : "warning");
checkEnvGroup("env: site/admin", ["NEXT_PUBLIC_SITE_URL", "ADMIN_PASSWORD"], mode === "launch" ? "required" : "warning");
checkEnvGroup("env: cron", ["CRON_SECRET"], mode === "launch" ? "required" : "warning");
checkEnvGroup("env: supabase", ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"], mode === "launch" ? "required" : "warning");
checkEnvGroup("env: coupang partners api", ["COUPANG_ACCESS_KEY", "COUPANG_SECRET_KEY", "COUPANG_PARTNER_ID"], "warning");
checkEnvGroup("env: naver shopping api", ["NAVER_CLIENT_ID", "NAVER_CLIENT_SECRET"], "warning");
checkEnvGroup("env: telegram", ["TELEGRAM_BOT_TOKEN", "TELEGRAM_CHAT_ID"], "warning");
if (envValue("PUBLIC_WEB_CRAWL_ENABLED") === "true") {
  checkEnvGroup("env: public web crawl", ["PUBLIC_WEB_ALLOWED_HOSTS", "PUBLIC_WEB_SEARCH_TEMPLATES"], "required");
}

const launchValueSeverity = mode === "launch" ? "required" : "warning";
if (hasEnv("NEXT_PUBLIC_SITE_URL")) {
  check(
    "env value: public site url",
    isPublicHttpsSiteUrl(envValue("NEXT_PUBLIC_SITE_URL")),
    "NEXT_PUBLIC_SITE_URL must be an external https URL, not localhost/http",
    launchValueSeverity
  );
}
if (hasEnv("NEXT_PUBLIC_COUPANG_APPROVAL_PRODUCT_URL")) {
  check(
    "env value: approval partners url",
    isCoupangPartnersUrl(envValue("NEXT_PUBLIC_COUPANG_APPROVAL_PRODUCT_URL")),
    "NEXT_PUBLIC_COUPANG_APPROVAL_PRODUCT_URL must look like https://link.coupang.com/a/<short-code>",
    "required"
  );
}
if (hasEnv("CRON_SECRET")) {
  check(
    "env value: cron secret length",
    envValue("CRON_SECRET").length >= 16,
    "CRON_SECRET must be at least 16 characters",
    launchValueSeverity
  );
}
if (hasEnv("ADMIN_PASSWORD")) {
  check(
    "env value: admin password strength",
    isLikelyAdminPasswordValue(envValue("ADMIN_PASSWORD")),
    "ADMIN_PASSWORD must be at least 12 characters and not contain whitespace or placeholder text",
    launchValueSeverity
  );
}
if (hasEnv("COUPANG_ACCESS_KEY")) {
  check(
    "env value: coupang access key",
    isLikelyProviderSecretValue(envValue("COUPANG_ACCESS_KEY"), 8),
    "COUPANG_ACCESS_KEY must be a copied API key without whitespace or placeholder text",
    launchValueSeverity
  );
}
if (hasEnv("COUPANG_SECRET_KEY")) {
  check(
    "env value: coupang secret key",
    isLikelyProviderSecretValue(envValue("COUPANG_SECRET_KEY"), 8),
    "COUPANG_SECRET_KEY must be a copied API key without whitespace or placeholder text",
    launchValueSeverity
  );
}
if (hasEnv("COUPANG_PARTNER_ID")) {
  check(
    "env value: coupang partner id",
    isLikelyProviderSecretValue(envValue("COUPANG_PARTNER_ID"), 2),
    "COUPANG_PARTNER_ID must be copied without whitespace or placeholder text",
    launchValueSeverity
  );
}
if (hasEnv("NAVER_CLIENT_ID")) {
  check(
    "env value: naver client id",
    isLikelyProviderSecretValue(envValue("NAVER_CLIENT_ID"), 5),
    "NAVER_CLIENT_ID must be copied without whitespace or placeholder text",
    launchValueSeverity
  );
}
if (hasEnv("NAVER_CLIENT_SECRET")) {
  check(
    "env value: naver client secret",
    isLikelyProviderSecretValue(envValue("NAVER_CLIENT_SECRET"), 5),
    "NAVER_CLIENT_SECRET must be copied without whitespace or placeholder text",
    launchValueSeverity
  );
}
if (hasEnv("TELEGRAM_BOT_TOKEN")) {
  check(
    "env value: telegram bot token",
    isLikelyTelegramBotTokenValue(envValue("TELEGRAM_BOT_TOKEN")),
    "TELEGRAM_BOT_TOKEN must look like 123456:bot-token",
    launchValueSeverity
  );
}
if (hasEnv("TELEGRAM_CHAT_ID")) {
  check(
    "env value: telegram chat id",
    isLikelyTelegramChatIdValue(envValue("TELEGRAM_CHAT_ID")),
    "TELEGRAM_CHAT_ID must be a numeric chat id or @channel username",
    launchValueSeverity
  );
}
if (hasEnv("NEXT_PUBLIC_SUPABASE_URL")) {
  check(
    "env value: supabase url",
    isSupabaseProjectUrl(envValue("NEXT_PUBLIC_SUPABASE_URL")),
    "NEXT_PUBLIC_SUPABASE_URL must be an external https Supabase project URL",
    launchValueSeverity
  );
}
if (hasEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY")) {
  check(
    "env value: supabase anon key",
    isLikelySupabaseKeyValue(envValue("NEXT_PUBLIC_SUPABASE_ANON_KEY")),
    "NEXT_PUBLIC_SUPABASE_ANON_KEY must be a complete key without whitespace",
    launchValueSeverity
  );
}
if (hasEnv("SUPABASE_SERVICE_ROLE_KEY")) {
  check(
    "env value: supabase service role key",
    isLikelySupabaseKeyValue(envValue("SUPABASE_SERVICE_ROLE_KEY")),
    "SUPABASE_SERVICE_ROLE_KEY must be a complete key without whitespace",
    launchValueSeverity
  );
}
if (hasEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY") && hasEnv("SUPABASE_SERVICE_ROLE_KEY")) {
  check(
    "env value: supabase keys differ",
    envValue("NEXT_PUBLIC_SUPABASE_ANON_KEY") !== envValue("SUPABASE_SERVICE_ROLE_KEY"),
    "Supabase anon key and service role key must be different",
    launchValueSeverity
  );
}
if (envValue("PUBLIC_WEB_CRAWL_ENABLED") === "true") {
  const publicWebHosts = splitEnvListValue(envValue("PUBLIC_WEB_ALLOWED_HOSTS"));
  const publicWebTemplates = splitEnvListValue(envValue("PUBLIC_WEB_SEARCH_TEMPLATES"));
  const allowedHostSet = new Set(publicWebHosts.map((host) => host.toLowerCase()));
  check(
    "env value: public web hosts",
    publicWebHosts.length > 0 && publicWebHosts.every(isPublicWebHostValue),
    "PUBLIC_WEB_ALLOWED_HOSTS must contain comma-separated public hostnames only, without protocol/path/wildcards",
    "required"
  );
  check(
    "env value: public web host count",
    publicWebHosts.length <= MAX_PUBLIC_WEB_ALLOWED_HOSTS,
    `PUBLIC_WEB_ALLOWED_HOSTS supports at most ${MAX_PUBLIC_WEB_ALLOWED_HOSTS} hosts`,
    "required"
  );
  check(
    "env value: public web templates",
    publicWebTemplates.length > 0 && publicWebTemplates.every((template) => isPublicWebTemplateValue(template, allowedHostSet)),
    "PUBLIC_WEB_SEARCH_TEMPLATES must be http(s) URLs with {keyword} and hostnames from PUBLIC_WEB_ALLOWED_HOSTS",
    "required"
  );
  check(
    "env value: public web template count",
    publicWebTemplates.length <= MAX_PUBLIC_WEB_SEARCH_TEMPLATES,
    `PUBLIC_WEB_SEARCH_TEMPLATES supports at most ${MAX_PUBLIC_WEB_SEARCH_TEMPLATES} templates`,
    "required"
  );
}

const failedRequired = results.filter((result) => !result.ok && result.severity === "required");
const warnings = results.filter((result) => !result.ok && result.severity === "warning");

console.log(`ReturnPick readiness check (${mode})`);
console.log("=".repeat(36));
for (const result of results) {
  const marker = result.ok ? "PASS" : result.severity === "required" ? "FAIL" : "WARN";
  console.log(`${marker} ${result.name} - ${result.detail}`);
}
console.log("=".repeat(36));
console.log(`summary: ${results.length - failedRequired.length - warnings.length} pass, ${warnings.length} warn, ${failedRequired.length} fail`);

if (mode === "preapproval") {
  console.log("preapproval mode: missing API keys are warnings so the site can run with manual links and mock fallback.");
} else {
  console.log("launch mode: approval link, Supabase, admin, and scheduler values are required; Coupang API, Naver, and Telegram are optional capabilities.");
}

if (failedRequired.length) {
  process.exitCode = 1;
}
