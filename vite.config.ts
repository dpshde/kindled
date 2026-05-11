import { defineConfig } from "vite";
import solidPlugin from "vite-plugin-solid";
import { nodePolyfills } from "vite-plugin-node-polyfills";

const isReplit = !!process.env.REPLIT_DEV_DOMAIN;
const devPort = isReplit ? 5000 : 3001;

export default defineConfig({
  plugins: [solidPlugin(), nodePolyfills({ include: ["buffer", "crypto"] })],
  resolve: {
    dedupe: ["react", "react-dom"],
  },
  optimizeDeps: {
    include: ["react", "react-dom", "agentation"],
  },
  clearScreen: false,
  build: {
    target: "esnext",
    minify: "esbuild",
    outDir: process.env.VERCEL ? ".vercel/output/static" : "dist",
  },
  envPrefix: ["VITE_"],
  server: {
    host: isReplit ? "0.0.0.0" : "127.0.0.1",
    allowedHosts: isReplit ? true : undefined,
    port: devPort,
    strictPort: true,
    watch: {
      ignored: ["**/native/**"],
    },
  },
});
