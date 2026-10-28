#!/usr/bin/env node
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createEngine, WEIGHTS } from "../app/lib/engine.ts";
import { acceptsMap, checkFilters, rankPalette } from "../app/lib/search.ts";
import { MEDIA_VERSION } from "../app/lib/media.ts";
import { loadCatalog } from "./lib/catalog.mjs";
import { contentDocs } from "./lib/content.mjs";
import { docKey, MODELS, unpack } from "./lib/embedding.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const p = (...s) => join(ROOT, ...s);
const readJSON = (rel) => JSON.parse(readFileSync(p(rel), "utf8"));
const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : fallback;
};

const { resources, items, taxonomy } = loadCatalog(ROOT);
const searchIndex = readJSON("data/dist/search.json");
const split = arg("split", "all");
const queries = readJSON("eval/queries.json").filter((q) => split === "all" || q.split === split);
const qrels = existsSync(p("eval/qrels.json")) ? readJSON("eval/qrels.json") : {};
const accepts = acceptsMap(taxonomy.facets);
const bySlug = new Map(resources.map((r) => [r.slug, r]));
const group = (slug) => bySlug.get(slug)?.sameAs ?? slug;
const groupGrades = (grades) => {
  const out = {};
  for (const [s, g] of Object.entries(grades)) out[group(s)] = Math.max(out[group(s)] ?? 0, g);
  return out;
};

let engine;
const lexical = (q, limit = 50) => (engine ||= createEngine({ resources, items, taxonomy })).search(q.query, q.filters ?? {}, { limit }).hits.map((h) => h.slug);

const UNIFIED = (arg("kinds", "resource,preview,template,item")).split(",");
const embeddings = new Map();
function embedded(model, kinds = ["resource"]) {
  const id = `${model}:${kinds.join(",")}`;
  if (embeddings.has(id)) return embeddings.get(id);
  const dir = `.cache/embed/${model}`;
  const file = model === "gemma2" ? "vectors.json" : "docs.json";
  if (!existsSync(p(dir, file))) throw new Error(`Run node scripts/embed.mjs ${model} first.`);
  const qs = readJSON(`${dir}/queries.json`);
  const qv = unpack(qs.vectors);
  const query = new Map(qs.texts.map((t, i) => [t, qv.subarray(i * qs.dims, (i + 1) * qs.dims)]));
  let out;
  if (model === "gemma2") {
    const cache = readJSON(`${dir}/vectors.json`).vectors;
    const rows = contentDocs({ resources, items, taxonomy }, readJSON("data/dist/showcase.json"), { rev: MEDIA_VERSION })
      .filter((d) => kinds.includes(d.kind) && cache[docKey(model, d)]);
    const data = new Float32Array(rows.length * qs.dims);
    rows.forEach((d, i) => data.set(unpack(cache[docKey(model, d)]), i * qs.dims));
    out = { dims: qs.dims, slugs: rows.map((d) => d.parent), labels: rows.map((d) => `${d.kind}: ${d.label}`), docs: data, query };
  } else {
    const docs = readJSON(`${dir}/docs.json`);
    out = { dims: docs.dims, slugs: docs.slugs, docs: unpack(docs.vectors), query };
  }
  embeddings.set(id, out);
  return out;
}
function queryVector(model, q) {
  const v = embedded(model).query.get(q.query);
  if (!v) throw new Error(`No ${model} vector for "${q.query}". Run node scripts/embed.mjs ${model} again.`);
  return v;
}
function dense(model, q, limit = 50, kinds) {
  const { dims, slugs, docs } = embedded(model, kinds);
  const v = queryVector(model, q);
  const hard = Object.fromEntries(Object.entries(q.filters ?? {}).filter(([k]) => !["category", "component", "surface"].includes(k)));
  const best = new Map();
  slugs.forEach((s, i) => {
    let dot = 0;
    for (let j = 0; j < dims; j++) dot += docs[i * dims + j] * v[j];
    if (!(best.get(s) >= dot)) best.set(s, dot);
  });
  return [...best]
    .filter(([s]) => checkFilters(bySlug.get(s), hard, accepts) !== "violated")
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([s]) => s);
}
WEIGHTS.dense = Number(arg("dense-weight", WEIGHTS.dense));
const minSimilarity = arg("min-similarity") === undefined ? undefined : Number(arg("min-similarity"));
const hybrids = new Map();
function hybrid(model, q, kinds) {
  const id = `${model}:${kinds ?? ""}`;
  if (!hybrids.has(id)) {
    const { slugs, dims, docs, labels } = embedded(model, kinds);
    hybrids.set(id, createEngine({ resources, items, taxonomy, vectors: { slugs, dims, data: docs, labels, minSimilarity: minSimilarity ?? MODELS[model].minSimilarity, weight: arg("dense-weight") === undefined ? MODELS[model].weight : WEIGHTS.dense } }));
  }
  return hybrids.get(id).search(q.query, q.filters ?? {}, { limit: 50, queryVector: queryVector(model, q) }).hits.map((h) => h.slug);
}

const SYSTEMS = {
  baseline: (q) => rankPalette(searchIndex, q.query, 50).map((x) => x.s),
  lexical: (q) => lexical(q),
  ...Object.fromEntries(["qwen3", "gemma", "gemma2"].flatMap((m) => [
    [`dense-${m}`, (q) => dense(m, q)],
    [`hybrid-${m}`, (q) => hybrid(m, q)],
  ])),
  "dense-unified-gemma2": (q) => dense("gemma2", q, 50, UNIFIED),
  "unified-gemma2": (q) => hybrid("gemma2", q, UNIFIED),
};

const name = arg("system", "baseline");
const system = SYSTEMS[name];
if (!system) throw new Error(`Unknown system "${name}". Use one of: ${Object.keys(SYSTEMS).join(", ")}.`);

const gain = (g) => 2 ** g - 1;
const dcg = (grades) => grades.reduce((s, g, i) => s + gain(g) / Math.log2(i + 2), 0);
const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

const rows = [];
for (const q of queries) {
  const raw = system(q);
  const seenGroups = new Set();
  const ranked = raw.map(group).filter((g) => !seenGroups.has(g) && seenGroups.add(g));
  const grades = groupGrades(qrels[q.id] ?? {});
  const judged = q.id in qrels;
  const relevant = Object.entries(grades).filter(([, g]) => g >= 2).map(([s]) => s);
  const top = (k) => ranked.slice(0, k);
  const row = { id: q.id, intent: q.intent, judged, none: Boolean(q.expect_none), top10: top(10) };

  if (judged && !q.expect_none && relevant.length) {
    const ideal = dcg(Object.values(grades).sort((a, b) => b - a).slice(0, 10));
    row.ndcg10 = dcg(top(10).map((s) => grades[s] ?? 0)) / ideal;
    row.recall50 = relevant.filter((s) => top(50).includes(s)).length / relevant.length;
    row.success3 = top(3).some((s) => (grades[s] ?? 0) >= 2) ? 1 : 0;
  }
  if (judged) row.judged10 = top(10).length ? top(10).filter((s) => s in grades).length / top(10).length : 1;
  row.abstained = ranked.length === 0;

  const filters = q.filters ?? {};
  if (Object.keys(filters).some((k) => k !== "component" && k !== "surface")) {
    const checks = top(5).map((s) => checkFilters(bySlug.get(s), filters, accepts));
    row.violated5 = checks.length ? checks.filter((c) => c === "violated").length / checks.length : 0;
    row.unverified5 = checks.length ? checks.filter((c) => c === "unverified").length / checks.length : 0;
  }
  row.dupes8 = raw.slice(0, 8).length - new Set(raw.slice(0, 8).map(group)).size;
  rows.push(row);
}

const summarize = (rs) => ({
  queries: rs.length,
  ndcg10: mean(rs.filter((r) => "ndcg10" in r).map((r) => r.ndcg10)),
  recall50: mean(rs.filter((r) => "recall50" in r).map((r) => r.recall50)),
  success3: mean(rs.filter((r) => "success3" in r).map((r) => r.success3)),
  violated5: mean(rs.filter((r) => "violated5" in r).map((r) => r.violated5)),
  unverified5: mean(rs.filter((r) => "unverified5" in r).map((r) => r.unverified5)),
  dupes8: mean(rs.map((r) => r.dupes8)),
  noAnswerAbstain: mean(rs.filter((r) => r.none).map((r) => (r.abstained ? 1 : 0))),
  falseAbstain: mean(rs.filter((r) => !r.none).map((r) => (r.abstained ? 1 : 0))),
  judged10: mean(rs.filter((r) => "judged10" in r).map((r) => r.judged10)),
});

const overall = summarize(rows);
const byIntent = Object.fromEntries(
  [...new Set(rows.map((r) => r.intent))].map((i) => [i, summarize(rows.filter((r) => r.intent === i))]),
);

const fmt = (v) => (v == null ? "  –  " : v.toFixed(3));
const cols = ["ndcg10", "recall50", "success3", "violated5", "unverified5", "dupes8", "noAnswerAbstain", "falseAbstain", "judged10"];
console.log(`\nSystem: ${name} · split: ${split} · ${queries.length} queries · ${queries.filter((q) => q.id in qrels).length} judged\n`);
console.log(["intent".padEnd(12), "n".padStart(4), ...cols.map((c) => c.padStart(9))].join(" "));
for (const [k, s] of [["ALL", overall], ...Object.entries(byIntent)]) {
  console.log([k.padEnd(12), String(s.queries).padStart(4), ...cols.map((c) => fmt(s[c]).padStart(9))].join(" "));
}

mkdirSync(p("eval/runs"), { recursive: true });
const runName = split === "all" ? name : `${name}-${split}`;
writeFileSync(p(`eval/runs/${runName}.json`), `${JSON.stringify({ system: name, split, overall, byIntent, rows }, null, 1)}\n`);
console.log(`\nWrote eval/runs/${runName}.json`);

const poolDepth = Number(arg("pool", 0));
if (poolDepth) {
  const pool = Object.fromEntries(
    queries.map((q) => [q.id, system(q).slice(0, poolDepth).filter((s) => !(group(s) in groupGrades(qrels[q.id] ?? {})))]),
  );
  writeFileSync(p("eval/pool.json"), `${JSON.stringify(pool, null, 1)}\n`);
  console.log(`Wrote eval/pool.json (${Object.values(pool).flat().length} unjudged results)`);
}
