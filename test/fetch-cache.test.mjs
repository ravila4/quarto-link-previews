import test from "node:test";
import assert from "node:assert/strict";

import {
  getOrFetch,
  checkResponse,
  shouldApply,
} from "../_extensions/link-previews/link-previews.js";

test("repeated keys reuse the cached promise", async () => {
  const cache = new Map();
  let calls = 0;
  const producer = async () => {
    calls += 1;
    return "content";
  };
  const p1 = getOrFetch(cache, "k", producer);
  const p2 = getOrFetch(cache, "k", producer);
  assert.equal(p1, p2);
  assert.equal(await p1, "content");
  assert.equal(calls, 1);
});

test("different keys invoke the producer separately", async () => {
  const cache = new Map();
  let calls = 0;
  const producer = async () => {
    calls += 1;
    return "content";
  };
  await getOrFetch(cache, "k1", producer);
  await getOrFetch(cache, "k2", producer);
  assert.equal(calls, 2);
});

test("a rejected entry is evicted so the next call retries", async () => {
  const cache = new Map();
  let calls = 0;
  const producer = async () => {
    calls += 1;
    if (calls === 1) throw new Error("boom");
    return "recovered";
  };
  await assert.rejects(getOrFetch(cache, "k", producer));
  assert.equal(await getOrFetch(cache, "k", producer), "recovered");
  assert.equal(calls, 2);
});

const res = (over = {}) => ({
  ok: true,
  status: 200,
  headers: { get: () => ("contentType" in over ? over.contentType : "text/html; charset=utf-8") },
  ...over,
});

test("checkResponse passes an ok text/html response through", () => {
  const r = res();
  assert.equal(checkResponse(r), r);
});

test("checkResponse throws on a bad status", () => {
  assert.throws(() => checkResponse(res({ ok: false, status: 404 })));
});

test("checkResponse throws on a non-HTML content type", () => {
  assert.throws(() => checkResponse(res({ contentType: "application/json" })));
});

test("checkResponse tolerates a missing content-type header", () => {
  assert.throws(() => checkResponse(res({ contentType: null })));
});

// Staleness guard: a fetch that resolves after the popover moved on to a
// newer request must not touch the instance.
test("shouldApply accepts only the current generation", () => {
  assert.equal(shouldApply(1, 1), true);
  assert.equal(shouldApply(1, 2), false);
});
