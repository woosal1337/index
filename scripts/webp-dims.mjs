#!/usr/bin/env node

import { readFileSync, readdirSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

function webpSize(buf) {
  if (buf.length < 30) return null;
  if (buf.toString("ascii", 0, 4) !== "RIFF" || buf.toString("ascii", 8, 12) !== "WEBP") return null;
  const fourcc = buf.toString("ascii", 12, 16);
  if (fourcc === "VP8 ") {
    return { w: buf.readUInt16LE(26) & 0x3fff, h: buf.readUInt16LE(28) & 0x3fff };
  }
  if (fourcc === "VP8L") {
    const b = buf.readUInt32LE(21);
    return { w: (b & 0x3fff) + 1, h: ((b >> 14) & 0x3fff) + 1 };
  }
  if (fourcc === "VP8X") {
    const w = 1 + (buf[24] | (buf[25] << 8) | (buf[26] << 16));
    const h = 1 + (buf[27] | (buf[28] << 8) | (buf[29] << 16));
    return { w, h };
  }
  return null;
}

const dims = {};
let ok = 0, bad = 0;
for (const dir of ["public/og", "public/shots", "public/tpl"]) {
  let files = [];
  try { files = readdirSync(join(ROOT, dir)); } catch { continue; }
  for (const f of files) {
    if (!f.endsWith(".webp")) continue;
    try {
      const fd = readFileSync(join(ROOT, dir, f)).subarray(0, 64);
      const s = webpSize(fd);
      if (s && s.w && s.h) { dims[`/${dir.replace("public/", "")}/${f}`] = [s.w, s.h]; ok++; }
      else bad++;
    } catch { bad++; }
  }
}
mkdirSync(join(ROOT, "data/dist"), { recursive: true });
writeFileSync(join(ROOT, "data/dist/image-dims.json"), JSON.stringify(dims));
console.log(`image dimensions: ${ok} read, ${bad} unreadable`);
