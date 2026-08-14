import test from "node:test";
import assert from "node:assert/strict";

import { resolveConfig } from "../_extensions/link-previews/link-previews.js";

test("empty input yields defaults", () => {
  const cfg = resolveConfig({});
  assert.equal(cfg.content, "#title-block-header, #quarto-document-content");
  assert.deepEqual(cfg.delay, [300, 0]);
  assert.equal(cfg.maxWidth, 500);
  assert.deepEqual(cfg.exclude, []);
  assert.equal(cfg.placement, "bottom-start");
  assert.equal(cfg.arrow, false);
});

test("undefined input yields defaults", () => {
  assert.deepEqual(resolveConfig(undefined), resolveConfig({}));
});

// quarto.json.encode turns an empty Lua table into [] rather than {}.
test("array input (empty Lua table) yields defaults", () => {
  assert.deepEqual(resolveConfig([]), resolveConfig({}));
});

test("scalar delay becomes show/hide pair", () => {
  assert.deepEqual(resolveConfig({ delay: 100 }).delay, [100, 0]);
});

test("delay pair is preserved", () => {
  assert.deepEqual(resolveConfig({ delay: [200, 50] }).delay, [200, 50]);
});

test("kebab-case max-width from YAML is accepted", () => {
  assert.equal(resolveConfig({ "max-width": 640 }).maxWidth, 640);
});

test("camelCase maxWidth is accepted", () => {
  assert.equal(resolveConfig({ maxWidth: 640 }).maxWidth, 640);
});

test("content list is joined into a selector string", () => {
  const cfg = resolveConfig({ content: ["#a", ".b"] });
  assert.equal(cfg.content, "#a, .b");
});

test("scalar exclude becomes a list", () => {
  assert.deepEqual(resolveConfig({ exclude: ".sidebar a" }).exclude, [".sidebar a"]);
});

// Metadata routed through pandoc.utils.stringify arrives as strings.
test("string delay from YAML metadata is coerced to numbers", () => {
  assert.deepEqual(resolveConfig({ delay: "250" }).delay, [250, 0]);
});

test("string delay pair is coerced to numbers", () => {
  assert.deepEqual(resolveConfig({ delay: ["250", "100"] }).delay, [250, 100]);
});

test("string max-width is coerced to a number", () => {
  assert.equal(resolveConfig({ "max-width": "640" }).maxWidth, 640);
});

test("non-numeric delay falls back to the default", () => {
  assert.deepEqual(resolveConfig({ delay: "soon" }).delay, [300, 0]);
});

// Number("") and Number(null) are both 0; an explicit empty YAML value must
// not silently become a zero delay/width.
test("empty-string delay falls back to the default", () => {
  assert.deepEqual(resolveConfig({ delay: "" }).delay, [300, 0]);
});

test("null max-width falls back to the default", () => {
  assert.equal(resolveConfig({ "max-width": null }).maxWidth, 500);
});

test("non-numeric max-width falls back to the default", () => {
  assert.equal(resolveConfig({ "max-width": "wide" }).maxWidth, 500);
});

test("valid placement is accepted", () => {
  assert.equal(resolveConfig({ placement: "right-start" }).placement, "right-start");
});

test("placement is trimmed and lowercased", () => {
  assert.equal(resolveConfig({ placement: " Right " }).placement, "right");
});

test("unknown placement falls back to the default", () => {
  assert.equal(resolveConfig({ placement: "sideways" }).placement, "bottom-start");
});

test("arrow true is accepted", () => {
  assert.equal(resolveConfig({ arrow: true }).arrow, true);
});

// Metadata that detours through pandoc.utils.stringify arrives as a string.
test("string arrow is coerced to a boolean", () => {
  assert.equal(resolveConfig({ arrow: "true" }).arrow, true);
  assert.equal(resolveConfig({ arrow: "false" }).arrow, false);
});

test("unknown keys are ignored", () => {
  const cfg = resolveConfig({ bogus: true });
  assert.equal(cfg.bogus, undefined);
  assert.deepEqual(cfg.delay, [300, 0]);
});
