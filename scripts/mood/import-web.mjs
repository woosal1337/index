#!/usr/bin/env node

import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync, rmSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { tmpdir } from "node:os";
import { acquire } from "./boards-lock.mjs";

const run = promisify(execFile);
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const MEDIA = join(root, "public", "media");
const VIDEO = join(MEDIA, "video");
const ORIGINAL = join(root, "media", "original");
const BOARDS = join(root, "data", "boards.json");
const CACHE = join(root, ".cache", "import");

const UA = "mood-import/1.0 (personal reference archive; +https://github.com/woosal1337/mood)";

const MIN_GAP_MS = 800;
const MAX_RETRY = 3;

const TIERS = [
  { suffix: "tiny", width: 192, q: 74 },
  { suffix: "thumb", width: 480, q: 80 },
  { suffix: "full", width: 1440, q: 82 },
];

const SOURCES = {
  seesaw: {
    host: "www.seesaw.website",
    sitemap: "https://www.seesaw.website/sitemap-0.xml",
    entry: (u) => u.includes("/websites/"),
    label: "seesaw.website",
    parse(html, url) {
      const title = (meta(html, "og:title") || "").replace(/\s*—\s*SEESAW\s*$/i, "").trim();
      const image = meta(html, "og:image");
      if (!image) return null;
      return {
        topic: title || slugTitle(url),
        text: meta(html, "og:description") || "",
        author: "seesaw",
        authorName: "seesaw.website",
        url,
        media: [{ url: image }],
      };
    },
  },

  "seesaw-fonts": {
    host: "www.seesaw.website",
    sitemap: "https://www.seesaw.website/sitemap-0.xml",
    entry: (u) => u.includes("/font/"),
    label: "seesaw.website fonts",
    parse(html, url) {
      const title = (meta(html, "og:title") || "").replace(/\s*—\s*SEESAW\s*$/i, "").trim();
      const image = meta(html, "og:image");
      if (!image) return null;
      return {
        topic: title || slugTitle(url),
        text: meta(html, "og:description") || "",
        author: "seesaw",
        authorName: "seesaw.website",
        url,
        media: [{ url: image }],
      };
    },
  },

  posts: {
    host: "posts.design",
    sitemap: "https://posts.design/sitemap.xml",
    entry: (u) => /posts\.design\/[a-z0-9-]+-20\d{2}-\d{2}-\d{2}$/.test(u),
    label: "posts.design",
    parse(html, url) {
      const all = [...new Set(matchAll(html, /https:\/\/posts\.design\/images\/posts\/[^"'\s)\\]+\.(?:webp|png|jpe?g|gif|mp4)/g))];
      const full = all.filter((u) => !u.includes("-thumb."));
      const media = (full.length ? full : all).map((u) => ({ url: u }));
      if (!media.length) return null;

      const stem = (/\/images\/posts\/([^"'\s)\\]+?)(?:-thumb)?\.\w+$/.exec(media[0].url) || [])[1] || "";

      const parts = /^(x-twitter|bluesky|mastodon|threads|instagram)-(.+?)-([A-Za-z0-9]{10,})-/.exec(stem);
      const network = parts ? parts[1] : "";
      const author = parts ? parts[2] : "";
      const tweet = network === "x-twitter" && /^\d{15,25}$/.test(parts[3]) ? parts[3] : null;

      const topic = (meta(html, "og:title") || "")
        .replace(/\s*-\s*posts\.design\s*$/i, "")
        .replace(/^@[A-Za-z0-9_]+\s*—\s*/, "")
        .trim();

      return {
        topic: topic || slugTitle(url),
        text: meta(html, "og:description") || "",
        author,
        authorName: "",

        url: tweet ? `https://x.com/i/status/${tweet}` : url,
        via: url,
        tweet,
        media,
      };
    },
  },
};

const argv = process.argv.slice(2);
const dry = argv.includes("--dry-run");
const limit = Number((argv.find((a) => a.startsWith("--limit")) || "").split("=")[1] || argv[argv.indexOf("--limit") + 1]) || Infinity;
const want = argv.find((a) => !a.startsWith("--") && SOURCES[a]) || (argv.includes("all") ? "all" : null);

if (!want) {
  console.error(`usage: node scripts/import-web.mjs <${Object.keys(SOURCES).join("|")}|all> [--limit N] [--dry-run]`);
  process.exit(1);
}
const chosen = want === "all" ? Object.keys(SOURCES) : [want];

for (const d of [MEDIA, VIDEO, ORIGINAL, CACHE]) mkdirSync(d, { recursive: true });

const lastHit = new Map();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function polite(url) {
  const host = new URL(url).host;
  const wait = (lastHit.get(host) || 0) + MIN_GAP_MS - Date.now();
  if (wait > 0) await sleep(wait);
  lastHit.set(host, Date.now());
}

async function get(url, { binary = false, cache = true } = {}) {
  const key = join(CACHE, createHash("sha1").update(url).digest("hex") + (binary ? ".bin" : ".html"));
  if (cache && !binary && existsSync(key)) return readFileSync(key, "utf8");

  for (let attempt = 0; attempt < MAX_RETRY; attempt++) {
    await polite(url);
    let res;
    try {
      res = await fetch(url, { headers: { "user-agent": UA, accept: binary ? "image/*,video/*" : "text/html" } });
    } catch (err) {
      if (attempt === MAX_RETRY - 1) throw err;
      await sleep(1500 * (attempt + 1));
      continue;
    }

    if (res.status === 429 || res.status === 503) {
      const after = Number(res.headers.get("retry-after")) || 5 * (attempt + 1);
      await sleep(after * 1000);
      continue;
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    if (binary) return Buffer.from(await res.arrayBuffer());
    const text = await res.text();
    if (cache) writeFileSync(key, text);
    return text;
  }
  throw new Error("gave up after retries");
}

async function allowed(host) {
  let txt;
  try {
    txt = await get(`https://${host}/robots.txt`, { cache: false });
  } catch {
    return { ok: true, note: "no robots.txt" };
  }
  const lines = txt.split(/\r?\n/).map((l) => l.replace(/#.*/, "").trim());
  let inStar = false;
  const dis = [];
  for (const l of lines) {
    const [k, ...rest] = l.split(":");
    const v = rest.join(":").trim();
    if (/^user-agent$/i.test(k)) inStar = v === "*";
    else if (inStar && /^disallow$/i.test(k) && v) dis.push(v);
  }
  const signal = (/Content-Signal:\s*(.+)/i.exec(txt) || [])[1];
  return { ok: !dis.includes("/"), disallow: dis, signal: signal?.trim() };
}

async function dimensions(file) {
  const { stdout } = await run("sips", ["-g", "pixelWidth", "-g", "pixelHeight", file]);
  const w = Number(/pixelWidth:\s*(\d+)/.exec(stdout)?.[1]);
  const h = Number(/pixelHeight:\s*(\d+)/.exec(stdout)?.[1]);
  if (!w || !h) throw new Error("no readable image size");
  return { w, h };
}

async function bring(url, id, scratch) {
  const isVideo = /\.mp4($|\?)/i.test(url);
  const raw = join(scratch, `${id}${isVideo ? ".mp4" : guessExt(url)}`);
  writeFileSync(raw, await get(url, { binary: true }));

  const still = join(scratch, `${id}.png`);
  if (isVideo) {
    await run("ffmpeg", ["-y", "-loglevel", "error", "-ss", "0.5", "-i", raw, "-frames:v", "1", still]);
  } else {
    await run("sips", ["-s", "format", "png", raw, "--out", still]);
  }

  const { w, h } = await dimensions(still);
  for (const t of TIERS) {
    await run("cwebp", ["-quiet", "-resize", String(Math.min(t.width, w)), "0", "-q", String(t.q), still, "-o", join(MEDIA, `${id}-${t.suffix}.webp`)]);
  }

  if (isVideo) {
    await run("ffmpeg", ["-y", "-loglevel", "error", "-i", raw,
      "-vf", "scale='min(1280,iw)':-2",
      "-c:v", "libx264", "-crf", "24", "-preset", "medium", "-pix_fmt", "yuv420p",
      "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart",
      join(VIDEO, `${id}.mp4`)]);
  }

  writeFileSync(join(ORIGINAL, `${id}${isVideo ? ".mp4" : guessExt(url)}`), readFileSync(raw));

  const thumbW = Math.min(480, w);
  return {
    id,
    thumb: `/media/${id}-thumb.webp`,
    full: `/media/${id}-full.webp`,
    isVideo,
    w: thumbW,
    h: Math.round((thumbW * h) / w),
    ...(isVideo ? { video: `/media/video/${id}.mp4` } : {}),
  };
}

acquire("import-web");
const boards = JSON.parse(readFileSync(BOARDS, "utf8"));
const haveIds = new Set(boards.flatMap((b) => b.images.map((i) => i.id)));

const haveTweets = new Set(
  boards.flatMap((b) => b.images.map((i) => (/^tw_(\d+)/.exec(i.id) || [])[1]).filter(Boolean))
);
const haveUrls = new Set(boards.map((b) => b.tweetUrl).filter(Boolean));

const scratch = join(tmpdir(), `mood-import-${process.pid}`);
mkdirSync(scratch, { recursive: true });

let totalAdded = 0;
const report = [];

for (const name of chosen) {
  const src = SOURCES[name];
  console.log(`\n━━ ${src.label} ━━`);

  const rules = await allowed(src.host);
  if (rules.signal) console.log(`  content-signal: ${rules.signal}`);
  if (!rules.ok) {
    console.log(`  robots.txt disallows "/" for this agent. Skipping.`);
    report.push({ name, added: 0, note: "robots.txt disallow" });
    continue;
  }

  const sm = await get(src.sitemap, { cache: false });
  const urls = [...new Set(matchAll(sm, /<loc>([^<]+)<\/loc>/g, 1))].filter(src.entry);
  console.log(`  ${urls.length} entries in the sitemap`);

  const todo = urls.slice(0, limit === Infinity ? urls.length : limit);
  let added = 0, skipped = 0, failed = 0, dupes = 0;

  for (const [n, url] of todo.entries()) {
    try {
      const html = await get(url);
      const item = src.parse(html, url);
      if (!item) { failed++; continue; }

      if (item.tweet && haveTweets.has(item.tweet)) { dupes++; continue; }
      if (haveUrls.has(item.url)) { dupes++; continue; }

      if (dry) { added++; continue; }

      const images = [];
      for (const [k, m] of item.media.entries()) {
        const id = `${name}-${slug(item.topic)}-${createHash("sha1").update(m.url).digest("hex").slice(0, 8)}${item.media.length > 1 ? `-${String(k).padStart(2, "0")}` : ""}`;
        if (haveIds.has(id)) { continue; }
        try {
          const rec = await bring(m.url, id, scratch);
          if (rec) { images.push(rec); haveIds.add(id); }
        } catch (err) {
          failed++;
        }
      }
      if (!images.length) { skipped++; continue; }

      boards.push({
        id: `${name}:${slug(item.topic)}`,
        slug: `board-${name}-${slug(item.topic)}`,
        author: item.author || "",
        authorName: item.authorName || "",
        text: item.text || "",
        topic: item.topic,
        tweetUrl: item.url,
        postedAt: new Date().toISOString(),
        savedAt: new Date().toISOString(),
        metrics: { likes: 0, retweets: 0, views: 0, bookmarks: 0 },
        images,
        imageCount: images.length,
        fetched: true,
        source: src.label,
        ...(item.via ? { via: item.via } : {}),
      });
      if (item.url) haveUrls.add(item.url);
      added++;
      if (added % 25 === 0) {
        writeFileSync(BOARDS, JSON.stringify(boards));
        console.log(`  ${n + 1}/${todo.length} · ${added} added · ${dupes} already here · ${failed} failed`);
      }
    } catch (err) {
      failed++;
    }
  }

  if (!dry) writeFileSync(BOARDS, JSON.stringify(boards));
  console.log(`  done — ${added} added · ${dupes} already on the plane · ${skipped} without media · ${failed} failed`);
  report.push({ name, added, dupes, skipped, failed });
  totalAdded += added;
}

rmSync(scratch, { recursive: true, force: true });

console.log(`\n${dry ? "[dry run] " : ""}${totalAdded} entries${dry ? " would be added" : " added"}.`);
if (!dry && totalAdded) console.log(`Run \`npm run data\` to rebuild the payload.`);

function meta(html, prop) {
  const re = new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]*content=["']([^"']*)["']`, "i");
  const alt = new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]*(?:property|name)=["']${prop}["']`, "i");
  const m = re.exec(html) || alt.exec(html);
  return m ? decode(m[1]) : null;
}

function matchAll(s, re, group = 0) {
  return [...s.matchAll(re)].map((m) => m[group]);
}

function decode(s) {
  return s
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#(\d+);/g, (_, d) => String.fromCharCode(+d))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)));
}

function slug(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 44) || "item";
}

function slugTitle(url) {
  return decodeURIComponent(url.split("/").filter(Boolean).pop() || "").replace(/[-_]+/g, " ");
}

function guessExt(url) {
  const m = /\.(png|jpe?g|webp|avif|gif)(?:$|\?)/i.exec(url);
  return m ? `.${m[1].toLowerCase()}` : ".png";
}
