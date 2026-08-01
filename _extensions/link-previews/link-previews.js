// link-previews: hover previews for internal links on Quarto websites.
//
// Layout: pure, DOM-free functions first (imported directly by node:test);
// DOM glue at the bottom behind a `typeof document` guard so the module is
// importable under Node without a DOM shim.

export const VERSION = "0.1.0";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

export const DEFAULTS = Object.freeze({
  content: "#title-block-header, #quarto-document-content",
  delay: [300, 0],
  maxWidth: 500,
  exclude: [],
});

export function resolveConfig(userCfg) {
  // quarto.json.encode emits an empty Lua table as [], not {}.
  const raw = userCfg && !Array.isArray(userCfg) ? userCfg : {};
  const cfg = {
    content: DEFAULTS.content,
    delay: [...DEFAULTS.delay],
    maxWidth: DEFAULTS.maxWidth,
    exclude: [...DEFAULTS.exclude],
  };
  if (raw.content !== undefined) {
    cfg.content = Array.isArray(raw.content) ? raw.content.join(", ") : String(raw.content);
  }
  if (raw.delay !== undefined) {
    cfg.delay = Array.isArray(raw.delay) ? [raw.delay[0] ?? 300, raw.delay[1] ?? 0] : [raw.delay, 0];
  }
  const maxWidth = raw["max-width"] ?? raw.maxWidth;
  if (maxWidth !== undefined) {
    cfg.maxWidth = maxWidth;
  }
  if (raw.exclude !== undefined) {
    cfg.exclude = Array.isArray(raw.exclude) ? raw.exclude.map(String) : [String(raw.exclude)];
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

// absolutize/rewriteSrcset are only for URLs found inside fetched HTML text.
// Live anchors always use the browser-resolved anchor.href / document.baseURI
// instead -- that rule is the entire subpath and <base href> defense.
export function absolutize(url, base) {
  if (!url || url.startsWith("data:")) {
    return url;
  }
  try {
    return new URL(url, base).href;
  } catch {
    return url;
  }
}

// Known limitation: commas inside candidate URLs are treated as separators.
export function rewriteSrcset(srcset, base) {
  if (!srcset) {
    return srcset;
  }
  return srcset
    .split(",")
    .map((candidate) => candidate.trim())
    .filter((candidate) => candidate.length > 0)
    .map((candidate) => {
      const [url, ...descriptors] = candidate.split(/\s+/);
      return [absolutize(url, base), ...descriptors].join(" ");
    })
    .join(", ");
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
// request, and a rejected entry is evicted so a later hover can retry.
export function getOrFetch(cache, key, producer) {
  const cached = cache.get(key);
  if (cached) {
    return cached;
  }
  const promise = producer(key);
  cache.set(key, promise);
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

// Elements that are inert or broken inside a preview: scripts never execute
// after innerHTML insertion, iframes would load live embeds mid-hover.
export const STRIP_SELECTOR = "script, iframe";

// ---------------------------------------------------------------------------
// DOM glue
// ---------------------------------------------------------------------------

if (typeof document !== "undefined") {
  console.log("link-previews: module loaded", VERSION);
}
