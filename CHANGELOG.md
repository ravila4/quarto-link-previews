# Changelog

All notable changes to this project will be documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [0.1.1] - 2026-08-01

### Fixed

- URLs rewritten into preview content are now protocol-filtered:
  `javascript:` (and other non-navigable) `href`/`src`/`srcset` values from
  the fetched page are dropped instead of cloned into the interactive
  popover. `data:` URIs remain allowed for images only.
- The extension no-ops on `file://` pages, where opaque origins made every
  link look same-origin and every hover fetch fail.

### Changed

- Preview fetch cache is capped at 30 entries (oldest evicted) so cached
  article DOMs cannot grow without bound on heavily-browsed listing pages.
- Loading/unavailable states are built as DOM nodes rather than HTML strings.
- CI render-smoke assertions tightened: exact module script-tag pattern,
  version-agnostic `site_libs` paths.

## [0.1.0] - 2026-08-01

### Added

- Hover previews for same-origin internal links, rendered from the target
  page's title block and article content via Quarto's bundled tippy.js.
- Card-level binding on default listing cards so the popover survives a
  mouse sweep across a card's several same-href anchors.
- Fragment links scroll the preview to the target section.
- Config surface: `content`, `delay`, `max-width`, `exclude`, and a
  per-page/site `enabled` kill switch.
- Per-link opt-outs: `.no-preview` class and `data-no-preview` attribute.
- Fetch cache shared across hovers; failed or non-HTML targets show a
  "No preview available" state and may retry on the next hover.
