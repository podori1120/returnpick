import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const route = read("app/api/admin/products/link-intake/bulk/route.ts");
const singleRoute = read("app/api/admin/products/link-intake/route.ts");
const ui = read("components/AdminAffiliateLinkIntake.tsx");
const packageJson = read("package.json");

assert.match(route, /requireAdmin\(request\)/, "bulk intake must be authenticated");
assert.match(route, /MAX_ITEMS = 8/, "bulk intake must be bounded");
assert.match(route, /MAX_BODY_BYTES = 64_000/, "bulk request size must be bounded");
assert.match(route, /MAX_CONCURRENCY = 2/, "bulk intake concurrency must be bounded");
assert.match(route, /POST as intakeOne/, "bulk intake must reuse the single-item gate");
assert.match(route, /batch\.map\(async \(item, offset\)/, "items must be processed independently");
assert.match(route, /await Promise\.all\(/, "bulk intake should reduce timeout risk with bounded parallel checks");
assert.equal(route.includes('redirect: "follow"'), false, "bulk intake must not add redirects");
assert.match(singleRoute, /sourcing_status: "needs_review"[\s\S]*is_published: false/, "single-item gate remains review-only");
assert.match(ui, /\/api\/admin\/products\/link-intake\/bulk/, "admin UI must expose bulk endpoint");
assert.match(ui, /최대 8개/, "admin UI must show the bounded batch limit");
assert.match(packageJson, /"affiliate-link-intake-bulk:check": "node scripts\/verify-affiliate-link-intake-bulk\.mjs"/, "bulk contract command is registered");
console.log("Affiliate link bulk intake static contract passed: bounded batch processing reuses authenticated identity checks and review-only persistence.");
