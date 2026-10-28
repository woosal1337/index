import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as hf from "@huggingface/transformers";
import { MEDIA_VERSION } from "../app/lib/media.ts";
import { loadCatalog } from "../scripts/lib/catalog.mjs";
import { contentDocs } from "../scripts/lib/content.mjs";
import { createEncoder, docKey, embedMissing, MODELS, unpack } from "../scripts/lib/embedding.mjs";
import { createApi, createHttpHandler } from "./app.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");
const DATA = process.env.INDEX_DATA || join(ROOT, ".cache/server");
const PORT = Number(process.env.PORT || 8787);
const MAX_INFLIGHT = Number(process.env.MAX_INFLIGHT || 4);
const MEDIA_ORIGIN = process.env.MEDIA_ORIGIN || "https://index-media.chele.bi";
const NAME = "gemma2";
const MODEL = MODELS[NAME];
const { version } = JSON.parse(readFileSync(join(HERE, "package.json"), "utf8"));
const log = (event) => console.log(JSON.stringify({ at: new Date().toISOString(), ...event }));

hf.env.cacheDir = join(DATA, "models");
const catalog = loadCatalog(ROOT);
const showcase = JSON.parse(readFileSync(join(ROOT, "data/dist/showcase.json"), "utf8"));
const api = createApi({ ...catalog, showcase });

let encode = null;
let inflight = 0;
const recent = new Map();
async function embed(query) {
  if (!encode || !api.status().dense || !query) return undefined;
  const hit = recent.get(query);
  if (hit) {
    recent.delete(query);
    recent.set(query, hit);
    return hit;
  }
  if (inflight >= MAX_INFLIGHT) return undefined;
  inflight++;
  try {
    const [v] = await encode([MODEL.query(query)]);
    const vector = Float32Array.from(v);
    recent.set(query, vector);
    if (recent.size > 2000) recent.delete(recent.keys().next().value);
    return vector;
  } catch (error) {
    log({ error: `query embedding failed: ${error.message}` });
    return undefined;
  } finally {
    inflight--;
  }
}

async function warm() {
  const started = Date.now();
  encode = await createEncoder(hf, NAME);
  const docs = contentDocs(catalog, showcase, { rev: MEDIA_VERSION });
  const file = join(DATA, "vectors", `${NAME}.json`);
  const cache = existsSync(file) ? JSON.parse(readFileSync(file, "utf8")).vectors : {};
  const save = () => {
    mkdirSync(dirname(file), { recursive: true });
    const vectors = Object.fromEntries(docs.map((d) => docKey(NAME, d)).filter((k) => cache[k]).map((k) => [k, cache[k]]));
    writeFileSync(`${file}.tmp`, JSON.stringify({ model: MODEL.id, dtype: MODEL.dtype, imageTokens: MODEL.imageTokens, vectors }));
    renameSync(`${file}.tmp`, file);
  };
  let saved = Date.now();
  log({ event: "warm", documents: docs.length, cached: docs.filter((d) => cache[docKey(NAME, d)]).length });
  const { embedded, failed } = await embedMissing({
    encode, name: NAME, docs, cache,
    source: (d) => `${MEDIA_ORIGIN}${d.image}?v=${d.rev}`,
    onBatch: ({ done, of, failed: f }) => {
      if (Date.now() - saved < 60000) return;
      save();
      saved = Date.now();
      log({ event: "warm", embedded: done, of, failed: f });
    },
  });
  if (embedded) save();
  if (failed.length) log({ event: "warm", failed: failed.length, examples: failed.slice(0, 3) });
  const ready = docs.filter((d) => cache[docKey(NAME, d)]);
  const dims = unpack(cache[docKey(NAME, ready[0])]).length;
  const data = new Float32Array(ready.length * dims);
  ready.forEach((d, i) => data.set(unpack(cache[docKey(NAME, d)]), i * dims));
  api.useVectors({ docs: ready, data, dims, weight: MODEL.weight, minSimilarity: MODEL.minSimilarity });
  log({ event: "ready", mode: "hybrid", model: MODEL.id, documents: ready.length, dims, seconds: Math.round((Date.now() - started) / 1000) });
}

createServer(createHttpHandler({ api, embed, taxonomy: catalog.taxonomy, version, log })).listen(PORT, "0.0.0.0", () => {
  log({ event: "listening", port: PORT, ...api.status() });
  if (process.env.INDEX_DENSE === "off") return log({ event: "ready", mode: "keyword" });
  warm().catch((error) => log({ error: `warm-up failed, serving keyword search only: ${error.message}` }));
});
