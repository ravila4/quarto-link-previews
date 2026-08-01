import test from "node:test";
import assert from "node:assert/strict";

import { sanitizeRewrite } from "../_extensions/link-previews/link-previews.js";

const BASE = "https://x.test/posts/p1/";

// Fetched-content URLs are propagated into an interactive popover, so
// anything that is not plainly navigable is dropped (null -> remove the
// attribute), not passed through.

test("relative href resolves against the base", () => {
  assert.equal(sanitizeRewrite("href", "other/", BASE), "https://x.test/posts/p1/other/");
});

test("javascript: href is dropped", () => {
  assert.equal(sanitizeRewrite("href", "javascript:alert(1)", BASE), null);
});

test("data: href is dropped", () => {
  assert.equal(sanitizeRewrite("href", "data:text/html,hi", BASE), null);
});

test("mailto: href is dropped", () => {
  assert.equal(sanitizeRewrite("href", "mailto:a@b.test", BASE), null);
});

test("data: image src is kept", () => {
  const data = "data:image/png;base64,xyz";
  assert.equal(sanitizeRewrite("src", data, BASE), data);
});

test("javascript: src is dropped", () => {
  assert.equal(sanitizeRewrite("src", "javascript:alert(1)", BASE), null);
});

test("relative src resolves", () => {
  assert.equal(sanitizeRewrite("src", "images/a.png", BASE), "https://x.test/posts/p1/images/a.png");
});

test("parent-relative src resolves", () => {
  assert.equal(sanitizeRewrite("src", "../b.png", BASE), "https://x.test/posts/b.png");
});

test("root-relative src keeps the origin", () => {
  assert.equal(sanitizeRewrite("src", "/c.png", BASE), "https://x.test/c.png");
});

test("absolute cross-origin URL is kept", () => {
  assert.equal(sanitizeRewrite("src", "https://other.test/d.png", BASE), "https://other.test/d.png");
});

test("srcset candidates resolve with descriptors kept", () => {
  assert.equal(
    sanitizeRewrite("srcset", "a.png 1x, b.png 2x", BASE),
    "https://x.test/posts/p1/a.png 1x, https://x.test/posts/p1/b.png 2x",
  );
});

test("srcset with tight commas and width descriptors", () => {
  assert.equal(
    sanitizeRewrite("srcset", "a.png 480w,b.png 800w", BASE),
    "https://x.test/posts/p1/a.png 480w, https://x.test/posts/p1/b.png 800w",
  );
});

test("srcset keeps only http(s) candidates", () => {
  assert.equal(
    sanitizeRewrite("srcset", "a.png 1x, javascript:alert(1) 2x", BASE),
    "https://x.test/posts/p1/a.png 1x",
  );
});

test("srcset with no safe candidates is dropped", () => {
  assert.equal(sanitizeRewrite("srcset", "javascript:alert(1) 1x", BASE), null);
});

test("empty value is dropped", () => {
  assert.equal(sanitizeRewrite("href", "", BASE), null);
});
