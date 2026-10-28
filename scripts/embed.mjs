#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { MEDIA_VERSION } from "../app/lib/media.ts";
import { loadCatalog } from "./lib/catalog.mjs";
import { contentDocs, KINDS } from "./lib/content.mjs";
import { cardBuilder, createEncoder, embedMissing, MODELS, pack } from "./lib/embedding.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const p = (...s) => join(ROOT, ...s);
const readJSON = (f) => JSON.parse(readFileSync(f, "utf8"));
const arg = (flag, fallback) => {
  const i = process.argv.indexOf(`--${flag}`);
  return i > 0 ? process.argv[i + 1] : fallback;
};

const name = process.argv[2];
const model = MODELS[name];
if (!model) throw new Error(`Use: node scripts/embed.mjs ${Object.keys(MODELS).join("|")}`);

let hf;
try {
  hf = await import("@huggingface/transformers");
} catch {
  console.error("Transformers.js is not installed. Run npm install --no-save @huggingface/transformers.");
  process.exit(1);
}

hf.env.cacheDir = p(".cache/models");

const catalog = loadCatalog(ROOT);
const { resources } = catalog;
const queries = [...readJSON(p("eval/queries.json")), ...(existsSync(p("eval/screens.json")) ? readJSON(p("eval/screens.json")) : [])];
const encode = await createEncoder(hf, name, { device: process.env.EMBED_DEVICE || "cpu" });
const started = Date.now();
const batch = Number(arg("batch", 16));
const queriesOnly = process.argv.includes("--queries");
const seconds = () => ((Date.now() - started) / 1000).toFixed(0);
const dir = process.env.EMBED_DIR ? p(process.env.EMBED_DIR) : p(".cache/embed", name);
mkdirSync(dir, { recursive: true });
const writeAtomic = (file, data) => {
  writeFileSync(`${file}.tmp`, JSON.stringify(data));
  renameSync(`${file}.tmp`, file);
};

if (name === "gemma2") {
  const kinds = arg("kinds", KINDS.join(",")).split(",");
  const [part, parts] = arg("part", "0/1").split("/").map(Number);
  const docs = contentDocs(catalog, readJSON(p("data/dist/showcase.json")), { rev: MEDIA_VERSION }).filter((d, i) => kinds.includes(d.kind) && i % parts === part);
  const file = join(dir, "vectors.json");
  const cache = existsSync(file) ? readJSON(file).vectors : {};
  const save = () => writeAtomic(file, { model: model.id, dtype: model.dtype, imageTokens: model.imageTokens, vectors: cache });
  let saved = Date.now();
  if (!queriesOnly) {
    const { embedded, failed } = await embedMissing({
      encode, name, docs, cache, batch,
      source: (d) => p(`public${d.image}`),
      onBatch: ({ done, of, failed: f }) => {
        if (Date.now() - saved < 60000 && done < of) return;
        save();
        saved = Date.now();
        console.log(`${name}: ${done}/${of} documents, ${f} failed, ${seconds()} s`);
      },
    });
    save();
    if (failed.length) writeFileSync(join(dir, "failed.json"), JSON.stringify(failed, null, 1));
    console.log(`${name}: embedded ${embedded} of ${docs.length} documents (${kinds.join(", ")}), ${failed.length} failed.`);
  }
} else if (!queriesOnly) {
  const card = cardBuilder(catalog.taxonomy);
  const docVectors = [];
  for (let i = 0; i < resources.length; i += batch) {
    docVectors.push(...(await encode(resources.slice(i, i + batch).map((r) => model.doc(r.name, card(r))))));
    if ((i / batch) % 10 === 0) console.log(`${name}: ${Math.min(i + batch, resources.length)}/${resources.length} documents, ${seconds()} s`);
  }
  writeAtomic(join(dir, "docs.json"), { model: model.id, dtype: model.dtype, dims: docVectors[0].length, slugs: resources.map((r) => r.slug), vectors: Buffer.from(new Float32Array(docVectors.flat()).buffer).toString("base64") });
}

const queryVectors = [];
for (let i = 0; i < queries.length; i += batch) queryVectors.push(...(await encode(queries.slice(i, i + batch).map((q) => model.query(q.query)))));
writeAtomic(join(dir, "queries.json"), { model: model.id, dims: queryVectors[0].length, texts: queries.map((q) => q.query), vectors: Buffer.concat(queryVectors.map((v) => Buffer.from(pack(v), "base64"))).toString("base64") });
console.log(`${name}: ${queries.length} queries embedded. Total ${seconds()} s. Wrote .cache/embed/${name}/`);
