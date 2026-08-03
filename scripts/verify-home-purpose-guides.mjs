import assert from "node:assert/strict";
import { homePurposeOptions } from "../lib/homeDiscovery.ts";
import { getSearchIntentLanding } from "../lib/searchLandings.ts";

assert.equal(homePurposeOptions.length, 5, "home purpose coverage should remain stable");

for (const purpose of homePurposeOptions) {
  assert.ok(purpose.guideLinks.length >= 2, `${purpose.id} needs at least two buying guides`);
  for (const guide of purpose.guideLinks) {
    const match = guide.href.match(/^\/guide\/search\/([^/?#]+)$/);
    assert.ok(match, `${purpose.id} has an invalid guide href: ${guide.href}`);
    assert.ok(getSearchIntentLanding(match[1]), `${purpose.id} points to an unknown guide: ${guide.href}`);
    assert.ok(guide.label.trim(), `${purpose.id} has an empty guide label`);
  }
}

console.log("Home purpose guide checks passed: every purpose has multiple valid search-intent guides.");
