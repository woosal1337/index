#!/usr/bin/env node

import { readFileSync, writeFileSync, rmSync, existsSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { acquire } from "./boards-lock.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const BOARDS = join(root, "data", "boards.json");
const MEDIA = join(root, "public", "media");
const VIDEO = join(MEDIA, "video");
const ORIGINAL = join(root, "media", "original");

const argv = process.argv.slice(2);
const flag = (n) => { const i = argv.indexOf(`--${n}`); return i === -1 ? null : argv[i + 1]; };
const yes = argv.includes("--yes");

const wanted = [];
const fromFile = flag("from");
if (fromFile) {
  for (const line of readFileSync(fromFile, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const [author, ...rest] = t.split(/\t|\s{2,}/);
    wanted.push({ author: author.replace(/^@/, ""), topic: rest.join(" ").trim() || null });
  }
} else if (flag("id")) {
  wanted.push({ id: flag("id") });
} else if (flag("source")) {
  wanted.push({ source: flag("source") });
} else if (flag("author") || flag("topic")) {
  wanted.push({ author: (flag("author") || "").replace(/^@/, "") || null, topic: flag("topic") });
} else {
  console.error("nothing to match. Pass --author, --topic, --id, --source or --from.");
  process.exit(1);
}

acquire("remove");
const boards = JSON.parse(readFileSync(BOARDS, "utf8"));
const norm = (s) => String(s || "").trim().toLowerCase();

const doomed = new Set();
for (const w of wanted) {
  const hits = boards.filter((b) => {
    if (w.id) return b.id === w.id;
    if (w.source) return String(b.source || "").toLowerCase().includes(w.source.toLowerCase());
    if (w.author && norm(b.author) !== norm(w.author)) return false;

    if (w.topic && norm(b.topic) !== norm(w.topic)) return false;
    return true;
  });
  if (!hits.length) {
    console.log(`  no match: ${w.id || w.source || `@${w.author}${w.topic ? ` / "${w.topic}"` : ""}`}`);
    continue;
  }
  for (const h of hits) doomed.add(h);
}

if (!doomed.size) {
  console.log("\nNothing matched. Nothing removed.");
  process.exit(0);
}

let images = 0, videos = 0;
console.log(`\n${doomed.size} board(s) matched:\n`);
for (const b of doomed) {
  const v = b.images.filter((i) => i.isVideo).length;
  images += b.images.length;
  videos += v;
  console.log(`  @${b.author || "—"}  ${JSON.stringify(b.topic)}`);
  console.log(`    ${b.images.length} image(s)${v ? `, ${v} video` : ""}  ·  ${b.tweetUrl || "no link"}`);
}
console.log(`\n${images} image(s), ${videos} video(s) in total.`);

if (!yes) {
  console.log(`\nNothing removed. Add --yes to remove these.`);
  process.exit(0);
}

const originals = new Map();
for (const f of readdirSync(ORIGINAL)) {
  const stem = f.replace(/\.[^.]+$/, "");
  if (!originals.has(stem)) originals.set(stem, []);
  originals.get(stem).push(f);
}

let files = 0;
for (const b of doomed) {
  for (const img of b.images) {
    for (const s of ["tiny", "thumb", "full"]) {
      const p = join(MEDIA, `${img.id}-${s}.webp`);
      if (existsSync(p)) { rmSync(p); files++; }
    }
    const mp4 = join(VIDEO, `${img.id}.mp4`);
    if (existsSync(mp4)) { rmSync(mp4); files++; }
    for (const f of originals.get(img.id) || []) { rmSync(join(ORIGINAL, f)); files++; }
  }
}

writeFileSync(BOARDS, JSON.stringify(boards.filter((b) => !doomed.has(b))));

console.log(`\nRemoved ${doomed.size} board(s) and ${files} file(s).`);
console.log(`Run \`npm run data\` to rebuild the payload.`);
