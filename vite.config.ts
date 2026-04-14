import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

const host = process.env.TAURI_DEV_HOST;
const FF_PROXY_TTL_MS = 1000 * 60 * 30;
const ffCalendarCache = new Map<string, { cachedAt: number; body: string; contentType: string }>();
const ffCalendarInFlight = new Map<string, Promise<{ status: number; body: string; contentType: string }>>();

function forexFactoryCalendarProxy() {
  return {
    name: "forex-factory-calendar-proxy",
    configureServer(server: import("vite").ViteDevServer) {
      server.middlewares.use(async (req, res, next) => {
        const requestUrl = req.url ?? "";
        if (!requestUrl.startsWith("/ff-calendar/")) {
          next();
          return;
        }

        const calendarPath = requestUrl.replace(/^\/ff-calendar/, "");
        const targetUrl = `https://nfs.faireconomy.media${calendarPath}`;
        const cached = ffCalendarCache.get(calendarPath);

        if (cached && Date.now() - cached.cachedAt < FF_PROXY_TTL_MS) {
          res.statusCode = 200;
          res.setHeader("Content-Type", cached.contentType);
          res.end(cached.body);
          return;
        }

        let request = ffCalendarInFlight.get(calendarPath);
        if (!request) {
          request = (async () => {
            const response = await fetch(targetUrl, {
              headers: {
                Referer: "https://www.forexfactory.com/",
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                Accept: "application/json",
              },
            });
            const body = await response.text();
            const contentType = response.headers.get("content-type") ?? "application/json";

            if (response.ok) {
              ffCalendarCache.set(calendarPath, {
                cachedAt: Date.now(),
                body,
                contentType,
              });
            }

            return {
              status: response.status,
              body,
              contentType,
            };
          })().finally(() => {
            ffCalendarInFlight.delete(calendarPath);
          });

          ffCalendarInFlight.set(calendarPath, request);
        }

        try {
          const result = await request;
          if (result.status === 429 && cached) {
            res.statusCode = 200;
            res.setHeader("Content-Type", cached.contentType);
            res.end(cached.body);
            return;
          }

          res.statusCode = result.status;
          res.setHeader("Content-Type", result.contentType);
          res.end(result.body);
        } catch {
          if (cached) {
            res.statusCode = 200;
            res.setHeader("Content-Type", cached.contentType);
            res.end(cached.body);
            return;
          }

          res.statusCode = 502;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: "Failed to proxy Forex Factory calendar" }));
        }
      });
    },
  };
}

export default defineConfig(async () => ({
  plugins: [react(), forexFactoryCalendarProxy()],
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
