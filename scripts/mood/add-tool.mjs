#!/usr/bin/env node

import { execFile } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { tmpdir } from "node:os";

const run = promisify(execFile);
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const TOOLS = join(root, "data", "tools.json");
const ICONS = join(root, "public", "icons");

const UA = "mood-tools/1.0 (personal bookmark rail; +https://github.com/woosal1337/mood)";
const SIZE = 96;

mkdirSync(ICONS, { recursive: true });
if (!existsSync(TOOLS)) writeFileSync(TOOLS, "[]");
const tools = JSON.parse(readFileSync(TOOLS, "utf8"));

const argv = process.argv.slice(2);
const flag = (n) => { const i = argv.indexOf(`--${n}`); return i === -1 ? null : argv[i + 1]; };

if (argv.includes("--list")) {
  if (!tools.length) console.log("no tools yet");
  for (const t of tools) console.log(`  ${t.name.padEnd(22)} ${t.url}`);
  process.exit(0);
}

if (flag("remove")) {
  const needle = flag("remove").toLowerCase();
  const keep = tools.filter((t) => !t.url.toLowerCase().includes(needle) && t.name.toLowerCase() !== needle);
  if (keep.length === tools.length) { console.log(`no tool matches "${needle}"`); process.exit(1); }
  for (const t of tools.filter((x) => !keep.includes(x))) {
    rmSync(join(ICONS, `${t.slug}.webp`), { force: true });
    console.log(`removed ${t.name}`);
  }
  writeFileSync(TOOLS, JSON.stringify(keep, null, 2) + "\n");
  process.exit(0);
}

const input = argv.find((a) => !a.startsWith("--") && /\./.test(a));
if (!input) {
  console.error("usage: node scripts/add-tool.mjs <url> [--name X] [--note Y] | --list | --remove <host>");
  process.exit(1);
}

const url = new URL(input.startsWith("http") ? input : `https://${input}`);
const slug = url.host.replace(/^www\./, "").replace(/[^a-z0-9]+/gi, "-").toLowerCase();

if (tools.some((t) => t.slug === slug)) {
  console.log(`${url.host} is already on the rail. Remove it first to re-add.`);
  process.exit(0);
}

const html = await fetch(url, { headers: { "user-agent": UA } }).then((r) => r.text());

const title = flag("name") || meta(html, "og:title") || (/<title[^>]*>([^<]*)/i.exec(html) || [])[1] || url.host;
const note = flag("note") || meta(html, "og:description") || "";

const candidates = [];
if (flag("icon")) candidates.push({ href: flag("icon"), rank: 1e6, svg: /\.svg($|\?)/i.test(flag("icon")) });

for (const m of html.matchAll(/<link[^>]+>/gi)) {
  const tag = m[0];
  const rel = (/rel=["']([^"']+)["']/i.exec(tag) || [])[1] || "";
  const href = (/href=["']([^"']+)["']/i.exec(tag) || [])[1];
  if (!href || !/icon/i.test(rel)) continue;
  const size = Number((/(\d+)x\d+/.exec((/sizes=["']([^"']+)["']/i.exec(tag) || [])[1] || "") || [])[1] || 0);
  const svg = /\.svg($|\?)/i.test(href) || /image\/svg/i.test(tag);
  candidates.push({ href, svg, rank: svg ? -100 + size : /apple-touch/i.test(rel) ? 1000 + size : size });
}
candidates.push({ href: "/favicon.png", rank: -200, svg: false });
candidates.push({ href: "/apple-touch-icon.png", rank: -201, svg: false });
candidates.push({ href: "/favicon.ico", rank: -202, svg: false });
candidates.sort((a, b) => b.rank - a.rank);

const scratch = join(tmpdir(), `tool-${process.pid}`);
mkdirSync(scratch, { recursive: true });

let icon = null;
const why = [];

for (const c of candidates) {
  const local = c.href.startsWith(".") || c.href.startsWith("/") && existsSync(c.href);
  const abs = local ? c.href : new URL(c.href, url).href;
  try {
    if (local) {
      const png = join(scratch, "icon-norm.png");
      if (/\.svg$/i.test(abs)) { if (!(await rasterise(abs, png))) { why.push(`${abs} → no rasteriser`); continue; } }
      else await run("sips", ["-s", "format", "png", abs, "--out", png]);
      await run("cwebp", ["-quiet", "-resize", String(SIZE), "0", "-q", "88", png, "-o", join(ICONS, `${slug}.webp`)]);
      icon = abs;
      break;
    }
    const res = await fetch(abs, { headers: { "user-agent": UA } });
    if (!res.ok) { why.push(`${abs} → HTTP ${res.status}`); continue; }

    const type = (res.headers.get("content-type") || "").toLowerCase();
    const buf = Buffer.from(await res.arrayBuffer());
    if (type.startsWith("text/") || type.includes("html")) { why.push(`${abs} → served HTML, not an image`); continue; }
    if (buf.length < 70) { why.push(`${abs} → empty`); continue; }

    const raw = join(scratch, "icon" + extOf(abs, type));
    writeFileSync(raw, buf);

    const png = join(scratch, "icon-norm.png");
    if (c.svg || type.includes("svg")) {
      if (!(await rasterise(raw, png))) { why.push(`${abs} → SVG, and no rasteriser available`); continue; }
    } else {
      await run("sips", ["-s", "format", "png", raw, "--out", png]);
    }

    await run("cwebp", ["-quiet", "-resize", String(SIZE), "0", "-q", "88", png, "-o", join(ICONS, `${slug}.webp`)]);
    icon = abs;
    break;
  } catch (err) {
    why.push(`${abs} → ${String(err.message || err).split("\n")[0]}`);
  }
}
rmSync(scratch, { recursive: true, force: true });

if (!icon) {
  console.error(`\nNo icon found for ${url.host}. Tried:`);
  for (const w of why.slice(0, 6)) console.error(`  ${w}`);
  console.error(`\nTwo usual causes, and each has a fix:`);
  console.error(`  · the site renders in the browser and serves HTML for every path`);
  console.error(`  · the site answers 429 to anything that is not a browser`);
  console.error(`\nPoint at one directly instead:`);
  console.error(`  node scripts/add-tool.mjs ${url.host} --icon https://.../icon.png`);
  console.error(`  node scripts/add-tool.mjs ${url.host} --icon ./some-local-file.png\n`);
  process.exit(1);
}

tools.push({
  slug,
  name: clean(title),
  host: url.host.replace(/^www\./, ""),
  url: url.origin + (url.pathname === "/" ? "" : url.pathname),
  note: clean(note).slice(0, 120),
  icon: `/icons/${slug}.webp`,
});

writeFileSync(TOOLS, JSON.stringify(tools, null, 2) + "\n");
console.log(`added ${clean(title)}`);
console.log(`  ${url.href}`);
console.log(`  icon from ${icon}`);

async function rasterise(svg, out) {
  const chrome = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
  if (!existsSync(chrome)) return false;
  try {
    await run(chrome, [
      "--headless", "--disable-gpu", "--hide-scrollbars",
      `--screenshot=${out}`, `--window-size=${SIZE},${SIZE}`,
      "--default-background-color=00000000",
      `file://${svg}`,
    ], { timeout: 20000 });
    return existsSync(out);
  } catch {
    return false;
  }
}

function extOf(u, type) {
  if (/\.svg($|\?)/i.test(u) || type.includes("svg")) return ".svg";
  if (/\.ico($|\?)/i.test(u) || type.includes("icon")) return ".ico";
  if (/\.jpe?g($|\?)/i.test(u) || type.includes("jpeg")) return ".jpg";
  return ".png";
}

function meta(h, prop) {
  const re = new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]*content=["']([^"']*)["']`, "i");
  const alt = new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]*(?:property|name)=["']${prop}["']`, "i");
  const m = re.exec(h) || alt.exec(h);
  return m ? m[1] : null;
}

function clean(s) {
  return String(s)
    .replace(/&amp;/g, "&").replace(/&#039;|&apos;/g, "'").replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}
