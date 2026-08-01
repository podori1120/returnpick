import { createHash } from "node:crypto";

const uuidPattern = /^([0-9a-f]{8})-([0-9a-f]{4})-([0-9a-f]{4})-([0-9a-f]{4})-([0-9a-f]{12})$/;

/** Keep local demo links stable across Next route workers and hot reloads. */
export function stableDemoProductId(sourceProductId: string) {
  const normalized = sourceProductId.trim();
  const digest = createHash("sha256").update(`returnpick:demo:${normalized}`).digest("hex").slice(0, 32);
  const versioned = `${digest.slice(0, 12)}5${digest.slice(13, 16)}${((Number.parseInt(digest[16], 16) & 0x3) | 0x8).toString(16)}${digest.slice(17)}`;
  const id = `${versioned.slice(0, 8)}-${versioned.slice(8, 12)}-${versioned.slice(12, 16)}-${versioned.slice(16, 20)}-${versioned.slice(20)}`;
  if (!uuidPattern.test(id)) throw new Error("DEMO_PRODUCT_ID_GENERATION_FAILED");
  return id;
}
