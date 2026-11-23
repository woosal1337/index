#!/usr/bin/env node

import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { readdirSync, readFileSync, writeFileSync, renameSync, mkdirSync, existsSync, statSync, rmSync } from "node:fs";
import { join, dirname, extname, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { tmpdir } from "node:os";
import { acquire } from "./boards-lock.mjs";

const run = promisify(execFile);
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const INCOMING = join(root, "media", "incoming");
const ORIGINAL = join(root, "media", "original");
const MEDIA = join(root, "public", "media");
const VIDEO = join(MEDIA, "video");
const BOARDS = join(root, "data", "boards.json");

const IMAGE_EXT = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif", ".tif", ".tiff", ".heic", ".avif"]);
const VIDEO_EXT = new Set([".mp4", ".mov", ".m4v", ".webm", ".avi", ".mkv"]);

const TIERS = [
  { suffix: "tiny", width: 192, q: 74 },
  { suffix: "thumb", width: 480, q: 80 },
  { suffix: "full", width: 1440, q: 82 },
];

for (const d of [INCOMING, ORIGINAL, MEDIA, VIDEO]) mkdirSync(d, { recursive: true });

const files = readdirSync(INCOMING)
  .filter((f) => !f.startsWith("."))
  .filter((f) => statSync(join(INCOMING, f)).isFile());

if (!files.length) {
  console.log(`Nothing in media/incoming/. Drop files there and run this again.`);
  process.exit(0);
}

acquire("ingest");
const boards = JSON.parse(readFileSync(BOARDS, "utf8"));
const known = new Set(boards.flatMap((b) => b.images.map((i) => i.id)));

const scratch = join(tmpdir(), `mood-ingest-${process.pid}`);
mkdirSync(scratch, { recursive: true });

let added = 0;
const skipped = [];

for (const name of files) {
  const src = join(INCOMING, name);
  const ext = extname(name).toLowerCase();
  const isVideo = VIDEO_EXT.has(ext);

  if (!isVideo && !IMAGE_EXT.has(ext)) {
    skipped.push(`${name} — not an image or a video`);
    continue;
  }

  const id = `local-${slug(basename(name, ext))}-${hashOf(src)}`;
  if (known.has(id)) {
    skipped.push(`${name} — already on the plane`);
    filed(src, name);
    continue;
  }

  try {
    const still = join(scratch, `${id}.png`);
    if (isVideo) {
      await run("ffmpeg", ["-y", "-loglevel", "error", "-ss", "0.5", "-i", src, "-frames:v", "1", still]);
    } else {
      await run("sips", ["-s", "format", "png", src, "--out", still]);
    }

    const { w, h } = await dimensions(still);

    for (const t of TIERS) {
      const width = Math.min(t.width, w);
      await run("cwebp", ["-quiet", "-resize", String(width), "0", "-q", String(t.q), still, "-o", join(MEDIA, `${id}-${t.suffix}.webp`)]);
    }

    if (isVideo) {
      await run("ffmpeg", [
        "-y", "-loglevel", "error", "-i", src,

        "-vf", "scale='min(1280,iw)':-2",
        "-c:v", "libx264", "-crf", "24", "-preset", "medium", "-pix_fmt", "yuv420p",
        "-c:a", "aac", "-b:a", "128k",
        "-movflags", "+faststart",
        join(VIDEO, `${id}.mp4`),
      ]);
    }

    const thumbW = Math.min(480, w);
    boards.push({
      id: `local:${id}`,
      slug: `board-${id}`,
      author: "",
      authorName: "",
      text: "",
      topic: basename(name, ext).replace(/[-_]+/g, " "),
      tweetUrl: "",
      postedAt: statSync(src).mtime.toISOString(),
      savedAt: new Date().toISOString(),
      metrics: { likes: 0, retweets: 0, views: 0, bookmarks: 0 },
      images: [
        {
          id,
          thumb: `/media/${id}-thumb.webp`,
          full: `/media/${id}-full.webp`,
          isVideo,
          w: thumbW,
          h: Math.round((thumbW * h) / w),
          ...(isVideo ? { video: `/media/video/${id}.mp4` } : {}),
        },
      ],
      imageCount: 1,
      fetched: true,
    });

    known.add(id);
    filed(src, name);
    added++;
    console.log(`  + ${name}${isVideo ? " (video)" : ""}`);
  } catch (err) {
    skipped.push(`${name} — ${String(err.message || err).split("\n")[0]}`);
  }
}

rmSync(scratch, { recursive: true, force: true });

if (added) {
  writeFileSync(BOARDS, JSON.stringify(boards, null, 0));
  console.log(`\n${added} added to data/boards.json.`);
  console.log(`Run \`npm run data\` to rebuild the payload, then reload.`);
}
if (skipped.length) {
  console.log(`\nskipped:`);
  for (const s of skipped) console.log(`  ${s}`);
}

function filed(src, name) {
  let target = join(ORIGINAL, name);
  if (existsSync(target)) {
    const e = extname(name);
    target = join(ORIGINAL, `${basename(name, e)}-${Date.now().toString(36)}${e}`);
  }
  renameSync(src, target);
}

async function dimensions(png) {
  const { stdout } = await run("sips", ["-g", "pixelWidth", "-g", "pixelHeight", png]);
  const w = Number(/pixelWidth:\s*(\d+)/.exec(stdout)?.[1]);
  const h = Number(/pixelHeight:\s*(\d+)/.exec(stdout)?.[1]);
  if (!w || !h) throw new Error("could not read the image size");
  return { w, h };
}

function hashOf(path) {
  return createHash("sha1").update(readFileSync(path)).digest("hex").slice(0, 8);
}

function slug(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "item";
}
