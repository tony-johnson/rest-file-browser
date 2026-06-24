# REST File Browser

A set of [LitElement](https://lit-element.polymer-project.org/) web components for browsing, viewing, editing, and version-managing files served by a separate REST backend (the "RestFileServer"). It provides:

- A folder/file browser with breadcrumb navigation and history-based routing
- An inline [Ace](https://ace.c9.io/) editor for viewing and editing text files, plus inline image preview
- A version-management UI (set default, hide versions, edit comments, view diffs between versions or against unsaved edits)
- GitHub sign-in via Firebase, gating all mutating actions behind authentication

All of the component code lives in `file-browser.js`, which defines four custom elements: `<file-browser>`, `<path-browser>`, `<ace-editor>`, and `<file-versions>`.

## Usage

Embed the `<file-browser>` element on a page, pointing it at a running RestFileServer instance:

```html
<script type="module" src="./file-browser.js"></script>

<file-browser
  restURL="https://your-host/RestFileServer/rest/"
  context="/RestFileServer">
</file-browser>
```

Attributes:

- `restURL` — base URL of the REST backend (required).
- `context` — application context path; used to locate Ace assets at `${context}/ace`.
- `filePrefix` — URL path prefix stripped when deriving the current folder from `window.location.pathname` (e.g. `/dev`). Defaults to empty.

See `index.html` and `dev/index.html` for working examples.

## Setup

Install dependencies:

```bash
npm i
```

## Dev Server

This project uses [@web/dev-server](https://modern-web.dev/docs/dev-server/overview/), which resolves bare module specifiers and serves the components without a build step. To run the dev server with watch mode:

```bash
npm run serve
```

The development page is `dev/index.html`; it points at a deployed RestFileServer instance.

## Linting and Formatting

```bash
npm run lint     # lit-analyzer (lit-html templates) + eslint
npm run format   # prettier
```

ESLint rules are in `.eslintrc.json` and Prettier config in `.prettierrc.json` (single quotes, no bracket spacing).

## Bundling

The components are intended to be consumed as unminified ES modules. To produce a minified, bundled build in `dist/`:

```bash
npm run rollup
```

To check the gzipped size without keeping the artifact:

```bash
npm run checksize
```

There is no general `build` step — `npm run build` is a deliberate no-op.

## Backend

These components are a thin client; all functionality is driven by `fetch` calls against `restURL`. The backend must implement the REST endpoints the components use (folder listing, download/upload, directory creation, hide options, and the `version/*` endpoints for version info, download, diff, and options). Newer-server features are gated on the `capabilities` array returned by the `serverInfo` endpoint, with a fallback for older servers that lack it.

Authentication uses Firebase with a GitHub OAuth provider; the Firebase ID token is sent as an `Authorization: Bearer <token>` header on mutating requests.

## License

BSD-3-Clause. The component scaffolding originated from the LitElement JavaScript starter; see `LICENSE`.
