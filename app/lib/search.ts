export type SearchItem = {
  s: string;
  n: string;
  t: string;
  c: string;
  tr: string;
  d: string;
  h: string;
};

export const FILTER_FACETS = ["framework", "styling", "license", "pricing", "platform"] as const;
export type Filters = Partial<Record<(typeof FILTER_FACETS)[number], string[]>> & {
  category?: string;
  component?: string;
  surface?: string;
};
type FacetVocab = { slug: string; values: { slug: string; accepts?: string[] }[] }[];
export type Accepts = Map<string, Map<string, Set<string>>>;

export function acceptsMap(facets: FacetVocab): Accepts {
  return new Map(facets.map((f) => [f.slug, new Map(f.values.map((v) => [v.slug, new Set(v.accepts ?? [v.slug])]))]));
}

export function checkFilters(
  r: { category: string; facets: Record<string, string[] | string> },
  filters: Filters,
  accepts: Accepts,
): "met" | "unverified" | "violated" {
  if (filters.category && r.category !== filters.category) return "violated";
  let unverified = false;
  for (const f of FILTER_FACETS) {
    const want = filters[f];
    if (!want?.length) continue;
    const raw = r.facets?.[f];
    const have = Array.isArray(raw) ? raw : raw ? [raw] : [];
    if (have.includes("not-applicable")) continue;
    const known = have.filter((v) => v !== "unknown");
    if (!known.length) { unverified = true; continue; }
    const ok = want.some((w) => known.some((v) => accepts.get(f)?.get(w)?.has(v) ?? v === w));
    if (!ok) return "violated";
  }
  return unverified ? "unverified" : "met";
}

export function rankPalette(list: SearchItem[], query: string, limit = 20): SearchItem[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return list.slice(0, 12);
  const words = needle.split(/\s+/).filter(Boolean);
  const scored: { it: SearchItem; s: number }[] = [];
  for (const it of list) {
    const n = it.n.toLowerCase();
    let s = -1;
    if (n === needle) s = 1000;
    else if (n.startsWith(needle)) s = 500;
    else if (n.includes(needle)) s = 300;
    else if (it.d.includes(needle)) s = 200;
    else if ((it.t || "").toLowerCase().includes(needle)) s = 100;
    else if (it.c.includes(needle)) s = 60;
    else if ((it.h || "").includes(needle)) s = 40;
    else if (words.length > 1 && words.every((w) => (it.h || "").includes(w))) s = 20;
    if (s >= 0) scored.push({ it, s });
  }
  return scored.sort((a, b) => b.s - a.s).slice(0, limit).map((x) => x.it);
}
