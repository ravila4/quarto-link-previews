import test from "node:test";
import assert from "node:assert/strict";

import {
  canonicalizeUrl,
  splitTarget,
  absolutize,
  rewriteSrcset,
} from "../_extensions/link-previews/link-previews.js";

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

// absolutize/rewriteSrcset are only for URLs found inside fetched HTML text;
// live anchors use the browser-resolved anchor.href instead.

test("relative src resolves against the fetched page URL", () => {
  assert.equal(
    absolutize("images/a.png", "https://x.test/posts/p1/"),
    "https://x.test/posts/p1/images/a.png",
  );
});

test("parent-relative src resolves", () => {
  assert.equal(absolutize("../b.png", "https://x.test/posts/p1/"), "https://x.test/posts/b.png");
});

test("root-relative src keeps the origin", () => {
  assert.equal(absolutize("/c.png", "https://x.test/posts/p1/"), "https://x.test/c.png");
});

test("absolute URL is unchanged", () => {
  assert.equal(absolutize("https://other.test/d.png", "https://x.test/"), "https://other.test/d.png");
});

test("data URI is unchanged", () => {
  const data = "data:image/png;base64,xyz";
  assert.equal(absolutize(data, "https://x.test/"), data);
});

test("empty string is unchanged", () => {
  assert.equal(absolutize("", "https://x.test/"), "");
});

test("srcset candidates are absolutized with descriptors kept", () => {
  assert.equal(
    rewriteSrcset("a.png 1x, b.png 2x", "https://x.test/p/"),
    "https://x.test/p/a.png 1x, https://x.test/p/b.png 2x",
  );
});

test("srcset with tight commas and width descriptors", () => {
  assert.equal(
    rewriteSrcset("a.png 480w,b.png 800w", "https://x.test/p/"),
    "https://x.test/p/a.png 480w, https://x.test/p/b.png 800w",
  );
});

test("srcset single candidate without descriptor", () => {
  assert.equal(rewriteSrcset("a.png", "https://x.test/p/"), "https://x.test/p/a.png");
});

test("empty srcset is unchanged", () => {
  assert.equal(rewriteSrcset("", "https://x.test/p/"), "");
});
