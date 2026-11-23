#!/usr/bin/env node

import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const MEDIA = join(root, "public", "media");

const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i === -1 ? d : process.argv[i + 1]; };
const want = arg("source", "all");
const PER = Number(arg("per", 240));
const OUT = arg("out", join(root, ".cache", "sheets"));

const boards = JSON.parse(readFileSync(join(root, "data", "boards.json"), "utf8"));

const bucket = (b) => {
  const s = (b.source || "").toLowerCase();
  if (!s) return "x";
  if (s.includes("posts.design")) return "posts";
  if (s.includes("seesaw")) return "seesaw";
  return s.replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
};

const rows = [];
for (const b of boards) {
  if (want !== "all" && bucket(b) !== want) continue;
  for (const img of b.images) {
    if (!existsSync(join(MEDIA, `${img.id}-tiny.webp`))) continue;
    rows.push({ id: img.id, author: b.author, topic: b.topic, url: b.tweetUrl, video: !!img.isVideo, group: bucket(b) });
  }
}

if (!rows.length) { console.log("nothing to sheet"); process.exit(0); }

mkdirSync(OUT, { recursive: true });
const pages = Math.ceil(rows.length / PER);
const rel = relative(OUT, MEDIA);

for (let p = 0; p < pages; p++) {
  const slice = rows.slice(p * PER, (p + 1) * PER);
  const nav = [
    p > 0 ? `<a href="${want}-${pad(p)}.html">‹ prev</a>` : `<span>‹ prev</span>`,
    `<b>${p + 1} / ${pages}</b>`,
    p < pages - 1 ? `<a href="${want}-${pad(p + 2)}.html">next ›</a>` : `<span>next ›</span>`,
  ].join("");

  const cells = slice.map((r, i) => `
    <figure>
      <a href="${esc(r.url)}" target="_blank" rel="noreferrer noopener">
        <img src="${rel}/${r.id}-tiny.webp" loading="lazy" alt="">
      </a>
      ${r.video ? '<span class="v">video</span>' : ""}
      <figcaption><b>${p * PER + i + 1}</b> @${esc(r.author || "—")} · ${esc((r.topic || "").slice(0, 64))}</figcaption>
    </figure>`).join("");

  writeFileSync(join(OUT, `${want}-${pad(p + 1)}.html`), page(nav, cells, `${want} ${p + 1}/${pages}`));
}

writeFileSync(join(OUT, "index.html"), page(
  "", Object.entries(rows.reduce((a, r) => ((a[r.group] = (a[r.group] || 0) + 1), a), {}))
    .map(([k, n]) => `<p><b>${k}</b> — ${n} images</p>`).join("") +
  `<p>${pages} sheet(s) of ${PER}</p><p><a href="${want}-001.html">open the first sheet →</a></p>`,
  "contact sheets"));

console.log(`${rows.length} images → ${pages} sheet(s) of ${PER}`);
console.log(`open ${join(OUT, "index.html")}`);

function pad(n) { return String(n).padStart(3, "0"); }
function esc(s) { return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }

function page(nav, body, title) {
  return `<!doctype html><meta charset="utf-8"><title>${esc(title)}</title>
<style>
  :root { color-scheme: dark }
  body { margin:0; background:#0a0a0a; color:#e6e6e6;
         font:12px/1.4 ui-sans-serif,system-ui,sans-serif }
  nav { position:sticky; top:0; z-index:2; display:flex; gap:18px; align-items:center;
        padding:10px 14px; background:#0a0a0aee; backdrop-filter:blur(8px);
        border-bottom:1px solid #ffffff1f }
  nav a,nav span { color:#e6e6e6; text-decoration:none }
  nav span { opacity:.3 }
  main { display:grid; grid-template-columns:repeat(auto-fill,minmax(190px,1fr));
         gap:10px; padding:14px }
  figure { margin:0; position:relative; background:#141414; border-radius:4px; overflow:hidden }
  img { display:block; width:100%; height:150px; object-fit:contain; background:#141414 }
  figcaption { padding:5px 6px; font-size:10px; color:#ffffff8c;
               white-space:nowrap; overflow:hidden; text-overflow:ellipsis }
  figcaption b { color:#ffffff4d; margin-right:4px }
  .v { position:absolute; top:5px; right:5px; padding:1px 5px; border-radius:3px;
       background:#000000a6; font-size:9px }
</style>
<nav>${nav}</nav><main>${body}</main>`;
}
