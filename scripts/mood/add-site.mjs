#!/usr/bin/env node

import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { tmpdir } from "node:os";
import { acquire } from "./boards-lock.mjs";

const run = promisify(execFile);
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const MEDIA = join(root, "public", "media");
const ORIGINAL = join(root, "media", "original");
const BOARDS = join(root, "data", "boards.json");
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

const UA = "mood-import/1.0 (personal reference archive; +https://github.com/woosal1337/mood)";
const TIERS = [
  { suffix: "tiny", width: 192, q: 74 },
  { suffix: "thumb", width: 480, q: 80 },
  { suffix: "full", width: 1440, q: 82 },
];

const flag = (n) => { const i = process.argv.indexOf(`--${n}`); return i === -1 ? null : process.argv[i + 1]; };
const site = flag("site");
const brand = flag("brand");
const from = flag("from");
if (!site || !brand || !from) {
  console.error("usage: node scripts/add-site.mjs --site <url> --brand <name> --from <list.txt>");
  process.exit(1);
}

for (const d of [MEDIA, ORIGINAL]) mkdirSync(d, { recursive: true });

const groups = new Map();
for (const line of readFileSync(from, "utf8").split(/\r?\n/)) {
  const t = line.trim();
  if (!t || t.startsWith("#")) continue;
  const [g, ...rest] = t.split("\t");
  const src = rest.join("\t").trim();
  if (!src) continue;
  if (!groups.has(g)) groups.set(g, []);
  groups.get(g).push(src);
}

acquire("add-site");
const boards = JSON.parse(readFileSync(BOARDS, "utf8"));
const have = new Set(boards.flatMap((b) => b.images.map((i) => i.id)));
const host = new URL(site).host.replace(/^www\./, "");
const scratch = join(tmpdir(), `mood-site-${process.pid}`);
mkdirSync(scratch, { recursive: true });

let added = 0, images = 0, failed = 0;

for (const [group, sources] of groups) {
  const boardId = `site:${host}:${slug(group)}`;
  if (boards.some((b) => b.id === boardId)) { console.log(`  = ${group} — already here`); continue; }

  const got = [];
  for (const [n, src] of sources.entries()) {
    const id = `${slug(host)}-${slug(group)}-${createHash("sha1").update(src).digest("hex").slice(0, 8)}`;
    if (have.has(id)) continue;
    try {
      got.push(await bring(src, id));
      have.add(id);
    } catch (err) {
      failed++;
      console.log(`  ! ${src.split("/").pop().slice(0, 46)} — ${String(err.message || err).split("\n")[0]}`);
    }
  }
  if (!got.length) continue;

  boards.push({
    id: boardId,
    slug: `board-${slug(host)}-${slug(group)}`,
    author: brand,
    authorName: host,
    text: flag("note") || "",
    topic: group,
    tweetUrl: site,
    postedAt: new Date().toISOString(),
    savedAt: new Date().toISOString(),
    metrics: { likes: 0, retweets: 0, views: 0, bookmarks: 0 },
    images: got,
    imageCount: got.length,
    fetched: true,
    source: host,
  });
  added++;
  images += got.length;
  console.log(`  + ${group} — ${got.length} image(s)`);
}

writeFileSync(BOARDS, JSON.stringify(boards));
rmSync(scratch, { recursive: true, force: true });
console.log(`\n${added} board(s), ${images} image(s)${failed ? `, ${failed} failed` : ""}. Run \`npm run data\`.`);

async function bring(src, id) {
  const local = !/^https?:/i.test(src);
  const isSvg = /\.svg($|\?)/i.test(src);
  const raw = join(scratch, `${id}${isSvg ? ".svg" : extOf(src)}`);

  if (local) writeFileSync(raw, readFileSync(src));
  else {
    const res = await fetch(src, { headers: { "user-agent": UA } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const type = (res.headers.get("content-type") || "").toLowerCase();
    if (type.includes("html")) throw new Error("served HTML, not an image");
    writeFileSync(raw, Buffer.from(await res.arrayBuffer()));
  }

  const still = join(scratch, `${id}.png`);
  if (isSvg) await card(raw, still);
  else await run("sips", ["-s", "format", "png", raw, "--out", still]);

  const { stdout } = await run("sips", ["-g", "pixelWidth", "-g", "pixelHeight", still]);
  const w = Number(/pixelWidth:\s*(\d+)/.exec(stdout)?.[1]);
  const h = Number(/pixelHeight:\s*(\d+)/.exec(stdout)?.[1]);
  if (!w || !h) throw new Error("no readable size");

  for (const t of TIERS) {
    await run("cwebp", ["-quiet", "-resize", String(Math.min(t.width, w)), "0", "-q", String(t.q),
      still, "-o", join(MEDIA, `${id}-${t.suffix}.webp`)]);
  }
  writeFileSync(join(ORIGINAL, `${id}${isSvg ? ".svg" : extOf(src)}`), readFileSync(raw));

  const tw = Math.min(480, w);
  return { id, thumb: `/media/${id}-thumb.webp`, full: `/media/${id}-full.webp`,
           isVideo: false, w: tw, h: Math.round((tw * h) / w) };
}

async function card(svg, out) {
  if (!existsSync(CHROME)) throw new Error("no rasteriser for SVG");
  const page = join(scratch, `card-${Math.abs(hash(svg))}.html`);
  const data = readFileSync(svg, "utf8").replace(/`/g, "\\`");
  writeFileSync(page, `<!doctype html><meta charset="utf-8"><style>
    html,body{margin:0;height:100%}
    body{background:#fff;display:grid;place-items:center}
    .m{width:52%;display:grid;place-items:center}
    .m svg{width:100%;height:auto;display:block}
  </style><div class="m">${data}</div>`);
  await run(CHROME, ["--headless", "--disable-gpu", "--hide-scrollbars",
    `--screenshot=${out}`, "--window-size=1200,1200", `file://${page}`], { timeout: 25000 });
  if (!existsSync(out)) throw new Error("rasteriser produced nothing");
}

function extOf(u) {
  const m = /\.(png|jpe?g|webp|avif|gif)($|\?)/i.exec(u);
  return m ? `.${m[1].toLowerCase()}` : ".png";
}
function hash(s) { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) | 0; return h; }
function slug(s) { return String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 44) || "x"; }
