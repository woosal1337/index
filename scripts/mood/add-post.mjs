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
const VIDEO = join(MEDIA, "video");
const ORIGINAL = join(root, "media", "original");
const BOARDS = join(root, "data", "boards.json");

const TIERS = [
  { suffix: "tiny", width: 192, q: 74 },
  { suffix: "thumb", width: 480, q: 80 },
  { suffix: "full", width: 1440, q: 82 },
];

const file = process.argv[2];
if (!file) {
  console.error("usage: node scripts/add-post.mjs <descriptor.json>");
  process.exit(1);
}

for (const d of [MEDIA, VIDEO, ORIGINAL]) mkdirSync(d, { recursive: true });

const spec = JSON.parse(readFileSync(file, "utf8"));
acquire("add-post");
const boards = JSON.parse(readFileSync(BOARDS, "utf8"));
const have = new Set(boards.map((b) => b.id));
const scratch = join(tmpdir(), `mood-add-${process.pid}`);
mkdirSync(scratch, { recursive: true });

let added = 0;

for (const post of Array.isArray(spec) ? spec : [spec]) {
  const boardId = `tw:${post.id}`;
  if (have.has(boardId)) {
    console.log(`  = @${post.author} — already on the plane`);
    continue;
  }

  const images = [];
  let n = 0;

  for (const m of post.media) {
    const id = m.quoted
      ? `tw_${post.id}-q${createHash("sha1").update(String(m.quoted)).digest("hex").slice(0, 10)}`
      : `tw_${post.id}-${String(n++).padStart(2, "0")}`;

    try {
      images.push(await bring(m, id));
      console.log(`  + ${id}${m.url.includes(".mp4") ? " (video)" : ""}`);
    } catch (err) {
      console.log(`  ! ${id} — ${String(err.message || err).split("\n")[0]}`);
    }
  }

  if (!images.length) continue;

  boards.push({
    id: boardId,
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
  });
  have.add(boardId);
  added++;
}

writeFileSync(BOARDS, JSON.stringify(boards));
rmSync(scratch, { recursive: true, force: true });

console.log(`\n${added} post(s) added. Run \`npm run data\` to rebuild the payload.`);

async function bring(m, id) {
  const isVideo = /\.mp4(\?|$)/i.test(m.url);
  const ext = isVideo ? ".mp4" : (/\.(jpe?g|png|webp|gif)(\?|$)/i.exec(m.url)?.[1] ? `.${RegExp.$1.toLowerCase()}` : ".jpg");
  const raw = join(scratch, `${id}${ext}`);
  writeFileSync(raw, await download(m.url));

  const still = join(scratch, `${id}.png`);
  if (isVideo && m.poster) {
    const p = join(scratch, `${id}-poster.jpg`);
    writeFileSync(p, await download(m.poster));
    await run("sips", ["-s", "format", "png", p, "--out", still]);
  } else if (isVideo) {
    await run("ffmpeg", ["-y", "-loglevel", "error", "-ss", "0.5", "-i", raw, "-frames:v", "1", still]);
  } else {
    await run("sips", ["-s", "format", "png", raw, "--out", still]);
  }

  const { stdout } = await run("sips", ["-g", "pixelWidth", "-g", "pixelHeight", still]);
  const w = Number(/pixelWidth:\s*(\d+)/.exec(stdout)?.[1]);
  const h = Number(/pixelHeight:\s*(\d+)/.exec(stdout)?.[1]);
  if (!w || !h) throw new Error("no readable image size");

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

  writeFileSync(join(ORIGINAL, `${id}${ext}`), readFileSync(raw));

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
  const res = await fetch(u, { headers: { "user-agent": "Mozilla/5.0", accept: "image/*,video/*,*/*" } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

const _ = null;
function slug(s) { return String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "post"; }
function stripTco(s) { return s.replace(/\s*https:\/\/t\.co\/\w+\s*$/, "").trim(); }
