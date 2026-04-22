## Usage

```bash
pnpm install
```

## Tauri Companion App

Kindled now includes a Tauri v2 companion shell in `src-tauri/` so the same Vite app can run on desktop, iOS, and Android.

### Mobile/Desktop Tauri Commands

```bash
pnpm tauri:dev
pnpm tauri:build
pnpm tauri:ios:init
pnpm tauri:ios:dev
pnpm tauri:android:init
pnpm tauri:android:dev
```

### Notes

- The existing `wa-sqlite` + IndexedDB/OPFS storage stays in place for both web and Tauri.
- File-backed sync adapts at runtime: browser uses File System Access API, while Tauri uses native open/save dialogs plus `@tauri-apps/plugin-fs` so the user can choose the sync file location (for example iCloud Drive / Files).
- `src/haptics.ts` now prefers Tauri's native mobile haptics plugin on iOS/Android and falls back to `web-haptics` in the browser.
- iOS shells use the same frontend, but viewport sizing now prefers `100vh` over `100dvh` to avoid WKWebView safe-area gaps around the home indicator.
- Pages are locked to viewport height with `overflow: hidden` — no page-level scrolling. Internal panels handle their own scroll independently.

## Available Scripts

In the project directory, you can run:

### `pnpm run dev`

Runs the app in the development mode.  
Open [http://localhost:3000](http://localhost:3000) to view it in the browser.

### `pnpm run build`

Builds the app for production to the `dist` folder.  
The build is minified and the filenames include hashes.

### `pnpm run test`

Runs the Vitest suite once.

### `pnpm run complexity`

Runs [lizard](https://github.com/terryyin/lizard) cyclomatic complexity on UI source paths.

## Deployment

Learn more about deploying your application with the [Vite static deploy guide](https://vite.dev/guide/static-deploy.html).
