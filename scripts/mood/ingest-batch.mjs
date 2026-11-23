#!/usr/bin/env node

import { execFile } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { tmpdir } from "node:os";
import { acquire } from "./boards-lock.mjs";

const run = promisify(execFile);
function wait(ms) { return new Promise((r) => setTimeout(r, ms)); }
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const MEDIA = join(root, "public", "media");
const VIDEO = join(MEDIA, "video");
const ORIGINAL = join(root, "media", "original");
const BOARDS = join(root, "data", "boards.json");

const TIERS = [
  { suffix: "tiny", width: 192, q: 74 },
  { suffix: "thumb", width: 480, q: 80 },
  { suffix: "full", width: 1440, q: 82 },
];

const argv = process.argv.slice(2);
const flag = (n, d) => { const i = argv.indexOf(`--${n}`); return i === -1 ? d : argv[i + 1]; };
const file = argv[0];
if (!file || file.startsWith("--")) {
  console.error("usage: node scripts/ingest-batch.mjs <resolved.jsonl> [--jobs 16] [--limit N] [--keep-original 0]");
  process.exit(1);
}

const JOBS = Number(flag("jobs", 16));
const LIMIT = Number(flag("limit", 0));
const KEEP = flag("keep-original", "1") !== "0";

for (const d of [MEDIA, VIDEO, ...(KEEP ? [ORIGINAL] : [])]) mkdirSync(d, { recursive: true });

const posts = [];
for (const line of readFileSync(file, "utf8").split("\n")) {
  if (!line.trim()) continue;
  const p = JSON.parse(line);
  if (p.err || !p.media?.length || !p.author) continue;
  posts.push(p);
}

acquire("ingest-batch");
const boards = JSON.parse(readFileSync(BOARDS, "utf8"));
const have = new Set(boards.map((b) => b.id));
const queue = [];
for (const p of posts) {
  if (have.has(`tw:${p.id}`)) continue;
  have.add(`tw:${p.id}`);
  queue.push(p);
}
const work = LIMIT ? queue.slice(0, LIMIT) : queue;

console.log(`${posts.length} resolved · ${queue.length} new · taking ${work.length} with ${JOBS} jobs`);

const scratch = join(tmpdir(), `mood-batch-${process.pid}`);
mkdirSync(scratch, { recursive: true });

const made = new Array(work.length).fill(null);
let cursor = 0;
let done = 0;
let failed = 0;
const started = Date.now();

async function worker() {
  while (cursor < work.length) {
    const at = cursor++;
    const post = work[at];
    const images = [];
    let n = 0;
    for (const m of post.media) {
      const id = `tw_${post.id}-${String(n++).padStart(2, "0")}`;
      try {
        images.push(await bring(m, id));
      } catch (err) {
        failed++;
        console.log(`  ! ${id} — ${String(err.message || err).split("\n")[0].slice(0, 90)}`);
      }
    }
    if (images.length) made[at] = board(post, images);
    if (++done % 200 === 0) save();
    if (done % 100 === 0) {
      const per = (Date.now() - started) / done / 1000;
      const left = Math.round(((work.length - done) * per) / 60);
      console.log(`${done}/${work.length} · ${per.toFixed(2)}s each · ~${left} min left · ${failed} media failed`);
    }
  }
}

await Promise.all(Array.from({ length: JOBS }, worker));
save();

const kept = made.filter(Boolean).length;
console.log(`\n${kept} post(s) added, ${failed} media failed. Run \`npm run data\` to rebuild the payload.`);

function save() {
  const out = boards.concat(made.filter(Boolean));
  writeFileSync(BOARDS, JSON.stringify(out));
  console.log(`  saved ${out.length} boards`);
}

function board(post, images) {
  return {
    id: `tw:${post.id}`,
    slug: `board-${slug(post.author)}-${String(post.id).slice(-6)}`,
    author: post.author || "",
    authorName: post.authorName || "",
    text: post.text || "",
    topic: stripTco(post.text || ""),
    tweetUrl: `https://x.com/${post.author}/status/${post.id}`,
    postedAt: post.postedAt || new Date().toISOString(),
    savedAt: new Date().toISOString(),
    metrics: {
      likes: post.metrics?.likes ?? 0,
      retweets: post.metrics?.retweets ?? 0,
      views: post.metrics?.views ?? 0,
      bookmarks: post.metrics?.bookmarks ?? 0,
    },
    images,
    imageCount: images.length,
    fetched: true,
  };
}

async function bring(m, id) {
  const isVideo = m.kind === "video" || Boolean(m.poster) || /\.mp4(\?|$)/i.test(m.url);
  const ext = isVideo ? ".mp4" : (/\.(jpe?g|png|webp|gif)(\?|$)/i.exec(m.url)?.[1] ? `.${RegExp.$1.toLowerCase()}` : ".jpg");
  const tiers = TIERS.map((t) => join(MEDIA, `${id}-${t.suffix}.webp`));
  const mp4 = join(VIDEO, `${id}.mp4`);
  if (tiers.every(existsSync) && (!isVideo || existsSync(mp4))) return sized(id, isVideo, tiers[1]);

  const raw = join(scratch, `${id}${ext}`);
  writeFileSync(raw, await download(m.url));

  const still = join(scratch, `${id}-still.png`);
  if (isVideo && m.poster) {
    const p = join(scratch, `${id}-poster.jpg`);
    try {
      writeFileSync(p, await download(m.poster));
      await run("ffmpeg", ["-y", "-loglevel", "error", "-i", p, still]);
    } catch {
      await run("ffmpeg", ["-y", "-loglevel", "error", "-ss", "0.5", "-i", raw, "-frames:v", "1", still]);
    }
  } else if (isVideo) {
    await run("ffmpeg", ["-y", "-loglevel", "error", "-ss", "0.5", "-i", raw, "-frames:v", "1", still]);
  } else {
    await run("ffmpeg", ["-y", "-loglevel", "error", "-i", raw, still]);
  }

  const { stdout } = await run("ffprobe", ["-v", "error", "-select_streams", "v:0",
    "-show_entries", "stream=width,height", "-of", "csv=p=0:s=x", still]);
  const [w, h] = stdout.trim().split("x").map(Number);
  if (!w || !h) throw new Error("no readable image size");

  for (const t of TIERS) {
    await run("cwebp", ["-quiet", "-resize", String(Math.min(t.width, w)), "0", "-q", String(t.q),
      still, "-o", join(MEDIA, `${id}-${t.suffix}.webp`)]);
  }

  if (isVideo) {
    await run("ffmpeg", ["-y", "-loglevel", "error", "-i", raw,
      "-vf", "scale='min(1280,iw)':-2",
      "-c:v", "libx264", "-crf", "24", "-preset", "medium", "-pix_fmt", "yuv420p",
      "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart",
      join(VIDEO, `${id}.mp4`)]);
  }

  if (KEEP) writeFileSync(join(ORIGINAL, `${id}${ext}`), readFileSync(raw));
  for (const f of [raw, still, join(scratch, `${id}-poster.jpg`)]) {
    try { if (existsSync(f)) await run("rm", ["-f", f]); } catch {}
  }

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

async function download(url) {
  const u = /pbs\.twimg\.com\/media\//.test(url) && !url.includes("name=") ? `${url}${url.includes("?") ? "&" : "?"}name=orig` : url;
  for (let i = 0; i < 3; i++) {
    try {
      const res = await fetch(u, { headers: { "user-agent": "Mozilla/5.0", accept: "image/*,video/*,*/*" } });
      if (res.status === 429 || res.status >= 500) { await wait(1500 * (i + 1)); continue; }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return Buffer.from(await res.arrayBuffer());
    } catch (err) {
      if (i === 2) throw err;
      await wait(1000 * (i + 1));
    }
  }
  throw new Error("download failed");
}

async function sized(id, isVideo, thumb) {
  const { stdout } = await run("ffprobe", ["-v", "error", "-select_streams", "v:0",
    "-show_entries", "stream=width,height", "-of", "csv=p=0:s=x", thumb]);
  const [w, h] = stdout.trim().split("x").map(Number);
  return {
    id,
    thumb: `/media/${id}-thumb.webp`,
    full: `/media/${id}-full.webp`,
    isVideo,
    w,
    h,
    ...(isVideo ? { video: `/media/video/${id}.mp4` } : {}),
  };
}

function slug(s) { return String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "post"; }
function stripTco(s) { return s.replace(/\s*https:\/\/t\.co\/\w+\s*$/, "").trim(); }
