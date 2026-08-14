import test from "node:test";
import assert from "node:assert/strict";

import { flipFallbacks } from "../_extensions/link-previews/link-previews.js";

test("side placements fall back to the opposite side, then vertical", () => {
  assert.deepEqual(flipFallbacks("right"), ["left", "bottom", "top"]);
  assert.deepEqual(flipFallbacks("left"), ["right", "bottom", "top"]);
});

test("alignment suffix is preserved across fallbacks", () => {
  assert.deepEqual(flipFallbacks("right-start"), ["left-start", "bottom-start", "top-start"]);
  assert.deepEqual(flipFallbacks("left-end"), ["right-end", "bottom-end", "top-end"]);
});

test("vertical placements keep popper's default fallback", () => {
  assert.equal(flipFallbacks("bottom-start"), null);
  assert.equal(flipFallbacks("top"), null);
});

test("auto placements are left to popper", () => {
  assert.equal(flipFallbacks("auto"), null);
  assert.equal(flipFallbacks("auto-start"), null);
});
