# Changelog

All notable changes to this project will be documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [0.3.0] - 2026-08-14

### Added

- `placement` option: which side of the link the popover opens on. Any tippy
  placement (`top`, `bottom`, `left`, `right`, `auto`, each with optional
  `-start`/`-end` suffix); default stays `bottom-start`. When a side runs
  out of room the popover tries the other alignment of that side, the
  opposite side, then below/above the link, instead of clipping at the
  viewport edge.
- `arrow` option (default `false`): a small arrow from the popover to the
  link, speech-bubble style. The arrow anchors to the same line box as the
  popover, so it points at the line under the pointer even on wrapped links.
  The YAML 1.1 boolean spellings (`yes`, `on`, `1`), which pandoc parses as
  strings, are accepted; unrecognized values warn on the console.

### Fixed

- The popover clipped its rounded corners on the tippy box itself, which
  would also have clipped the arrow; the clip now lives on the content node.
  No visible change without `arrow: true`.

## [0.2.0] - 2026-08-02

### Added

- Options can also be written nested under a top-level `extensions:` key,
  as `extensions: link-previews:`. The existing top-level `link-previews:`
  spelling keeps working; keys from both are combined and the nested one
  wins a tie. Nesting is what editor tooling completes against `_schema.yml`,
  and it keeps the site metadata root uncluttered.
- `_schema.yml` and `_snippets.json`, so Quarto Wizard offers completion,
  hover documentation, validation, and snippets for the options.
- A root `example.qmd`: the smallest working setup, which the extension
  listings ask submissions to provide.

### Fixed

- A link that wraps across two lines anchored its popover to the union of
  its line boxes, which spans most of the text column. Hovering the tail end
  of one line could open the preview a full column width away, too far to
  reach before the pointer left the link and the popover hid. The popover now
  anchors to the line box the pointer is in.

## [0.1.5] - 2026-08-02

### Fixed

- Banner bleed reaches the popover's right edge: the banner sits inside the
  title-block header (a page-columns element), so the grid flatten's child
  width cap was holding its right edge ~two paddings short.

## [0.1.4] - 2026-08-02

### Fixed

- Banner title blocks bleed to the popover edges with their own internal
  padding, instead of floating inset with title text flush against the
  color boundary (regression from the 0.1.3 grid flatten).

### Changed

- Popover border derives from the text color and the box gets an elevation
  shadow; the previous stock Bootstrap border gray disappeared against
  themes with a nearby background.
- Preview text rides tippy's 0.875rem instead of shrinking a further 15%.
- New styling hooks, settable on `:root`: `--link-preview-font-size`,
  `--link-preview-border-color`, `--link-preview-shadow`.

## [0.1.3] - 2026-08-01

### Fixed

- Preview content no longer overflows horizontally: Quarto `page-columns`
  grids (title banners) flatten to normal flow, long code lines wrap, and
  wide tables scroll internally instead of widening the popover.
- Code-tools and code-copy buttons are hidden inside previews.

## [0.1.2] - 2026-08-01

### Fixed

- Relative URLs in previews of redirected pages (Quarto `aliases`) now
  resolve against the post-redirect URL instead of silently 404ing.
- Inline `on*` event-handler attributes are stripped from extracted content;
  they would otherwise fire when the cloned nodes attach to the document.
- Explicit empty/null `delay` and `max-width` values fall back to defaults
  instead of coercing to 0.
- Invalid `exclude`/`content` selectors log one console warning per selector
  instead of failing silently.

### Changed

- `quarto-required` raised to 1.8.27 to match the floor CI actually tests.
- CI injection asserts now cover the listing and fragment-scroll demo pages.

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
