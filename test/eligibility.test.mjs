import test from "node:test";
import assert from "node:assert/strict";

import { isEligible } from "../_extensions/link-previews/link-previews.js";

const PAGE = { href: "https://x.test/posts/current/" };

const link = (href, { classes = [], attrs = {} } = {}) => ({ href, classes, attrs });

test("same-origin cross-page link is eligible", () => {
  const r = isEligible(link("https://x.test/posts/other/"), PAGE, {});
  assert.equal(r.ok, true);
});

test("cross-page link with fragment is eligible", () => {
  const r = isEligible(link("https://x.test/posts/other/#sec"), PAGE, {});
  assert.equal(r.ok, true);
});

test("cross-origin link is skipped", () => {
  assert.equal(isEligible(link("https://other.test/a/"), PAGE, {}).ok, false);
});

test("mailto link is skipped", () => {
  assert.equal(isEligible(link("mailto:a@b.test"), PAGE, {}).ok, false);
});

test("javascript: link is skipped", () => {
  assert.equal(isEligible(link("javascript:void(0)"), PAGE, {}).ok, false);
});

test("same-page link is skipped even as index.html form", () => {
  const r = isEligible(link("https://x.test/posts/current/index.html"), PAGE, {});
  assert.equal(r.ok, false);
});

test("same-page fragment link is skipped", () => {
  const r = isEligible(link("https://x.test/posts/current/#sec"), PAGE, {});
  assert.equal(r.ok, false);
});

// Primary preview surfaces, pinned deliberately:
// Quarto puts .no-external on every default listing-card anchor and
// .quarto-grid-link on grid-listing anchors. They MUST stay eligible.
// Do not "fix" this by copying Quarto's external-link exclusion selector,
// which excludes .no-external for an unrelated reason (icon suppression).
test("listing-card .no-external anchors stay eligible", () => {
  const r = isEligible(link("https://x.test/posts/other/", { classes: ["no-external"] }), PAGE, {});
  assert.equal(r.ok, true);
});

test("grid-listing .quarto-grid-link anchors stay eligible", () => {
  const r = isEligible(
    link("https://x.test/posts/other/", { classes: ["quarto-grid-link"] }),
    PAGE,
    {},
  );
  assert.equal(r.ok, true);
});

test("target=_blank stays eligible", () => {
  const r = isEligible(link("https://x.test/posts/other/", { attrs: { target: "_blank" } }), PAGE, {});
  assert.equal(r.ok, true);
});

for (const cls of [
  "no-preview",
  "quarto-xref",
  "lightbox",
  "nav-link",
  "navbar-brand",
  "toc-action",
  "sidebar-link",
  "sidebar-item-toggle",
  "pagination-link",
  "dropdown-item",
  "quarto-navigation-tool",
  "about-link",
]) {
  test(`class ${cls} is skipped`, () => {
    const r = isEligible(link("https://x.test/posts/other/", { classes: [cls] }), PAGE, {});
    assert.equal(r.ok, false);
  });
}

test("footnote refs (role=doc-noteref) are skipped", () => {
  const r = isEligible(
    link("https://x.test/posts/other/", { attrs: { role: "doc-noteref" } }),
    PAGE,
    {},
  );
  assert.equal(r.ok, false);
});

for (const attr of ["data-no-preview", "data-glightbox", "aria-hidden", "download"]) {
  test(`attribute ${attr} is skipped`, () => {
    const r = isEligible(link("https://x.test/posts/other/", { attrs: { [attr]: "" } }), PAGE, {});
    assert.equal(r.ok, false);
  });
}

test("image href is skipped", () => {
  assert.equal(isEligible(link("https://x.test/img/a.png"), PAGE, {}).ok, false);
});

test("pdf href is skipped", () => {
  assert.equal(isEligible(link("https://x.test/paper.pdf"), PAGE, {}).ok, false);
});

test("html href is eligible", () => {
  assert.equal(isEligible(link("https://x.test/page.html"), PAGE, {}).ok, true);
});

test("skip reasons are reported", () => {
  const r = isEligible(link("https://other.test/"), PAGE, {});
  assert.equal(typeof r.reason, "string");
  assert.ok(r.reason.length > 0);
});
