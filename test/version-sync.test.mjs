import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { VERSION } from "../_extensions/link-previews/link-previews.js";

// The version string lives in four places; CI blocks drift between them.
const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");

test("_extension.yml version matches the module", () => {
  const match = read("../_extensions/link-previews/_extension.yml").match(/^version:\s*(\S+)/m);
  assert.equal(match?.[1], VERSION);
});

test("Lua dependency version matches the module", () => {
  const match = read("../_extensions/link-previews/link-previews.lua").match(
    /version\s*=\s*"([^"]+)"/,
  );
  assert.equal(match?.[1], VERSION);
});

test("CHANGELOG has an entry for the module version", () => {
  assert.match(read("../CHANGELOG.md"), new RegExp(`^## \\[${VERSION.replace(/\./g, "\\.")}\\]`, "m"));
});
