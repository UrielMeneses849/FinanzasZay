import http from "node:http";
import { readFile } from "node:fs/promises";
import { resolve, extname, sep } from "node:path";
const root = resolve("dist/pwa");
const port = Number(process.env.PORT || 4179);
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".webmanifest": "application/manifest+json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};
http
  .createServer(async (req, res) => {
    try {
      if (!["GET", "HEAD"].includes(req.method)) {
        res.writeHead(405);
        res.end();
        return;
      }
      const pathname = decodeURIComponent(
        new URL(req.url, "http://localhost").pathname,
      );
      const manifest = JSON.parse(
        await readFile(resolve(root, "manifest.webmanifest"), "utf8"),
      );
      const base = manifest.scope || "/";
      if (pathname === "/" && base !== "/") {
        res.writeHead(302, { Location: base });
        res.end();
        return;
      }
      if (!pathname.startsWith(base)) {
        res.writeHead(404);
        res.end("No encontrado");
        return;
      }
      const relativePath =
        base === "/" ? pathname : "/" + pathname.slice(base.length);
      const path = resolve(
        root,
        "." + (relativePath === "/" ? "/index.html" : relativePath),
      );
      if (!path.startsWith(root + sep)) {
        res.writeHead(403);
        res.end();
        return;
      }
      const body = await readFile(path);
      res.writeHead(200, {
        "Content-Type": types[extname(path)] || "application/octet-stream",
        "Cache-Control": "no-cache",
        "X-Content-Type-Options": "nosniff",
        "Referrer-Policy": "strict-origin-when-cross-origin",
      });
      res.end(req.method === "HEAD" ? undefined : body);
    } catch {
      res.writeHead(404);
      res.end("No encontrado");
    }
  })
  .listen(port, "0.0.0.0", () =>
    console.log(`Zay PWA: http://localhost:${port}/`),
  );
