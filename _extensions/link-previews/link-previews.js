// link-previews: hover previews for internal links on Quarto websites.
//
// Layout: pure, DOM-free functions first (imported directly by node:test);
// DOM glue at the bottom behind a `typeof document` guard so the module is
// importable under Node without a DOM shim.

export const VERSION = "0.1.0";

// ---------------------------------------------------------------------------
// DOM glue
// ---------------------------------------------------------------------------

if (typeof document !== "undefined") {
  console.log("link-previews: module loaded", VERSION);
}
