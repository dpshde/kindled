import { defineConfig } from "vite";
import solidPlugin from "vite-plugin-solid";

const tauriHost = process.env.TAURI_DEV_HOST;
const devPort = 3001;

export default defineConfig({
  plugins: [solidPlugin()],
  clearScreen: false,
  build: {
    target: "esnext",
    minify: process.env.TAURI_ENV_DEBUG === "true" ? false : "esbuild",
    sourcemap: process.env.TAURI_ENV_DEBUG === "true",
  },
  envPrefix: ["VITE_", "TAURI_ENV_"],
  server: {
    host: tauriHost || false,
    hmr: tauriHost
      ? {
          protocol: "ws",
          host: tauriHost,
          port: devPort + 1,
        }
      : undefined,
    port: devPort,
    strictPort: true,
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },
});
