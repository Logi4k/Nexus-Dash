import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

const host = process.env.TAURI_DEV_HOST;

export default defineConfig(async () => ({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? { protocol: "ws", host, port: 1421 }
      : undefined,
    watch: {
      ignored: ["**/src-tauri/**"],
    },
    proxy: {
      "/t212": {
        target: "https://live.trading212.com",
        changeOrigin: true,
        secure: true,
        rewrite: (p) => p.replace(/^\/t212/, "/api/v0"),
      },
      // Forex Factory calendar (bypasses CORS — server-side proxy)
      "/ff-calendar": {
        target: "https://nfs.faireconomy.media",
        changeOrigin: true,
        secure: true,
        rewrite: (p) => p.replace(/^\/ff-calendar/, ""),
        headers: {
          "Referer": "https://www.forexfactory.com/",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Accept": "application/json",
        },
      },
      // ForexLive RSS
      "/rss/forexlive": {
        target: "https://www.forexlive.com",
        changeOrigin: true,
        secure: true,
        rewrite: (p) => p.replace(/^\/rss\/forexlive/, "/feed/news"),
      },
      // FX Street RSS
      "/rss/fxstreet": {
        target: "https://www.fxstreet.com",
        changeOrigin: true,
        secure: true,
        rewrite: (p) => p.replace(/^\/rss\/fxstreet/, "/rss/news"),
      },
    },
  },
}));
