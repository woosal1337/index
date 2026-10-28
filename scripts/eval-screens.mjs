#!/usr/bin/env node
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { MEDIA_VERSION } from "../app/lib/media.ts";
import { createApi, SCREEN_WEIGHTS } from "../server/app.mjs";
import { loadCatalog } from "./lib/catalog.mjs";
import { contentDocs } from "./lib/content.mjs";
import { docKey, unpack } from "./lib/embedding.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const p = (...s) => join(ROOT, ...s);
const readJSON = (rel) => JSON.parse(readFileSync(p(rel), "utf8"));
const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : fallback;
};

const catalog = loadCatalog(ROOT);
const showcase = readJSON("data/dist/showcase.json");
const split = arg("split", "all");
const queries = readJSON("eval/screens.json").filter((q) => split === "all" || q.split === split);
const qrels = existsSync(p("eval/screen-qrels.json")) ? readJSON("eval/screen-qrels.json") : {};
const cache = readJSON(".cache/embed/gemma2/vectors.json").vectors;
const qs = readJSON(".cache/embed/gemma2/queries.json");
const qv = unpack(qs.vectors);
const queryVector = new Map(qs.texts.map((t, i) => [t, qv.subarray(i * qs.dims, (i + 1) * qs.dims)]));
const docs = contentDocs(catalog, showcase, { rev: MEDIA_VERSION }).filter((d) => d.kind === "screen" && cache[docKey("gemma2", d)]);
const data = new Float32Array(docs.length * qs.dims);
docs.forEach((d, i) => data.set(unpack(cache[docKey("gemma2", d)]), i * qs.dims));
const api = createApi({ ...catalog, showcase });
api.useVectors({ docs, data, dims: qs.dims });

const tuned = { ...SCREEN_WEIGHTS };
if (arg("weights")) Object.assign(tuned, Object.fromEntries(arg("weights").split(",").map((kv) => kv.split("=")).map(([k, v]) => [k, Number(v)])));
const run = (q, weights, vector) => {
  Object.assign(SCREEN_WEIGHTS, weights);
  return api.search({ query: q.query, type: "screens", limit: 25 }, vector ? queryVector.get(q.query) : undefined).results.map((r) => r.id);
};
const SYSTEMS = {
  tags: (q) => run(q, tuned, false),
  dense: (q) => run(q, { surface: 0, style: 0, mode: 0 }, true),
  hybrid: (q) => run(q, tuned, true),
};

const gain = (g) => 2 ** g - 1;
const dcg = (grades) => grades.reduce((s, g, i) => s + gain(g) / Math.log2(i + 2), 0);
const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const fmt = (v) => (v == null ? "  –  " : v.toFixed(3));
console.log(`\nScreens · split: ${split} · ${queries.length} queries · ${queries.filter((q) => q.id in qrels).length} judged · ${docs.length} screens with vectors\n`);
console.log(["system".padEnd(8), "ndcg10", "prec5", "success3", "judged10"].map((c) => c.padStart(9)).join(" "));
const pool = {};
for (const [name, system] of Object.entries(SYSTEMS)) {
  const rows = queries.map((q) => {
    const ranked = system(q);
    const grades = qrels[q.id] ?? {};
    for (const id of ranked.slice(0, Number(arg("pool", 0)))) if (!(id in grades)) (pool[q.id] ||= new Set()).add(id);
    const ideal = dcg(Object.values(grades).sort((a, b) => b - a).slice(0, 10)) || 1;
    const top = ranked.slice(0, 10);
    return {
      ndcg10: dcg(top.map((id) => grades[id] ?? 0)) / ideal,
      prec5: ranked.slice(0, 5).filter((id) => (grades[id] ?? 0) >= 2).length / 5,
      success3: ranked.slice(0, 3).some((id) => (grades[id] ?? 0) >= 2) ? 1 : 0,
      judged10: top.length ? top.filter((id) => id in grades).length / top.length : 1,
    };
  });
  console.log([name.padEnd(8), ...["ndcg10", "prec5", "success3", "judged10"].map((m) => fmt(mean(rows.map((r) => r[m]))).padStart(9))].join(" "));
}
Object.assign(SCREEN_WEIGHTS, tuned);
if (Number(arg("pool", 0))) {
  writeFileSync(p("eval/screen-pool.json"), `${JSON.stringify(Object.fromEntries(Object.entries(pool).map(([k, v]) => [k, [...v]])), null, 1)}\n`);
  console.log(`\nWrote eval/screen-pool.json (${Object.values(pool).reduce((n, v) => n + v.size, 0)} unjudged screens)`);
}
