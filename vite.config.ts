import { defineConfig } from "vite";
import solidPlugin from "vite-plugin-solid";

const tauriHost = process.env.TAURI_DEV_HOST;
const isReplit = !!process.env.REPLIT_DEV_DOMAIN;
const devPort = isReplit ? 5000 : 3001;

export default defineConfig({
  plugins: [solidPlugin()],
  resolve: {
    dedupe: ["react", "react-dom"],
  },
  optimizeDeps: {
    include: ["react", "react-dom", "agentation"],
  },
  clearScreen: false,
  build: {
    target: "esnext",
    minify: process.env.TAURI_ENV_DEBUG === "true" ? false : "esbuild",
    sourcemap: process.env.TAURI_ENV_DEBUG === "true",
  },
  envPrefix: ["VITE_", "TAURI_ENV_"],
  server: {
    host: isReplit ? "0.0.0.0" : tauriHost || false,
    allowedHosts: isReplit ? true : undefined,
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
