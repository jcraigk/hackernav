# HackerNav

A Chrome extension that improves comment navigation on [Hacker News](https://news.ycombinator.com).

## What It Does

HN's default comment collapse hides the comment entirely. HackerNav replaces this with progressive disclosure:

- On load, only top-level comments are visible, each with a reply count
- Clicking the `▶` chevron on a comment reveals its direct replies (each starting collapsed)
- Clicking `▼` collapses a comment's children back down
- The comment text always remains visible — only children are toggled

## Install

1. Clone this repo
2. Go to `chrome://extensions` in Chrome
3. Enable **Developer mode**
4. Click **Load unpacked** and select this directory

## Development

```
npm install    # install eslint/prettier
npm run lint   # lint
npm run format # format
```

No build step — Chrome loads the JS/CSS directly.

## License

MIT
