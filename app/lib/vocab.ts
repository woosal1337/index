export const normalize = (s: unknown) => String(s ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

const STOP = new Set(["demo", "example", "examples", "preview", "block", "blocks", "variant", "default", "basic", "simple", "custom", "new", "with", "and", "the", "a", "ui", "v1", "v2", "v3"]);

const MAX_GRAM = 8;

export type Vocab = Map<string, string>;
export type VocabEntry = { slug: string; name?: string; aliases?: string[] };

export function vocabMap(entries: VocabEntry[], extra: (e: VocabEntry) => string[] = () => []): Vocab {
  const map: Vocab = new Map();
  for (const e of entries) {
    for (const a of [e.slug, e.name, ...(e.aliases || []), ...extra(e)]) {
      const k = normalize(a);
      if (k && !map.has(k)) map.set(k, e.slug);
    }
  }
  return map;
}

export function findAll(map: Vocab, text: string, stop: Set<string> = STOP): { slug: string; start: number; end: number; text: string }[] {
  const words = normalize(text).split(" ").filter((w) => w && !/^\d+$/.test(w));
  const used = new Array(words.length).fill(false);
  const found: { slug: string; start: number; end: number; text: string }[] = [];
  for (let n = Math.min(words.length, MAX_GRAM); n > 0; n--) {
    for (let i = 0; i + n <= words.length; i++) {
      if (used.slice(i, i + n).some(Boolean)) continue;
      if (n === 1 && stop.has(words[i])) continue;
      const k = words.slice(i, i + n).join(" ");
      const slug = map.get(k) ?? map.get(k.replace(/s$/, ""));
      if (!slug) continue;
      found.push({ slug, start: i, end: i + n, text: k });
      for (let j = i; j < i + n; j++) used[j] = true;
    }
  }
  return found;
}

export function vocabMatcher(components: VocabEntry[], surfaces: VocabEntry[]) {
  const comp = vocabMap(components);
  const surf = vocabMap(surfaces, (s) => [String(s.name || "").replace(/\(.*?\)/g, "")]);
  const first = (map: Vocab, text: string | null | undefined) => findAll(map, text || "")[0]?.slug ?? null;
  return (name: string, title?: string | null) => ({
    component: first(comp, name) ?? first(comp, title),
    surface: first(surf, name) ?? first(surf, title),
  });
}
