# HackerNav

A Chrome extension that improves comment navigation on [Hacker News](https://news.ycombinator.com).

![HackerNav preview](hackernav-preview.png)

## What It Does

HackerNav replaces HN's default comment UI with a cleaner, tree-based interface:

- **Progressive disclosure** — On load, only top-level comments are visible. Clicking the sidebar toggle reveals direct replies (each starting collapsed). Comment text always stays visible.
- **Reply count pills** — Each comment shows direct and total reply counts at a glance.
- **Card layout** — Comments are rendered as bordered cards with a collapsible sidebar strip instead of HN's flat indented rows.
- **Inline voting** — Upvote/downvote buttons are moved into the comment header, replacing HN's native vote column.
- **Quote styling** — Lines starting with `>` get a left-border blockquote treatment.
- **Keyboard navigation** — Arrow keys move between visible comments, left/right toggle expand/collapse, and space walks the tree depth-first.
- **Multi-page support** — Works on item (thread), threads (user comments), and newcomments pages.

## Install

1. Clone this repo
2. Go to `chrome://extensions` in Chrome
3. Enable **Developer mode**
4. Click **Load unpacked** and select this directory

## Development

No build step — Chrome loads the JS/CSS directly.

```
npm install    # install eslint/prettier
npm run lint   # lint
npm run format # format
```

## License

MIT
