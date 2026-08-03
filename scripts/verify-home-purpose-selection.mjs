import assert from "node:assert/strict";
import { selectInitialPurposeId } from "../lib/homeDiscovery.ts";

const editorialFallback = { title: "직접 검수 콘텐츠" };

assert.equal(
  selectInitialPurposeId([
    { id: "study_work", count: 0 },
    { id: "cleaning", count: 0, editorialFallback },
    { id: "air_season", count: 2 }
  ]),
  "air_season"
);

assert.equal(
  selectInitialPurposeId([
    { id: "study_work", count: 0 },
    { id: "cleaning", count: 0, editorialFallback },
    { id: "air_season", count: 0 }
  ]),
  "cleaning"
);

assert.equal(
  selectInitialPurposeId([
    { id: "study_work", count: 1 },
    { id: "cleaning", count: 0, editorialFallback }
  ]),
  "study_work"
);

console.log("Home purpose selection checks passed: real inventory wins, editorial fallback fills an empty catalog, and default order remains stable.");
