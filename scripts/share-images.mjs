#!/usr/bin/env node

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "public/og/share");
const MANIFEST = join(ROOT, "data/share-manifest.json");
const WIDTH = 1200;
const HEIGHT = 630;
const ORIGIN = "https://index.chele.bi";

const args = process.argv.slice(2);
const option = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : null;
};
const only = option("--only") ? new Set(option("--only").split(",")) : null;
const concurrency = Number(option("--concurrency") || 4);

let chromium;
try {
  ({ chromium } = await import("playwright"));
} catch {
  console.error("Playwright is not installed. Run npm install --no-save playwright. Then run npx playwright install chromium.");
  process.exit(1);
}

const readJSON = (path) => JSON.parse(readFileSync(join(ROOT, path), "utf8"));
const resources = readJSON("data/dist/resources.json");
const indexes = readJSON("data/dist/indexes.json");
const stats = readJSON("data/dist/stats.json");
const taxonomy = readJSON("taxonomy/categories.json");
const componentGroups = readJSON("taxonomy/components.json").groups;
const surfaceGroups = readJSON("taxonomy/surfaces.json").groups;
const mediaVersion = (readFileSync(join(ROOT, "app/lib/media.ts"), "utf8").match(/MEDIA_VERSION = "([^"]+)"/) || [])[1] || "";

const UPPER = new Set(["ai", "ui", "ux", "api", "css", "svg", "mcp", "cli", "seo", "rtl", "3d", "mit", "bsd", "isc", "ofl", "cc0", "agpl", "gpl", "lgpl", "mpl", "npm", "cdn", "json", "saas", "llm"]);
const labelize = (slug) => String(slug).split(/[-_]/).filter(Boolean)
  .map((w) => (UPPER.has(w.toLowerCase()) ? w.toUpperCase() : w.charAt(0).toUpperCase() + w.slice(1))).join(" ");
const count = (n, one, many) => `${n.toLocaleString("en-US")} ${n === 1 ? one : many}`;
const RANK = { S: 0, A: 1, B: 2, C: 3 };
const byTierThenName = (a, b) => (RANK[a.tier] ?? 9) - (RANK[b.tier] ?? 9) || a.name.localeCompare(b.name);
const bySlug = new Map(resources.map((r) => [r.slug, r]));
const categories = taxonomy.categories;
const categoryName = new Map(categories.map((c) => [c.slug, c.name]));
const subcategoryName = new Map(categories.flatMap((c) => (c.subcategories || []).map((s) => [`${c.slug}/${s.slug}`, s.name])));

const imageSrc = (r) => {
  if (!r?.hasImage) return null;
  const local = join(ROOT, "public/og", `${r.imageKey}.webp`);
  return existsSync(local) ? pathToFileURL(local).href : `${ORIGIN}/og/${r.imageKey}.webp?v=${mediaVersion}`;
};
const topImages = (list, n) => list.filter((r) => r?.hasImage).sort(byTierThenName).slice(0, n).map(imageSrc);
const pickOnePerCategory = (n) => categories.map((c) => resources.filter((r) => r.category === c.slug && r.hasImage).sort(byTierThenName)[0]).filter(Boolean).slice(0, n).map(imageSrc);
const fill = (images, n) => {
  const pool = images.filter(Boolean);
  if (!pool.length) return [];
  return Array.from({ length: n }, (_, i) => pool[i % pool.length]);
};
const firstUseful = (values = []) => values.find((v) => !["unknown", "not-applicable", "none"].includes(v));

const specs = [];
const S = resources.filter((r) => r.tier === "S" && r.hasImage).sort(byTierThenName);

specs.push({
  key: "site",
  layout: "site",
  title: "Index",
  text: "A design corpus your agent can read",
  meta: `${count(stats.resources, "resource", "resources")} · ${count(stats.vocabComponents, "component", "components")} · ${count(stats.vocabSurfaces, "surface", "surfaces")}`,
  images: fill(S.slice(0, 15).map(imageSrc), 15),
});

const sections = [
  { key: "categories", title: "Categories", text: `${categories.length} design resource categories. Browse subcategories and resource counts.`, meta: `${count(categories.length, "category", "categories")} · ${count(stats.resources, "resource", "resources")}`, images: pickOnePerCategory(16) },
  { key: "components", title: "Components", text: "Browse UI components and the libraries in Index that include them.", meta: `${count(stats.vocabComponents, "component", "components")} · ${count(stats.componentsTagged, "with resources", "with resources")}`, images: topImages(resources.filter((r) => r.category === "component-libraries"), 15) },
  { key: "surfaces", title: "Surfaces", text: "Browse app screens and flows, with checklists and resources to help you build them.", meta: `${count(stats.vocabSurfaces, "surface", "surfaces")} · ${count(stats.surfacesTagged, "with resources", "with resources")}`, images: topImages(resources.filter((r) => (r.surfaces || []).length), 15) },
  { key: "templates", title: "Templates", text: `${stats.templates.toLocaleString("en-US")} templates from design galleries and starter kits. Browse references and visit each source.`, meta: count(stats.templates, "template", "templates"), images: topImages(resources.filter((r) => r.category === "blocks-templates-themes" || r.category === "inspiration-galleries"), 15) },
  { key: "learn", title: "Learn", text: "Curated reading paths for design practice, with source links, key lessons, and guidance for applying each resource.", meta: count(resources.filter((r) => r.category === "essays-guides-courses").length, "reading resource", "reading resources"), images: topImages(resources.filter((r) => r.category === "essays-guides-courses"), 15) },
];
for (const s of sections) specs.push({ ...s, layout: "section", images: fill(s.images, 15) });

for (const c of categories) {
  const list = resources.filter((r) => r.category === c.slug);
  if (!list.length) continue;
  specs.push({
    key: `categories/${c.slug}`,
    layout: "category",
    kicker: "Category",
    title: c.name,
    text: c.description,
    meta: `${count(list.length, "resource", "resources")} · ${count((c.subcategories || []).length, "subcategory", "subcategories")}`,
    images: topImages(list, 3),
  });
}

for (const g of componentGroups) {
  for (const c of g.components) {
    const slugs = indexes.byComponent[c.slug];
    if (!slugs) continue;
    const list = slugs.map((s) => bySlug.get(s)).filter(Boolean);
    specs.push({
      key: `components/${c.slug}`,
      layout: "collection",
      kicker: `Component · ${g.name}`,
      title: c.name,
      text: `Resources in Index that include a ${c.name} component.`,
      meta: count(list.length, "resource", "resources"),
      images: topImages(list, 4),
    });
  }
}

for (const g of surfaceGroups) {
  for (const s of g.surfaces) {
    const list = (indexes.bySurface[s.slug] || []).map((x) => bySlug.get(x)).filter(Boolean);
    specs.push({
      key: `surfaces/${s.slug}`,
      layout: "collection",
      kicker: `Surface · ${g.name}`,
      title: s.name,
      text: s.description,
      meta: count(list.length, "resource", "resources"),
      images: topImages(list, 4),
      checklist: (s.checklist || []).slice(0, 4).map((item) => item.split(" — ")[0]),
    });
  }
}

for (const r of resources) {
  const badge = r.tier === "S" ? "Best in class" : r.tier === "A" ? "Strong pick" : null;
  const kind = (r.kinds || [])[0];
  const license = firstUseful(r.facets?.license);
  const pricing = firstUseful(r.facets?.pricing);
  specs.push({
    key: `r/${r.slug}`,
    layout: "resource",
    kicker: [categoryName.get(r.category), subcategoryName.get(`${r.category}/${r.subcategory}`)].filter(Boolean).join(" · "),
    title: r.name,
    text: r.tagline || r.description || "",
    badge,
    chips: [kind && labelize(kind), (license && labelize(license)) || (pricing && labelize(pricing))].filter(Boolean),
    foot: r.domain || "",
    images: [imageSrc(r)].filter(Boolean),
    monogram: (r.name || "??").replace(/[^A-Za-z0-9]/g, "").slice(0, 2).toUpperCase() || "··",
  });
}

const font = (file) => pathToFileURL(join(ROOT, "public/fonts", file)).href;
const logo = `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="8" height="8" rx="2"/><rect x="13" y="3" width="8" height="8" rx="2"/><rect x="3" y="13" width="8" height="8" rx="2"/><rect x="13" y="13" width="8" height="8" rx="2" fill="currentColor" stroke="none"/></svg>`;

const html = `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face { font-family: "Instrument Sans"; font-weight: 400 700; src: url("${font("instrument-sans-latin.woff2")}") format("woff2"); }
@font-face { font-family: "Instrument Sans"; font-weight: 400 700; src: url("${font("instrument-sans-latin-ext.woff2")}") format("woff2"); unicode-range: U+0100-024F, U+1E00-1EFF; }
@font-face { font-family: "IBM Plex Mono"; font-weight: 400; src: url("${font("ibm-plex-mono-400-latin.woff2")}") format("woff2"); }
@font-face { font-family: "IBM Plex Mono"; font-weight: 500; src: url("${font("ibm-plex-mono-500-latin.woff2")}") format("woff2"); }
* { box-sizing: border-box; margin: 0; padding: 0; }
html, body { width: ${WIDTH}px; height: ${HEIGHT}px; overflow: hidden; background: #0b0b0b; }
body { font-family: "Instrument Sans", system-ui, sans-serif; color: #fafafa; -webkit-font-smoothing: antialiased; }
.card { position: relative; width: ${WIDTH}px; height: ${HEIGHT}px; overflow: hidden; background: radial-gradient(1000px 600px at 6% 0%, #1e1e1e 0%, #131313 46%, #0b0b0b 100%); }
.card::after { content: ""; position: absolute; inset: 16px; border: 1px solid rgba(255,255,255,0.07); border-radius: 30px; pointer-events: none; z-index: 5; }
.brand { position: absolute; left: 64px; top: 58px; display: flex; align-items: center; gap: 14px; z-index: 4; }
.logo { display: grid; place-items: center; width: 44px; height: 44px; border-radius: 12px; background: #fafafa; color: #111; flex: none; }
.logo svg { width: 24px; height: 24px; fill: none; stroke: currentColor; stroke-width: 2; }
.brand-name { font-size: 24px; font-weight: 600; letter-spacing: -0.01em; line-height: 1.1; }
.brand-sub { font-size: 15px; color: #7c7c7c; line-height: 1.25; }
.kicker { font-family: "IBM Plex Mono", ui-monospace, monospace; font-weight: 500; font-size: 16px; letter-spacing: 0.08em; text-transform: uppercase; color: #8d8d8d; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.topright { position: absolute; right: 64px; top: 72px; max-width: 520px; text-align: right; z-index: 4; }
.copy { position: absolute; left: 64px; width: 476px; z-index: 4; }
.title { font-weight: 600; letter-spacing: -0.032em; line-height: 1.02; text-wrap: balance; display: -webkit-box; -webkit-box-orient: vertical; overflow: hidden; }
.text { margin-top: 20px; font-size: 24px; line-height: 1.4; color: #a6a6a6; display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 3; overflow: hidden; text-wrap: pretty; }
.meta { margin-top: 26px; font-family: "IBM Plex Mono", ui-monospace, monospace; font-size: 18px; color: #8d8d8d; letter-spacing: 0.01em; }
.chips { position: absolute; left: 64px; bottom: 58px; display: flex; gap: 10px; z-index: 4; }
.chip { display: inline-flex; align-items: center; gap: 8px; height: 40px; padding: 0 17px; border-radius: 999px; border: 1px solid rgba(255,255,255,0.1); background: rgba(255,255,255,0.04); font-size: 18px; font-weight: 500; color: #d6d6d6; white-space: nowrap; }
.chip.badge { background: #fafafa; color: #111; border-color: transparent; font-weight: 600; }
.chip.badge svg { width: 15px; height: 15px; fill: currentColor; }
.foot { position: absolute; right: 64px; bottom: 66px; font-family: "IBM Plex Mono", ui-monospace, monospace; font-size: 18px; color: #8d8d8d; z-index: 4; max-width: 520px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.frame { background: #171717; border: 1px solid rgba(255,255,255,0.09); border-radius: 24px; padding: 9px; box-shadow: 0 28px 70px rgba(0,0,0,0.6), 0 2px 0 rgba(255,255,255,0.03) inset; }
.frame img, .frame .ph { display: block; width: 100%; aspect-ratio: 1200 / 630; object-fit: cover; object-position: top center; border-radius: 16px; background: #222; }
.frame .ph { display: grid; place-items: center; font-size: 110px; font-weight: 600; letter-spacing: -0.04em; color: #3b3b3b; background: linear-gradient(160deg, #1f1f1f, #161616); }
.abs { position: absolute; }
.glow { position: absolute; width: 760px; height: 760px; right: -160px; top: -80px; background: radial-gradient(closest-side, rgba(255,255,255,0.06), transparent 70%); z-index: 0; }
.wall { position: absolute; display: grid; gap: 18px; transform: rotate(-12deg); z-index: 1; -webkit-mask-image: linear-gradient(90deg, transparent 0%, rgba(0,0,0,0.35) 18%, #000 42%); mask-image: linear-gradient(90deg, transparent 0%, rgba(0,0,0,0.35) 18%, #000 42%); }
.wall .frame { padding: 7px; border-radius: 18px; box-shadow: 0 18px 40px rgba(0,0,0,0.5); }
.wall .frame img { border-radius: 12px; }
.scrim { position: absolute; inset: 0; background: linear-gradient(90deg, rgba(11,11,11,0.96) 0%, rgba(11,11,11,0.86) 38%, rgba(11,11,11,0.15) 70%, rgba(11,11,11,0) 100%); z-index: 2; }
.site .copy { top: 0; bottom: 0; display: flex; flex-direction: column; justify-content: center; width: 600px; }
.site .bigbrand { display: flex; align-items: center; gap: 22px; }
.site .bigbrand .logo { width: 84px; height: 84px; border-radius: 22px; }
.site .bigbrand .logo svg { width: 46px; height: 46px; }
.site .bigbrand .name { font-size: 112px; font-weight: 600; letter-spacing: -0.045em; line-height: 1; }
.site .text { font-size: 36px; line-height: 1.25; color: #c4c4c4; margin-top: 30px; -webkit-line-clamp: 2; max-width: 560px; }
.site .meta { margin-top: 34px; font-size: 19px; }
.panel { display: flex; flex-direction: column; gap: 18px; aspect-ratio: 1200 / 630; padding: 30px 34px; border-radius: 16px; background: linear-gradient(160deg, #1f1f1f, #151515); }
.panel ul { display: grid; gap: 14px; list-style: none; }
.panel li { display: block; font-size: 22px; line-height: 1.3; color: #d6d6d6; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.panel li::before { content: "✓"; display: inline-block; width: 30px; font-family: "IBM Plex Mono", ui-monospace, monospace; font-size: 18px; color: #8d8d8d; }
.site .url { position: absolute; left: 64px; bottom: 58px; font-family: "IBM Plex Mono", ui-monospace, monospace; font-size: 17px; color: #7c7c7c; z-index: 4; }
</style></head><body><div id="root"></div><script>
const LOGO = ${JSON.stringify(logo)};
const STAR = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.8l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 16.8l-5.4 2.9 1-6.1L3.2 9.3l6.1-.9z"/></svg>';
const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const frame = (src, mono, style = "") => '<div class="frame abs" style="' + style + '">' + (src ? '<img src="' + esc(src) + '" alt="">' : '<div class="ph">' + esc(mono || "") + '</div>') + '</div>';
const wallFrame = (src) => '<div class="frame">' + (src ? '<img src="' + esc(src) + '" alt="">' : '<div class="ph"></div>') + '</div>';
const brand = '<div class="brand"><div class="logo">' + LOGO + '</div><div><div class="brand-name">Index</div><div class="brand-sub">Design corpus</div></div></div>';
const titleSize = (t, sizes) => { const n = (t || "").length; for (const [max, px] of sizes) if (n <= max) return px; return sizes[sizes.length - 1][1]; };
const wall = (images, cols, width, left, top) => '<div class="wall" style="grid-template-columns: repeat(' + cols + ', 1fr); width:' + width + 'px; left:' + left + 'px; top:' + top + 'px">' + images.map(wallFrame).join("") + '</div>';
function layoutSite(s) {
  return '<div class="card site"><div class="glow"></div>' + wall(s.images, 3, 860, 520, -150) + '<div class="scrim"></div>'
    + '<div class="copy"><div class="bigbrand"><div class="logo">' + LOGO + '</div><div class="name">' + esc(s.title) + '</div></div>'
    + '<div class="text">' + esc(s.text) + '</div><div class="meta">' + esc(s.meta) + '</div></div>'
    + '<div class="url">index.chele.bi</div></div>';
}
function layoutSection(s) {
  const size = titleSize(s.title, [[10, 92], [16, 80], [99, 68]]);
  return '<div class="card section"><div class="glow"></div>' + wall(s.images, 3, 860, 540, -150) + '<div class="scrim"></div>' + brand
    + '<div class="copy" style="top: 168px; width: 540px"><div class="title" style="font-size:' + size + 'px; -webkit-line-clamp: 2">' + esc(s.title) + '</div>'
    + '<div class="text">' + esc(s.text) + '</div><div class="meta">' + esc(s.meta) + '</div></div>'
    + '<div class="foot" style="left: 64px; right: auto; bottom: 58px">index.chele.bi</div></div>';
}
function layoutCategory(s) {
  const size = titleSize(s.title, [[12, 78], [20, 66], [30, 56], [99, 48]]);
  const imgs = s.images;
  let art = "";
  if (imgs.length >= 3) {
    art = frame(imgs[1], "", "left: 610px; top: 196px; width: 400px; transform: rotate(-9deg); opacity: 0.9")
      + frame(imgs[2], "", "left: 770px; top: 196px; width: 400px; transform: rotate(9deg); opacity: 0.9")
      + frame(imgs[0], "", "left: 660px; top: 236px; width: 460px; z-index: 3");
  } else if (imgs.length) {
    art = frame(imgs[0], "", "left: 610px; top: 190px; width: 528px");
  }
  return '<div class="card category"><div class="glow"></div>' + brand + '<div class="topright kicker">' + esc(s.kicker) + '</div>' + art
    + '<div class="copy" style="top: 168px; width: 500px"><div class="title" style="font-size:' + size + 'px; -webkit-line-clamp: 2">' + esc(s.title) + '</div>'
    + '<div class="text">' + esc(s.text) + '</div><div class="meta">' + esc(s.meta) + '</div></div>'
    + '<div class="foot" style="left: 64px; right: auto; bottom: 58px">index.chele.bi</div></div>';
}
function layoutCollection(s) {
  const size = titleSize(s.title, [[12, 76], [20, 64], [30, 54], [99, 46]]);
  const imgs = s.images;
  let art = "";
  if (imgs.length >= 4) {
    const pos = [[600, 150], [878, 150], [600, 330], [878, 330]];
    art = imgs.slice(0, 4).map((src, i) => frame(src, "", "left:" + pos[i][0] + "px; top:" + pos[i][1] + "px; width: 262px; padding: 7px; border-radius: 18px")).join("");
  } else if (imgs.length === 3) {
    art = frame(imgs[1], "", "left: 610px; top: 196px; width: 400px; transform: rotate(-9deg); opacity: 0.9")
      + frame(imgs[2], "", "left: 770px; top: 196px; width: 400px; transform: rotate(9deg); opacity: 0.9")
      + frame(imgs[0], "", "left: 660px; top: 236px; width: 460px; z-index: 3");
  } else if (imgs.length === 2) {
    art = frame(imgs[1], "", "left: 700px; top: 160px; width: 430px; opacity: 0.85")
      + frame(imgs[0], "", "left: 610px; top: 250px; width: 430px; z-index: 3");
  } else if (imgs.length === 1) {
    art = frame(imgs[0], "", "left: 600px; top: 176px; width: 536px");
  } else if ((s.checklist || []).length) {
    art = '<div class="frame abs" style="left: 600px; top: 176px; width: 536px"><div class="panel"><div class="kicker">Checklist</div><ul>'
      + s.checklist.map((item) => '<li>' + esc(item) + '</li>').join("") + '</ul></div></div>';
  } else {
    art = frame(null, s.title.replace(/[^A-Za-z0-9]/g, "").slice(0, 2).toUpperCase(), "left: 600px; top: 176px; width: 536px");
  }
  return '<div class="card collection"><div class="glow"></div>' + brand + '<div class="topright kicker">' + esc(s.kicker) + '</div>' + art
    + '<div class="copy" style="top: 168px; width: 490px"><div class="title" style="font-size:' + size + 'px; -webkit-line-clamp: 2">' + esc(s.title) + '</div>'
    + '<div class="text">' + esc(s.text) + '</div><div class="meta">' + esc(s.meta) + '</div></div>'
    + '<div class="foot" style="left: 64px; right: auto; bottom: 58px">index.chele.bi</div></div>';
}
function layoutResource(s) {
  const size = titleSize(s.title, [[10, 72], [18, 62], [28, 54], [40, 46], [999, 40]]);
  const chips = (s.badge ? '<span class="chip badge">' + STAR + esc(s.badge) + '</span>' : "") + s.chips.map((c) => '<span class="chip">' + esc(c) + '</span>').join("");
  return '<div class="card resource"><div class="glow"></div>' + brand + '<div class="topright kicker">' + esc(s.kicker) + '</div>'
    + frame(s.images[0], s.monogram, "left: 584px; top: 152px; width: 552px")
    + '<div class="copy" style="top: 160px"><div class="title" style="font-size:' + size + 'px; -webkit-line-clamp: 3">' + esc(s.title) + '</div>'
    + '<div class="text">' + esc(s.text) + '</div></div>'
    + '<div class="chips">' + chips + '</div><div class="foot">' + esc(s.foot) + '</div></div>';
}
window.render = async (s) => {
  const fn = { site: layoutSite, section: layoutSection, category: layoutCategory, collection: layoutCollection, resource: layoutResource }[s.layout];
  document.getElementById("root").innerHTML = fn(s);
  await document.fonts.ready;
  await Promise.all([...document.images].map((img) => img.decode().catch(() => { img.replaceWith(Object.assign(document.createElement("div"), { className: "ph" })); })));
  return [...document.images].length;
};
</script></body></html>`;

const work = only ? specs.filter((s) => only.has(s.key)) : specs;
const page = join(tmpdir(), `index-share-${process.pid}.html`);
writeFileSync(page, html);
const browser = await chromium.launch();
let done = 0;
const failed = [];
let next = 0;
async function worker() {
  const ctx = await browser.newContext({ viewport: { width: WIDTH, height: HEIGHT }, deviceScaleFactor: 1 });
  const tab = await ctx.newPage();
  await tab.goto(pathToFileURL(page).href);
  while (next < work.length) {
    const spec = work[next++];
    try {
      await tab.evaluate((s) => window.render(s), spec);
      const file = join(OUT, `${spec.key}.jpg`);
      mkdirSync(dirname(file), { recursive: true });
      await tab.screenshot({ path: file, type: "jpeg", quality: 90, clip: { x: 0, y: 0, width: WIDTH, height: HEIGHT } });
      done++;
      if (done % 200 === 0) console.log(`  rendered ${done}/${work.length}`);
    } catch (error) {
      failed.push(`${spec.key}: ${String(error.message).split("\n")[0]}`);
    }
  }
  await ctx.close();
}
await Promise.all(Array.from({ length: Math.max(1, concurrency) }, worker));
await browser.close();
rmSync(page, { force: true });

const keys = specs.map((s) => s.key).filter((k) => existsSync(join(OUT, `${k}.jpg`))).sort();
const hash = createHash("sha256");
for (const k of keys) hash.update(k).update(readFileSync(join(OUT, `${k}.jpg`)));
const manifest = { version: hash.digest("hex").slice(0, 12), width: WIDTH, height: HEIGHT, keys };
writeFileSync(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`share images: ${done} rendered, ${failed.length} failed, ${keys.length} listed in data/share-manifest.json`);
if (failed.length) {
  console.error(failed.slice(0, 20).join("\n"));
  process.exitCode = 1;
}
