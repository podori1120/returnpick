import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const packagePath = join(process.cwd(), "node_modules", "minimatch", "package.json");
const modulePath = join(process.cwd(), "node_modules", "minimatch", "minimatch.js");
const packageJson = JSON.parse(readFileSync(packagePath, "utf8"));

if (packageJson.version !== "3.1.5") {
  throw new Error(`Unsupported minimatch compatibility target: ${packageJson.version}`);
}

const source = readFileSync(modulePath, "utf8");
const original = "var expand = require('brace-expansion')";
const replacement = [
  "var braceExpansion = require('brace-expansion')",
  "var expand = typeof braceExpansion === 'function' ? braceExpansion : braceExpansion.expand"
].join("\n");

if (source.includes(replacement)) {
  console.log("minimatch brace-expansion compatibility already applied");
  process.exit(0);
}

if (source.split(original).length !== 2) {
  throw new Error("minimatch brace-expansion import did not match the guarded patch target");
}

writeFileSync(modulePath, source.replace(original, replacement), "utf8");
console.log("applied minimatch brace-expansion compatibility");
