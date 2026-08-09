import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const mobileNav = read("components/MobileNav.tsx");
const layout = read("app/layout.tsx");
const packageJson = JSON.parse(read("package.json"));

const routes = [
  "/deals",
  "/recommend",
  "/picks",
  "/compare",
  "/saved",
  "/watchlist",
  "/guide/return-checklist",
  "/guide/safe-categories",
  "/disclosure",
  "/admin"
];

assert.equal(
  packageJson.scripts?.["responsive-nav:check"],
  "node scripts/verify-responsive-navigation.mjs",
  "package.json must expose the responsive navigation contract check"
);
assert.ok(mobileNav.startsWith('"use client";'), "MobileNav must be a client component");
assert.ok(mobileNav.includes('import { Menu, X } from "lucide-react";'), "MobileNav must use lucide Menu and X");
assert.ok(mobileNav.includes("useState"), "MobileNav must keep local open state");
assert.ok(mobileNav.includes("setOpen((value) => !value)"), "MobileNav must toggle open and closed state");
assert.ok(mobileNav.includes("setOpen(false)"), "MobileNav must provide a close path");
assert.ok(mobileNav.includes('event.key === "Escape"'), "MobileNav must close on Escape");
assert.ok(mobileNav.includes("aria-expanded={open}"), "MobileNav must expose aria-expanded");
assert.ok(mobileNav.includes('aria-controls="mobile-nav-panel"'), "MobileNav must expose aria-controls");
assert.ok(mobileNav.includes("focus-ring"), "MobileNav controls and links must retain the focus ring token");
assert.ok(mobileNav.includes("document.body.style.overflow") && mobileNav.includes("previousOverflow"), "MobileNav must restore body overflow");
assert.ok(mobileNav.includes("sm:hidden"), "MobileNav must be hidden at the sm breakpoint and above");
assert.ok(!/\b(?:fixed|absolute)\b/.test(mobileNav), "MobileNav panel must stay in normal flow");

for (const route of routes) {
  assert.ok(mobileNav.includes(route), `MobileNav must retain ${route}`);
  assert.ok(layout.includes(`href="${route}"`), `desktop navigation must retain ${route}`);
}

assert.ok(layout.includes('import MobileNav from "@/components/MobileNav";'), "layout must import MobileNav");
assert.ok(layout.includes("<MobileNav />"), "layout must mount MobileNav");
assert.match(
  layout,
  /<nav[^>]*className="[^"]*\bhidden\b[^"]*\bsm:flex\b/,
  "desktop navigation must be hidden below sm and flex from sm upward"
);
assert.ok(layout.includes('import SearchSuggest from "@/components/SearchSuggest";') && layout.includes("<SearchSuggest />"), "layout must retain prominent SearchSuggest");

console.log(`responsive navigation contract passed: ${routes.length} routes`);
