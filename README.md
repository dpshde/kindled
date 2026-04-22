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

- Kindled keeps its local `wa-sqlite` database for primary app storage on every runtime.
- Hosted sync now uses **Supabase Auth** for account sign-in and **Turso** for each user's remote vault. Local data remains the fast/offline source on device; sync reconciles that local database with the hosted vault.
- Configure frontend auth with `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`.
- Supabase Edge Functions (`supabase/functions/*`) provision user vaults and mint Turso database tokens using `TURSO_ORG`, `TURSO_GROUP`, and `TURSO_PLATFORM_TOKEN` secrets.
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
