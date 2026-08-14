import test from "node:test";
import assert from "node:assert/strict";

import { flipFallbacks } from "../_extensions/link-previews/link-previews.js";

test("side placements fall back to the opposite side, then vertical", () => {
  assert.deepEqual(flipFallbacks("right"), ["left", "bottom", "top"]);
  assert.deepEqual(flipFallbacks("left"), ["right", "bottom", "top"]);
});

// Supplying fallbackPlacements replaces popper's own expansion, so the
// chain must restate it: for a variation placement popper would try the
// same side's other alignment before leaving the side at all.
test("variation placements try the same side's other alignment first", () => {
  assert.deepEqual(flipFallbacks("right-start"), [
    "right-end",
    "left-start",
    "left-end",
    "bottom-start",
    "top-start",
  ]);
  assert.deepEqual(flipFallbacks("left-end"), [
    "left-start",
    "right-end",
    "right-start",
    "bottom-end",
    "top-end",
  ]);
});

test("vertical placements keep popper's default fallback", () => {
  assert.equal(flipFallbacks("bottom-start"), null);
  assert.equal(flipFallbacks("top"), null);
});

test("auto placements are left to popper", () => {
  assert.equal(flipFallbacks("auto"), null);
  assert.equal(flipFallbacks("auto-start"), null);
});
