# Changelog

All notable changes to this project will be documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/).

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
