import { createServer } from "node:http";
import { realpathSync } from "node:fs";
import { readFile, realpath, stat } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";

const MIME = {
  ".html": "text/html; charset=utf-8", ".json": "application/json; charset=utf-8",
  ".txt": "text/plain; charset=utf-8", ".xml": "application/xml; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".woff2": "font/woff2", ".webp": "image/webp", ".png": "image/png",
  ".svg": "image/svg+xml", ".ico": "image/x-icon", ".jpg": "image/jpeg",
};

export function previewServer(directory) {
  const root = realpathSync(resolve(directory));
  return createServer(async (req, res) => {
    if (!["GET", "HEAD"].includes(req.method)) {
      res.writeHead(405, { Allow: "GET, HEAD" }).end();
      return;
    }
    try {
      const pathname = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
      let file = resolve(root, `.${pathname}`);
      if (file !== root && !file.startsWith(root + sep)) {
        res.writeHead(403).end();
        return;
      }
      let status = 200;
      try {
        if ((await stat(file)).isDirectory()) file = resolve(file, "index.html");
        file = await realpath(file);
        if (!file.startsWith(root + sep)) {
          res.writeHead(403).end();
          return;
        }
      } catch {
        file = resolve(root, "404.html");
        status = 404;
      }
      const data = await readFile(file);
      res.writeHead(status, {
        "Content-Type": MIME[extname(file)] ?? "application/octet-stream",
        "Content-Length": data.length,
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "no-cache",
      });
      res.end(req.method === "HEAD" ? undefined : data);
    } catch {
      res.writeHead(400).end("Cannot read this path.");
    }
  });
}
