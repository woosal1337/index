#!/usr/bin/env node

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const PUBLIC = join(root, "public");
const OUT = join(PUBLIC, "data", "mood.json");

const tinyOf = (id) => `/media/${id}-tiny.webp`;
const thumbOf = (id) => `/media/${id}-thumb.webp`;
const fullOf = (id) => `/media/${id}-full.webp`;
const videoOf = (id) => `/media/video/${id}.mp4`;
const onDisk = (webPath) => join(PUBLIC, webPath.replace(/^\//, ""));

const IMAGE = 0;
const VIDEO = 1;
const VIDEO_GONE = 2;

const boardsRaw = JSON.parse(readFileSync(join(root, "data", "boards.json"), "utf8"));

const boards = [];
const items = [];
const missing = [];
let videos = 0;
let orphanVideos = 0;

for (const b of boardsRaw) {
  const bi = boards.length;
  const mine = [];

  for (const img of b.images ?? []) {
    const id = img.id;
    const absent = [tinyOf, thumbOf, fullOf].filter((f) => !existsSync(onDisk(f(id))));
    if (absent.length) {
      missing.push(`${id} (${absent.map((f) => f(id).split("-").pop()).join(", ")})`);
      continue;
    }
    let kind = IMAGE;
    if (img.isVideo) {
      if (existsSync(onDisk(videoOf(id)))) {
        kind = VIDEO;
        videos++;
      } else {
        kind = VIDEO_GONE;
        orphanVideos++;
      }
    }
    mine.push(items.length);
    items.push([id, img.w || 480, img.h || 480, bi, kind]);
  }

  if (!mine.length) continue;
  boards.push({
    a: b.author ?? "",
    n: b.authorName ?? "",
    t: b.topic ?? "",
    x: stripTco(b.text ?? ""),
    u: b.tweetUrl ?? "",
    d: b.postedAt ?? "",
    l: b.metrics?.likes ?? 0,
    b: b.metrics?.bookmarks ?? 0,
    i: mine,
  });
}

if (missing.length) {
  console.error(`\n  ${missing.length} image(s) have no file on disk:`);
  for (const id of missing.slice(0, 10)) console.error(`    ${id}`);
  if (missing.length > 10) console.error(`    … and ${missing.length - 10} more`);
  console.error(
    `\n  Missing "tiny.webp" means the small tier was not built:` +
      ` run \`node scripts/make-tiny.mjs\`.` +
      `\n  Anything else means the media was not copied in.\n`
  );
  process.exit(1);
}

const authors = new Set(boards.map((b) => b.a).filter(Boolean));

const payload = {
  counts: {
    items: items.length,
    boards: boards.length,
    authors: authors.size,
    videos,
    orphanVideos,
  },
  boards,
  items,
};

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(payload));

const kb = (Buffer.byteLength(JSON.stringify(payload)) / 1024).toFixed(0);
console.log(
  `mood.json — ${items.length} items · ${boards.length} boards · ` +
    `${authors.size} authors · ${videos} videos playable` +
    (orphanVideos ? ` · ${orphanVideos} poster-only` : "") +
    ` · ${kb} KB`
);

function stripTco(s) {
  return s.replace(/\s*https:\/\/t\.co\/\w+\s*$/, "").trim();
}
