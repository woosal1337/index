import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";
import { catalogDescription, siteOrigin, siteUrl } from "../app/lib/site.ts";

const root = resolve("out");
const failures = new Set();
const manifestFile = resolve("data/media-manifest.json");
const mediaPaths = existsSync(manifestFile)
  ? new Set(Object.keys(JSON.parse(readFileSync(manifestFile, "utf8"))))
  : new Set();
let pages = 0;

function walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const file = join(dir, entry.name);
    if (entry.isDirectory()) walk(file);
    else if (entry.name.endsWith(".html")) {
      pages++;
      const html = readFileSync(file, "utf8");
      const route = relative(root, file).split(sep).join("/");
      if (!["404.html", "404/index.html"].includes(route)) {
        const expected = siteUrl(`/${route.replace(/index\.html$/, "")}`);
        const canonical = [...html.matchAll(/<link rel="canonical" href="([^"]+)"/g)];
        if (canonical.length !== 1 || canonical[0][1] !== expected) {
          failures.add(`Canonical URL does not match: ${route}`);
        }
        if (!html.includes(`<meta property="og:url" content="${expected}"`)
          || !html.includes('<meta name="twitter:card" content="summary"')) {
          failures.add(`Social metadata is missing: ${route}`);
        }
      }
      for (const match of html.matchAll(/(?:href|src)="(\/[^"?#]*)(?:[^"\s]*)?"/g)) {
        if (match[1].startsWith("//")) continue;
        const path = decodeURIComponent(match[1]);
        const target = resolve(root, `.${path}`);
        const safe = target === root || target.startsWith(root + sep);
        const valid = safe && ((existsSync(target) && statSync(target).isFile())
          || existsSync(join(target, "index.html"))
          || mediaPaths.has(path));
        if (!valid) failures.add(path);
      }
    }
  }
}

for (const endpoint of ["resources", "indexes", "search", "stats", "taxonomy", "showcase", "showcase-indexes"]) {
  JSON.parse(readFileSync(join(root, "api", `${endpoint}.json`), "utf8"));
}
const resources = JSON.parse(readFileSync(join(root, "api/resources.json"), "utf8"));
const indexes = JSON.parse(readFileSync(join(root, "api/indexes.json"), "utf8"));
const stats = JSON.parse(readFileSync(join(root, "api/stats.json"), "utf8"));
const slugs = new Set(resources.map((r) => r.slug));
if (!resources.length || slugs.size !== resources.length || stats.resources !== resources.length) {
  failures.add("Resource counts or slugs do not match.");
}
for (const r of resources) {
  if (!existsSync(join(root, "r", r.slug, "index.html"))) failures.add(`/r/${r.slug}`);
  for (const reference of [r.article, r.instagram].filter(Boolean)) {
    if (["body", "full_text", "caption", "transcript"].some((key) => key in reference)) {
      failures.add(`Source text must not be exported: ${r.slug}`);
    }
  }
}
const home = readFileSync(join(root, "index.html"), "utf8");
if (!home.includes(`<meta name="description" content="${catalogDescription(stats)}"`)) {
  failures.add("Home metadata does not match the catalog counts.");
}
const sitemap = readFileSync(join(root, "sitemap.xml"), "utf8");
for (const match of sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)) {
  const url = new URL(match[1]);
  if (url.origin !== siteOrigin() || !existsSync(join(root, url.pathname, "index.html"))) {
    failures.add(`Sitemap URL does not match an exported route: ${url.pathname}`);
  }
}
const robots = readFileSync(join(root, "robots.txt"), "utf8");
if (!robots.includes(`Sitemap: ${siteOrigin()}/sitemap.xml`)) {
  failures.add("The robots sitemap URL does not match the site origin.");
}
for (const index of [indexes.byComponent, indexes.bySurface]) {
  for (const rows of Object.values(index)) {
    for (const slug of rows) if (!slugs.has(slug)) failures.add(`Unknown resource: ${slug}`);
  }
}
walk(root);
if (failures.size) {
  console.error([...failures].join("\n"));
  process.exitCode = 1;
} else console.log(`Export check passed: ${pages} HTML pages, ${resources.length} resources, valid metadata and links, no source text fields.`);
