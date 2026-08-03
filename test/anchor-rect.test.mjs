import test from "node:test";
import assert from "node:assert/strict";

import { pickAnchorRectIndex } from "../_extensions/link-previews/link-previews.js";

// A link that wraps mid-sentence has one client rect per line box. Anchoring
// the popover to the union of them puts it under the whole text column,
// which can be a full column width away from the pointer.
const rect = (left, top, right, bottom) => ({ left, top, right, bottom });

// First line runs from x=600 to the right margin, the rest wraps to the far
// left of the next line: the shape in the reported bug.
const WRAPPED = [rect(600, 40, 900, 64), rect(100, 70, 220, 94)];

test("no rects falls back to the first index", () => {
  assert.equal(pickAnchorRectIndex([], { x: 10, y: 10 }), 0);
  assert.equal(pickAnchorRectIndex(undefined, { x: 10, y: 10 }), 0);
});

test("a single rect is always the answer", () => {
  assert.equal(pickAnchorRectIndex([rect(0, 0, 50, 20)], { x: 999, y: 999 }), 0);
});

test("pointer on the first line picks the first fragment", () => {
  assert.equal(pickAnchorRectIndex(WRAPPED, { x: 750, y: 52 }), 0);
});

test("pointer on the wrapped line picks the second fragment", () => {
  assert.equal(pickAnchorRectIndex(WRAPPED, { x: 160, y: 82 }), 1);
});

// Keyboard focus arrives with no pointer at all. Anchoring to where the link
// starts reading is the sane default.
test("no pointer anchors to the first fragment", () => {
  assert.equal(pickAnchorRectIndex(WRAPPED, null), 0);
});

test("rect edges count as inside", () => {
  assert.equal(pickAnchorRectIndex(WRAPPED, { x: 600, y: 40 }), 0);
  assert.equal(pickAnchorRectIndex(WRAPPED, { x: 220, y: 94 }), 1);
});

// Between the two line boxes, or past the end of the wrapped fragment, the
// pointer is inside neither rect. Nearest wins so the popover still lands
// beside the text the reader is looking at.
test("pointer in the leading between lines picks the nearer line", () => {
  assert.equal(pickAnchorRectIndex(WRAPPED, { x: 650, y: 66 }), 0);
  assert.equal(pickAnchorRectIndex(WRAPPED, { x: 150, y: 68 }), 1);
});

test("pointer past the end of the wrapped fragment still picks it", () => {
  assert.equal(pickAnchorRectIndex(WRAPPED, { x: 400, y: 82 }), 1);
});

test("ties keep the earlier fragment", () => {
  const stacked = [rect(0, 0, 10, 10), rect(0, 0, 10, 10)];
  assert.equal(pickAnchorRectIndex(stacked, { x: 5, y: 5 }), 0);
});

test("a DOMRectList-style array-like is accepted", () => {
  const arrayLike = { length: 2, 0: WRAPPED[0], 1: WRAPPED[1] };
  assert.equal(pickAnchorRectIndex(arrayLike, { x: 160, y: 82 }), 1);
});
