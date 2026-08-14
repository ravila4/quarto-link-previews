// link-previews: hover previews for internal links on Quarto websites.
//
// Layout: pure, DOM-free functions first (imported directly by node:test);
// DOM glue at the bottom behind a `typeof document` guard so the module is
// importable under Node without a DOM shim.

export const VERSION = "0.3.0";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

export const DEFAULTS = Object.freeze({
  content: "#title-block-header, #quarto-document-content",
  delay: [300, 0],
  maxWidth: 500,
  exclude: [],
  placement: "bottom-start",
  arrow: false,
});

// The popper placements tippy accepts. `auto` picks the side with the most
// room; every placement flips to the opposite side when it runs out of space.
const PLACEMENTS = new Set([
  "auto", "auto-start", "auto-end",
  "top", "top-start", "top-end",
  "bottom", "bottom-start", "bottom-end",
  "left", "left-start", "left-end",
  "right", "right-start", "right-end",
]);

export function resolveConfig(userCfg) {
  // quarto.json.encode emits an empty Lua table as [], not {}.
  const raw = userCfg && !Array.isArray(userCfg) ? userCfg : {};
  const cfg = {
    content: DEFAULTS.content,
    delay: [...DEFAULTS.delay],
    maxWidth: DEFAULTS.maxWidth,
    exclude: [...DEFAULTS.exclude],
    placement: DEFAULTS.placement,
    arrow: DEFAULTS.arrow,
  };
  if (raw.content !== undefined) {
    cfg.content = Array.isArray(raw.content) ? raw.content.join(", ") : String(raw.content);
  }
  // Metadata routed through the Lua filter arrives stringified; coerce and
  // fall back to defaults on anything non-numeric. Number("") and
  // Number(null) are 0, so empty values must be rejected before coercion.
  const toNumber = (value, fallback) => {
    if (value === "" || value == null) {
      return fallback;
    }
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  };
  if (raw.delay !== undefined) {
    cfg.delay = Array.isArray(raw.delay)
      ? [toNumber(raw.delay[0], 300), toNumber(raw.delay[1], 0)]
      : [toNumber(raw.delay, 300), 0];
  }
  const maxWidth = raw["max-width"] ?? raw.maxWidth;
  if (maxWidth !== undefined) {
    cfg.maxWidth = toNumber(maxWidth, DEFAULTS.maxWidth);
  }
  if (raw.exclude !== undefined) {
    cfg.exclude = Array.isArray(raw.exclude) ? raw.exclude.map(String) : [String(raw.exclude)];
  }
  if (raw.placement !== undefined) {
    const placement = String(raw.placement).trim().toLowerCase();
    if (PLACEMENTS.has(placement)) {
      cfg.placement = placement;
    } else {
      // A typo'd placement must not fail silently (same rule as selectors).
      console.warn(
        `link-previews: unknown placement ${JSON.stringify(raw.placement)}, ` +
          `using ${DEFAULTS.placement}`,
      );
    }
  }
  if (raw.arrow !== undefined) {
    cfg.arrow = raw.arrow === true || raw.arrow === "true";
  }
  return cfg;
}

// ---------------------------------------------------------------------------
// URL identity and rewriting
// ---------------------------------------------------------------------------

// The single URL-identity function: same-page detection, fetch-cache keys,
// and origin comparison all go through it, so /foo, /foo/, and
// /foo/index.html collapse to one form. Case is never folded -- static hosts
// can serve genuinely distinct same-cased-differently paths.
export function canonicalizeUrl(url) {
  const u = new URL(url);
  u.hash = "";
  if (u.pathname.endsWith("/index.html")) {
    u.pathname = u.pathname.slice(0, -"index.html".length);
  } else {
    const lastSegment = u.pathname.slice(u.pathname.lastIndexOf("/") + 1);
    if (lastSegment !== "" && !lastSegment.includes(".")) {
      u.pathname += "/";
    }
  }
  return u.href;
}

export function splitTarget(href) {
  const u = new URL(href);
  const fragment = u.hash ? decodeURIComponent(u.hash.slice(1)) : null;
  return { fetchUrl: canonicalizeUrl(href), fragment };
}

// Rewrite policy for URLs found in fetched content, per attribute. Live
// anchors always use the browser-resolved anchor.href instead -- that rule
// is the entire subpath and <base href> defense. The
// result lands in an interactive popover, so anything that is not plainly
// navigable is dropped (null means "remove the attribute") rather than
// propagated -- a same-origin page carrying a javascript: href must not have
// it cloned into the preview.
const SAFE_PROTOCOLS = { href: ["http:", "https:"], src: ["http:", "https:", "data:"] };

function resolvedIfSafe(url, base, protocols) {
  if (!url) {
    return null;
  }
  let resolved;
  try {
    resolved = new URL(url, base);
  } catch {
    return null;
  }
  if (!protocols.includes(resolved.protocol)) {
    return null;
  }
  return url.startsWith("data:") ? url : resolved.href;
}

export function sanitizeRewrite(attr, value, base) {
  // Known limitation: commas inside srcset candidate URLs are treated as
  // separators.
  if (attr === "srcset") {
    if (!value) {
      return null;
    }
    const safe = value
      .split(",")
      .map((candidate) => candidate.trim())
      .filter((candidate) => candidate.length > 0)
      .map((candidate) => {
        const [url, ...descriptors] = candidate.split(/\s+/);
        const resolved = resolvedIfSafe(url, base, SAFE_PROTOCOLS.src);
        return resolved === null ? null : [resolved, ...descriptors].join(" ");
      })
      .filter((candidate) => candidate !== null);
    return safe.length > 0 ? safe.join(", ") : null;
  }
  return resolvedIfSafe(value, base, SAFE_PROTOCOLS[attr] ?? SAFE_PROTOCOLS.href);
}

// ---------------------------------------------------------------------------
// Link eligibility
// ---------------------------------------------------------------------------

// Quarto UI chrome plus opt-outs. Deliberately absent: `no-external`, which
// Quarto puts on every default listing-card anchor (it suppresses the
// external-link icon, nothing more), and `quarto-grid-link` on grid listings.
// Listing cards are a primary preview surface -- do not "fix" this list by
// copying Quarto's external-link exclusion selector.
const SKIP_CLASSES = new Set([
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
]);

const SKIP_ATTRS = ["data-no-preview", "data-glightbox", "aria-hidden", "download"];

const NON_HTML_EXTENSIONS = new Set([
  "pdf", "zip", "gz", "tgz", "tar",
  "png", "jpg", "jpeg", "gif", "svg", "webp", "avif", "ico",
  "mp4", "webm", "mov", "mp3", "wav",
  "xml", "json", "yaml", "yml", "ipynb", "qmd", "md",
  "css", "js", "mjs", "txt", "csv", "tsv", "parquet", "rds",
]);

export function isEligible(link, page, config) {
  let target;
  try {
    target = new URL(link.href);
  } catch {
    return { ok: false, reason: "unparseable-url" };
  }
  if (target.protocol !== "http:" && target.protocol !== "https:") {
    return { ok: false, reason: `protocol:${target.protocol}` };
  }
  if (target.origin !== new URL(page.href).origin) {
    return { ok: false, reason: "cross-origin" };
  }
  if (canonicalizeUrl(link.href) === canonicalizeUrl(page.href)) {
    return { ok: false, reason: "same-page" };
  }
  for (const cls of link.classes ?? []) {
    if (SKIP_CLASSES.has(cls)) {
      return { ok: false, reason: `class:${cls}` };
    }
  }
  const attrs = link.attrs ?? {};
  if (attrs.role === "doc-noteref") {
    return { ok: false, reason: "attr:role=doc-noteref" };
  }
  for (const attr of SKIP_ATTRS) {
    if (attr in attrs) {
      return { ok: false, reason: `attr:${attr}` };
    }
  }
  const lastSegment = target.pathname.slice(target.pathname.lastIndexOf("/") + 1);
  const dot = lastSegment.lastIndexOf(".");
  if (dot > -1) {
    const extension = lastSegment.slice(dot + 1).toLowerCase();
    if (extension !== "html" && extension !== "htm" && NON_HTML_EXTENSIONS.has(extension)) {
      return { ok: false, reason: `extension:${extension}` };
    }
  }
  return { ok: true, reason: null };
}

// A side placement can fail on both sides at once: a wide reference (a
// listing card) in a modest viewport leaves less than max-width on either
// side, and popper's default fallback -- the opposite side only -- then keeps
// the least-bad side and lets the popover clip off-screen. Extend the
// fallback chain with the vertical placements so it degrades to below/above
// the link instead. Vertical and auto placements keep popper's defaults.
export function flipFallbacks(placement) {
  const [side, suffix] = placement.split("-");
  if (side !== "left" && side !== "right") {
    return null;
  }
  const opposite = side === "left" ? "right" : "left";
  const tail = suffix ? `-${suffix}` : "";
  return [`${opposite}${tail}`, `bottom${tail}`, `top${tail}`];
}

// ---------------------------------------------------------------------------
// Binding plan
// ---------------------------------------------------------------------------

// Default Quarto listing cards contain several anchors that all point at the
// same page (title, subtitle, description, date). Independent tippy instances
// would hide and re-show as the mouse sweeps one card, so those groups
// collapse to a single binding on the card element.
export function planBindings(anchors) {
  const cardGroups = new Map();
  for (const anchor of anchors) {
    if (anchor.cardId != null) {
      const group = cardGroups.get(anchor.cardId) ?? [];
      group.push(anchor);
      cardGroups.set(anchor.cardId, group);
    }
  }

  const emittedCards = new Set();
  const plan = [];
  for (const anchor of anchors) {
    const group = anchor.cardId != null ? cardGroups.get(anchor.cardId) : null;
    const collapses =
      group != null && group.length >= 2 && group.every((a) => a.href === group[0].href);
    if (!collapses) {
      plan.push({ type: "anchor", anchorId: anchor.id, href: anchor.href });
    } else if (!emittedCards.has(anchor.cardId)) {
      emittedCards.add(anchor.cardId);
      plan.push({
        type: "card",
        cardId: anchor.cardId,
        href: group[0].href,
        anchorIds: group.map((a) => a.id),
      });
    }
  }
  return plan;
}

// ---------------------------------------------------------------------------
// Fetch cache
// ---------------------------------------------------------------------------

// Caches the promise, not the result: concurrent hovers share one in-flight
// request, and a rejected entry is evicted so a later hover can retry. A
// caller that read the entry in the same tick as the eviction still holds
// the rejected promise, which is benign: its catch path runs and the next
// hover produces a fresh entry. Size-capped because cached templates keep
// full article DOMs (and their decoded images) alive.
export function getOrFetch(cache, key, producer, maxSize = 30) {
  const cached = cache.get(key);
  if (cached) {
    return cached;
  }
  const promise = producer(key);
  cache.set(key, promise);
  if (cache.size > maxSize) {
    cache.delete(cache.keys().next().value);
  }
  promise.catch(() => cache.delete(key));
  return promise;
}

export function checkResponse(response) {
  if (!response.ok) {
    throw new Error(`link-previews: HTTP ${response.status}`);
  }
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("text/html")) {
    throw new Error(`link-previews: not HTML (${contentType || "no content-type"})`);
  }
  return response;
}

// Staleness guard: a fetch resolving after the popover moved on to a newer
// request must not touch the instance.
export function shouldApply(requestGeneration, currentGeneration) {
  return requestGeneration === currentGeneration;
}

// Elements removed from extracted content before display. Removing script
// tags stops ordinary script execution, but attached clones can still fire
// inline on* handler attributes -- the glue strips those separately.
export const STRIP_SELECTOR = "script, iframe";

// ---------------------------------------------------------------------------
// DOM glue
// ---------------------------------------------------------------------------

function initLinkPreviews() {
  // file:// origins are opaque, so every link compares as same-origin and
  // every fetch is doomed; a double-clicked rendered HTML file should not
  // show a broken-looking "No preview available" on each hover.
  if (window.location.protocol !== "http:" && window.location.protocol !== "https:") {
    return;
  }
  if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
    return;
  }
  if (typeof window.tippy !== "function") {
    console.info(
      "link-previews: tippy.js not found; enable footnotes-hover, crossrefs-hover, " +
        "or citations-hover, or remove the link-previews filter",
    );
    return;
  }
  const start = () => {
    try {
      bindAll();
    } catch (err) {
      console.warn("link-previews: setup failed", err);
    }
  };
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
}

function readConfig() {
  const tag = document.getElementById("link-previews-config");
  let parsed = {};
  if (tag) {
    try {
      parsed = JSON.parse(tag.textContent);
    } catch (err) {
      console.warn("link-previews: invalid config, using defaults", err);
    }
  }
  return resolveConfig(parsed);
}

// Attributes isEligible cares about, mirrored into plain data.
const ADAPTER_ATTRS = ["role", "data-no-preview", "data-glightbox", "aria-hidden", "download"];

function toLinkData(el) {
  const attrs = {};
  for (const name of ADAPTER_ATTRS) {
    if (el.hasAttribute(name)) {
      attrs[name] = el.getAttribute(name);
    }
  }
  return { href: el.href, classes: [...el.classList], attrs };
}

// A typo'd selector must not fail silently: warn once per selector so a site
// owner can find out from the console why their config does nothing.
const warnedSelectors = new Set();

function warnBadSelector(selector, err) {
  if (!warnedSelectors.has(selector)) {
    warnedSelectors.add(selector);
    console.warn(`link-previews: invalid selector ${JSON.stringify(selector)}`, err);
  }
}

function matchesAny(el, selectors) {
  return selectors.some((selector) => {
    try {
      return el.matches(selector);
    } catch (err) {
      warnBadSelector(selector, err);
      return false;
    }
  });
}

function bindAll() {
  const cfg = readConfig();
  const page = { href: window.location.href };

  // One scan at load. Popover content is never re-scanned, which is also the
  // recursion guard: links inside a preview never get previews themselves.
  const eligible = [];
  for (const el of document.querySelectorAll("a[href]")) {
    if (!isEligible(toLinkData(el), page, cfg).ok) continue;
    if (matchesAny(el, cfg.exclude)) continue;
    eligible.push({ el, ...splitTarget(el.href) });
  }

  const cardElements = [];
  const cardIndex = new Map();
  const records = eligible.map((entry, i) => {
    const cardEl = entry.el.closest(".quarto-post");
    let cardId = null;
    if (cardEl) {
      if (!cardIndex.has(cardEl)) {
        cardIndex.set(cardEl, cardElements.length);
        cardElements.push(cardEl);
      }
      cardId = cardIndex.get(cardEl);
    }
    return { id: i, href: entry.fetchUrl, cardId };
  });

  for (const binding of planBindings(records)) {
    if (binding.type === "anchor") {
      const entry = eligible[binding.anchorId];
      bindPreview(entry.el, entry.fetchUrl, entry.fragment, cfg);
    } else {
      const first = eligible[binding.anchorIds[0]];
      bindPreview(cardElements[binding.cardId], first.fetchUrl, first.fragment, cfg);
    }
  }
}

const previewCache = new Map();

// ---------------------------------------------------------------------------
// Anchoring on wrapped links
// ---------------------------------------------------------------------------

// An inline link that wraps has one client rect per line box, and its
// bounding box is their union: for a link broken across a line the union
// spans most of the text column. Anchoring there can drop the popover a
// column width from the pointer, out of reach of the interactive border, so
// it hides before the reader can scroll it. Pick the line box the pointer is
// actually in. Distance is measured to the rect, clamped per axis, so a
// pointer inside one scores zero and the leading between two lines resolves
// to the nearer of them without a separate branch.
export function pickAnchorRectIndex(rects, pointer) {
  const count = rects?.length ?? 0;
  if (count < 2 || !pointer) {
    return 0;
  }
  let best = 0;
  let bestDistance = Infinity;
  for (let i = 0; i < count; i += 1) {
    const rect = rects[i];
    const dx = Math.max(rect.left - pointer.x, 0, pointer.x - rect.right);
    const dy = Math.max(rect.top - pointer.y, 0, pointer.y - rect.bottom);
    const distance = dx * dx + dy * dy;
    if (distance < bestDistance) {
      best = i;
      bestDistance = distance;
    }
  }
  return best;
}

function bindPreview(el, fetchUrl, fragment, cfg) {
  // Everything touching the tippy API is wrapped: presence of window.tippy
  // does not guarantee its shape if Quarto ever swaps its hover library.
  try {
    // Last pointer position over the link. Deliberately not cleared on
    // mouseleave: moving onto an interactive popover leaves the link, and
    // re-choosing the line box then would slide the popover out from under
    // the pointer. Keyboard focus never sets it, which is what anchors a
    // tabbed-to link at its first line.
    let pointerX = null;
    let pointerY = null;
    el.addEventListener(
      "mousemove",
      (event) => {
        pointerX = event.clientX;
        pointerY = event.clientY;
      },
      { passive: true },
    );

    // Fixed for the life of one popover so it cannot drift mid-read, but the
    // rect itself is re-read on every reposition so scrolling still tracks.
    let anchorIndex = 0;

    const fallbacks = flipFallbacks(cfg.placement);
    window.tippy(el, {
      theme: "quarto link-preview",
      allowHTML: true,
      interactive: true,
      interactiveBorder: 10,
      maxWidth: cfg.maxWidth,
      delay: cfg.delay,
      // Explicit: tippy's own default for arrow is true; ours is false.
      placement: cfg.placement,
      arrow: cfg.arrow,
      ...(fallbacks && {
        popperOptions: {
          modifiers: [{ name: "flip", options: { fallbackPlacements: fallbacks } }],
        },
      }),
      appendTo: () => document.body,
      trigger: "mouseenter focus",
      touch: false,
      content: stateHtml("loading", "Loading…"),
      getReferenceClientRect: () =>
        el.getClientRects()[anchorIndex] ?? el.getBoundingClientRect(),
      onShow(instance) {
        anchorIndex = pickAnchorRectIndex(
          el.getClientRects(),
          pointerX === null ? null : { x: pointerX, y: pointerY },
        );
        loadContent(instance, fetchUrl, fragment, cfg);
      },
    });
  } catch (err) {
    console.warn("link-previews: failed to bind", err);
  }
}

function loadContent(instance, fetchUrl, fragment, cfg) {
  const generation = (instance._linkPreviewGen = (instance._linkPreviewGen ?? 0) + 1);
  const live = () =>
    shouldApply(generation, instance._linkPreviewGen) && instance.state.isVisible;

  getOrFetch(previewCache, fetchUrl, (url) => fetchAndExtract(url, cfg))
    .then((template) => {
      if (!live()) return;
      try {
        const body = document.createElement("div");
        body.className = "link-preview-body";
        body.appendChild(template.cloneNode(true));
        instance.setContent(body);
        scrollToFragment(body, fragment);
      } catch (err) {
        console.warn("link-previews:", err);
      }
    })
    .catch(() => {
      if (!live()) return;
      try {
        instance.setContent(stateHtml("unavailable", "No preview available"));
      } catch {
        // tippy went away mid-flight; nothing to update
      }
    });
}

async function fetchAndExtract(url, cfg) {
  const response = checkResponse(await fetch(url));
  const doc = new DOMParser().parseFromString(await response.text(), "text/html");

  // Keep only top-level matches: with Quarto's defaults the title header sits
  // inside the main content container, so a contained match must not be
  // duplicated alongside its ancestor.
  const parts = [];
  let matches;
  try {
    matches = doc.querySelectorAll(cfg.content);
  } catch (err) {
    warnBadSelector(cfg.content, err);
    throw err;
  }
  for (const el of matches) {
    if (!parts.some((p) => p.contains(el))) {
      parts.push(el);
    }
  }
  if (parts.length === 0) {
    throw new Error("link-previews: no content matched");
  }

  const template = document.createElement("div");
  for (const part of parts) {
    template.appendChild(document.importNode(part, true));
  }
  for (const el of template.querySelectorAll(STRIP_SELECTOR)) {
    el.remove();
  }
  // Inline on* handlers would fire once the clone is attached to the live
  // document, unlike script tags.
  for (const el of template.querySelectorAll("*")) {
    for (const name of el.getAttributeNames()) {
      if (name.toLowerCase().startsWith("on")) {
        el.removeAttribute(name);
      }
    }
  }
  // Redirects (e.g. Quarto aliases) change the base for relative URLs;
  // response.url is the post-redirect URL.
  rewriteUrls(template, response.url || url);
  return template;
}

function rewriteUrls(root, baseUrl) {
  for (const attr of ["src", "href", "srcset"]) {
    for (const el of root.querySelectorAll(`[${attr}]`)) {
      const safe = sanitizeRewrite(attr, el.getAttribute(attr), baseUrl);
      if (safe === null) {
        el.removeAttribute(attr);
      } else {
        el.setAttribute(attr, safe);
      }
    }
  }
}

function scrollToFragment(container, fragment) {
  if (!fragment) return;
  // Wait for the popover to lay out, then scroll only the preview box --
  // scrollIntoView would also scroll the page itself.
  requestAnimationFrame(() => {
    let target = null;
    try {
      target = container.querySelector("#" + CSS.escape(fragment));
    } catch {
      return;
    }
    if (target) {
      container.scrollTop =
        target.getBoundingClientRect().top -
        container.getBoundingClientRect().top +
        container.scrollTop;
    }
  });
}

function stateHtml(state, label) {
  const div = document.createElement("div");
  div.className = `link-preview-body link-preview-${state}`;
  div.textContent = label;
  return div;
}

// Entry point last: everything above (including consts, which do not hoist)
// must be initialized before init runs synchronously.
if (typeof document !== "undefined") {
  initLinkPreviews();
}
