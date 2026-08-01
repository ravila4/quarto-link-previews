import test from "node:test";
import assert from "node:assert/strict";

import { canonicalizeUrl, splitTarget } from "../_extensions/link-previews/link-previews.js";

// canonicalizeUrl is the single URL-identity function: same-page detection,
// fetch-cache keys, and origin comparison all go through it, so /foo,
// /foo/, and /foo/index.html must collapse to one form.

test("extensionless path gains a trailing slash", () => {
  assert.equal(canonicalizeUrl("https://x.test/foo"), "https://x.test/foo/");
});

test("trailing-slash path is unchanged", () => {
  assert.equal(canonicalizeUrl("https://x.test/foo/"), "https://x.test/foo/");
});

test("index.html collapses to the directory", () => {
  assert.equal(canonicalizeUrl("https://x.test/foo/index.html"), "https://x.test/foo/");
});

test("root index.html collapses to root", () => {
  assert.equal(canonicalizeUrl("https://x.test/index.html"), "https://x.test/");
});

test("case is preserved, never folded", () => {
  assert.notEqual(canonicalizeUrl("https://x.test/Foo/"), canonicalizeUrl("https://x.test/foo/"));
});

test("query string survives canonicalization", () => {
  assert.equal(canonicalizeUrl("https://x.test/foo?x=1"), "https://x.test/foo/?x=1");
});

test("hash is stripped", () => {
  assert.equal(canonicalizeUrl("https://x.test/foo#y"), "https://x.test/foo/");
});

test("non-index html page keeps its filename", () => {
  assert.equal(canonicalizeUrl("https://x.test/page.html"), "https://x.test/page.html");
});

test("splitTarget separates fetch URL from fragment", () => {
  assert.deepEqual(splitTarget("https://x.test/foo#sec"), {
    fetchUrl: "https://x.test/foo/",
    fragment: "sec",
  });
});

test("splitTarget without hash has null fragment", () => {
  assert.deepEqual(splitTarget("https://x.test/foo/"), {
    fetchUrl: "https://x.test/foo/",
    fragment: null,
  });
});

// URL rewriting of fetched content lives in sanitizeRewrite; see
// test/sanitize.test.mjs.
