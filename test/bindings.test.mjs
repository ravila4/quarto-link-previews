import test from "node:test";
import assert from "node:assert/strict";

import { planBindings } from "../_extensions/link-previews/link-previews.js";

// Default Quarto listing cards contain several anchors that all point at the
// same page (title, subtitle, description, date). Binding tippy to each
// independently makes the popover hide and re-show as the mouse sweeps one
// card, so those groups collapse to a single card-level binding.

const a = (id, href, cardId = null) => ({ id, href, cardId });

test("same-href anchors in one card collapse to a card binding", () => {
  const plan = planBindings([
    a("a1", "https://x.test/p1/", "card1"),
    a("a2", "https://x.test/p1/", "card1"),
    a("a3", "https://x.test/p1/", "card1"),
    a("a4", "https://x.test/p1/", "card1"),
  ]);
  assert.deepEqual(plan, [
    { type: "card", cardId: "card1", href: "https://x.test/p1/", anchorIds: ["a1", "a2", "a3", "a4"] },
  ]);
});

test("anchors without a card bind individually", () => {
  const plan = planBindings([a("a1", "https://x.test/p1/"), a("a2", "https://x.test/p2/")]);
  assert.deepEqual(plan, [
    { type: "anchor", anchorId: "a1", href: "https://x.test/p1/" },
    { type: "anchor", anchorId: "a2", href: "https://x.test/p2/" },
  ]);
});

test("single anchor in a card binds to the anchor, not the card", () => {
  const plan = planBindings([a("a1", "https://x.test/p1/", "card1")]);
  assert.deepEqual(plan, [{ type: "anchor", anchorId: "a1", href: "https://x.test/p1/" }]);
});

test("two cards produce two card bindings", () => {
  const plan = planBindings([
    a("a1", "https://x.test/p1/", "card1"),
    a("a2", "https://x.test/p1/", "card1"),
    a("b1", "https://x.test/p2/", "card2"),
    a("b2", "https://x.test/p2/", "card2"),
  ]);
  assert.deepEqual(plan, [
    { type: "card", cardId: "card1", href: "https://x.test/p1/", anchorIds: ["a1", "a2"] },
    { type: "card", cardId: "card2", href: "https://x.test/p2/", anchorIds: ["b1", "b2"] },
  ]);
});

test("card with mixed hrefs falls back to per-anchor bindings", () => {
  const plan = planBindings([
    a("a1", "https://x.test/p1/", "card1"),
    a("a2", "https://x.test/p1/", "card1"),
    a("a3", "https://x.test/other/", "card1"),
  ]);
  assert.deepEqual(plan, [
    { type: "anchor", anchorId: "a1", href: "https://x.test/p1/" },
    { type: "anchor", anchorId: "a2", href: "https://x.test/p1/" },
    { type: "anchor", anchorId: "a3", href: "https://x.test/other/" },
  ]);
});

test("empty input produces an empty plan", () => {
  assert.deepEqual(planBindings([]), []);
});
