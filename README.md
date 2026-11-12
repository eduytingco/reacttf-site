# REACT website

Static front end: plain HTML + CSS, with TypeScript compiled to JavaScript.

```
index.html            home page
page.html             secondary page template (page.html?page=<slug>)
messages.properties   all user-facing text  ← edit copy here
static/partials/      shared header.html and footer.html
static/data/pages.json  content for each secondary page
scss/                 SCSS source  ← edit styles here
css/styles.css        compiled CSS ← generated, don't edit by hand
src/main.ts           TypeScript source  ← edit this
js/main.js            compiled output    ← generated, don't edit by hand
static/images/        badge exports (header WebP/PNG, favicons) and
                      react-badge-master.svg, the full-size original
```

## Build

Requires Node.js 18+.

```bash
npm install          # once
npm run build        # compile scss/ → css/ and src/ → js/
npm run watch        # recompile both on every save
npm run build:css    # styles only (also watch:css)
npm run build:js     # scripts only (also watch:js)
npm run typecheck    # check types without writing files
npm run serve        # local server at http://localhost:8000
npm start            # build, then serve
```

`css/styles.css` and `js/main.js` are committed, so no build step is needed to deploy: upload the
folder to any static host.

**Serve over HTTP.** The shared header/footer, `messages.properties` and
`pages.json` are loaded with `fetch`, which browsers block for pages opened
straight from disk. Use `npm run serve` locally.

## Styles

`scss/styles.scss` pulls in the partials in cascade order:

```
scss/
├── styles.scss            entry point
├── abstracts/             no CSS output
│   ├── _variables.scss    breakpoints, palette, radii, z-index, sizes
│   └── _mixins.scss       up(), down(), glass, bleed, focus-ring, …
├── base/                  _root (CSS custom properties), _base
├── layout/                _grid, _header, _footer
├── components/            _carousel, _icon-tiles, _detail
└── dev/_overlay.scss      column overlay (remove for production)
```

Breakpoints are named: `@include up(md)`, `@include down(nav)`. Colors are
Sass variables that also feed the CSS custom properties in `base/_root.scss`,
so components use `var(--accent)` and can still be re-themed in the browser.

## Pages

`index.html` and `page.html` both contain `<div data-include="header">` and
`<div data-include="footer">`, which are replaced by the files in
`static/partials/`. Edit the header or footer once there.

`page.html?page=<slug>` builds its body from `static/data/pages.json`:

```json
"pig-butchering": {
  "category": "crimes",
  "titleKey": "crimes.pigButchering",
  "intro": "…",
  "sections": [
    { "heading": "…", "paragraphs": ["…"], "list": ["optional", "bullets"] }
  ]
}
```

`titleKey` points to `messages.properties`, so the home-page tile and the
page always share a name. The page builds a breadcrumb and a "More in
<category>" list automatically. Unknown slugs show a "Page not found" state.
To add a page, add an entry to `pages.json` and link to
`page.html?page=<slug>`.

## Text and translations

All copy lives in `messages.properties`. Elements in `index.html` point to
it with `data-i18n="key"` (text) and `data-i18n-attr="aria-label:key"`
(attributes); script strings use `t("key")`. The text written in the HTML is
only a fallback.

The file is loaded with `fetch`, so it applies when the site is served over
HTTP (any host, or `python3 -m http.server` locally). Opened straight from
disk, browsers block the request and the HTML fallback text shows instead.

To add a language, create `messages_<lang>.properties` (for example
`messages_es.properties`) containing only the translated keys, and add the
code to `SUPPORTED_LOCALES` in `src/main.ts`.

## Before launch

Remove the dev-only column overlay (marked "remove for production" in
`index.html`, `css/styles.css` and `src/main.ts`).
