# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

HackerNav is a Chrome extension (Manifest V3) that improves comment navigation on Hacker News. It replaces HN's default comment collapse (which hides the comment entirely) with a progressive-disclosure tree: only top-level comments are shown on load, and expanding a comment reveals its direct children (each starting collapsed).

## Build & Development

No build step required — the extension is plain JS/CSS loaded directly by Chrome.

- **Install:** `npm install` (only needed for linting/formatting)
- **Lint:** `npm run lint`
- **Format:** `npm run format`
- **Load in Chrome:** Go to `chrome://extensions`, enable Developer Mode, click "Load unpacked", select this directory.

## Architecture

The extension has three files that Chrome loads:

- **manifest.json** — Manifest V3 config. Content script injected on `news.ycombinator.com/item*` pages at `document_idle`.
- **content.js** — Single IIFE that parses HN's flat comment table into a tree and manages expand/collapse.
- **styles.css** — Minimal styles for chevron toggles and descendant counts. Hides HN's original `a.togg` element.

### How HN Comments Work in the DOM

HN renders comments as a flat `<table class="comment-tree">` with `<tr class="athing comtr">` rows. Nesting is encoded via `<td class="ind"><img width="N">` where `N = depth * 40`. There is no actual DOM nesting of parent/child comments.

### How HackerNav Works

1. **Parse:** Reads all `tr.athing.comtr` rows and extracts depth from the indent image width.
2. **Build tree:** Walks rows sequentially using a stack to establish parent-child relationships from the flat list.
3. **Inject controls:** Adds a chevron toggle (`span.hn-toggle`) and descendant count (`span.hn-desc-count`) into each comment's `span.comhead`.
4. **Initial state:** All top-level comments visible but collapsed (children hidden via `hn-hidden` class). Non-top-level rows get `hn-hidden`.
5. **Toggle:** Clicking a chevron shows/hides direct children. Shown children always start collapsed (their descendants remain hidden).

### Key DOM Classes

- `hn-hidden` — Applied to `tr.athing.comtr` rows to hide them
- `hn-toggle` — The chevron span (contains `\u25B6` collapsed or `\u25BC` expanded)
- `hn-desc-count` — The reply count label
