import { createHash } from "node:crypto";

const TASK = "Given a coding agent's request, retrieve the design resources that satisfy it";

export const MODELS = {
  qwen3: {
    id: "onnx-community/Qwen3-Embedding-0.6B-ONNX",
    dtype: "fp16",
    query: (q) => `Instruct: ${TASK}\nQuery:${q}`,
    doc: (title, text) => text,
    minSimilarity: 0.603,
  },
  gemma: {
    id: "onnx-community/embeddinggemma-300m-ONNX",
    dtype: "q8",
    query: (q) => `task: search result | query: ${q}`,
    doc: (title, text) => `title: ${title} | text: ${text}`,
  },
  gemma2: {
    id: "onnx-community/embeddinggemma-2-ONNX",
    dtype: "fp32",
    imageTokens: 280,
    weight: 0.05,
    minSimilarity: 0.73,
    query: (q) => `task: search result | query: ${q}`,
    doc: (title, text) => `title: ${title || "none"} | text: ${text}`,
  },
};

export async function createEncoder(hf, name, { device = "cpu" } = {}) {
  const model = MODELS[name];
  if (name === "qwen3") {
    const extract = await hf.pipeline("feature-extraction", model.id, { dtype: model.dtype });
    return async (texts) => (await extract(texts, { pooling: "last_token", normalize: true })).tolist();
  }
  if (name === "gemma2") {
    const config = await hf.AutoConfig.from_pretrained(model.id);
    config.audio_config = null;
    const processor = await hf.AutoProcessor.from_pretrained(model.id);
    processor.image_processor.max_soft_tokens = model.imageTokens;
    const net = await hf.AutoModel.from_pretrained(model.id, { config, device, dtype: { model: model.dtype, vision_encoder: model.dtype } });
    const run = async (texts, images) => (await net(await processor(texts, images))).sentence_embedding.tolist();
    return async (inputs) => {
      const out = new Array(inputs.length);
      const plain = inputs.flatMap((x, i) => (typeof x === "string" ? [[x, i]] : []));
      const media = inputs.flatMap((x, i) => (typeof x === "string" ? [] : [[x, i]]));
      if (plain.length) (await run(plain.map(([x]) => x))).forEach((v, j) => { out[plain[j][1]] = v; });
      if (media.length) {
        const images = await Promise.all(media.map(([x]) => hf.RawImage.read(x.image)));
        (await run(media.map(([x]) => x.text), images.map((im) => [im]))).forEach((v, j) => { out[media[j][1]] = v; });
      }
      return out;
    };
  }
  const tokenizer = await hf.AutoTokenizer.from_pretrained(model.id);
  const net = await hf.AutoModel.from_pretrained(model.id, { dtype: model.dtype });
  return async (texts) => {
    const { sentence_embedding } = await net(await tokenizer(texts, { padding: true, truncation: true }));
    return sentence_embedding.tolist().map((v) => {
      const n = Math.hypot(...v) || 1;
      return v.map((x) => x / n);
    });
  };
}

export function cardBuilder({ categories, components, surfaces }) {
  const label = new Map(categories.flatMap((c) => [[c.slug, c.name], ...(c.subcategories || []).map((s) => [s.slug, s.name])]));
  const compName = new Map(components.map((c) => [c.slug, c.name]));
  const surfName = new Map(surfaces.map((s) => [s.slug, s.name]));
  return (r) => {
    const parts = [
      `${label.get(r.category) ?? r.category} > ${label.get(r.subcategory) ?? r.subcategory}.`,
      `${r.name}: ${r.tagline}.`,
      r.description.slice(0, 700),
      r.components.length ? `Components: ${r.components.map((c) => compName.get(c) ?? c).join(", ")}.` : "",
      r.surfaces.length ? `Surfaces: ${r.surfaces.map((s) => surfName.get(s) ?? s).join(", ")}.` : "",
    ];
    return parts.filter(Boolean).join(" ").slice(0, 1600);
  };
}

export const docKey = (name, doc) => {
  const m = MODELS[name];
  return createHash("sha256").update([m.id, m.dtype, m.imageTokens ?? "", doc.text, doc.image ?? "", doc.rev ?? ""].join("\n")).digest("hex").slice(0, 24);
};

export const pack = (v) => Buffer.from(Float32Array.from(v).buffer).toString("base64");
export const unpack = (b64) => new Float32Array(Uint8Array.from(Buffer.from(b64, "base64")).buffer);

export async function embedMissing({ encode, name, docs, cache, source = (d) => d.image, batch = 16, onBatch = () => {} }) {
  const todo = docs.filter((d) => !cache[docKey(name, d)]);
  const order = [...todo.filter((d) => !d.image), ...todo.filter((d) => d.image)];
  const failed = [];
  const input = (d) => (d.image ? { text: d.text, image: source(d) } : d.text);
  const store = (slice, vectors) => slice.forEach((d, j) => { cache[docKey(name, d)] = pack(vectors[j]); });
  for (let n = 0; n < order.length; n += batch) {
    const slice = order.slice(n, n + batch);
    try {
      store(slice, await encode(slice.map(input)));
    } catch {
      for (const d of slice) {
        try {
          store([d], await encode([input(d)]));
        } catch (error) {
          failed.push({ id: d.id, error: String(error?.message || error).slice(0, 200) });
        }
      }
    }
    await onBatch({ done: Math.min(n + batch, order.length), of: order.length, failed: failed.length });
  }
  return { embedded: todo.length - failed.length, failed };
}
