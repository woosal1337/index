import type { Resource, Tier } from "./types";

export type Row = {
  slug: string;
  name: string;
  tagline: string;
  category: string;
  tier: Tier;
  domain: string;
  source: Resource["source"];
  savedAt: string | null;
  componentCount: number | null;
  kinds: string[];
  components: string[];
  facets: Record<string, string[]>;

  img: string | null;

  hay: string;
};

export const ROW_FACETS = ["license", "pricing", "framework", "distribution", "agent_readiness"] as const;

export function toRow(r: Resource): Row {
  const facets: Record<string, string[]> = {};
  for (const f of ROW_FACETS) {
    const v = r.facets?.[f];
    const vals = Array.isArray(v) ? v : v ? [v] : [];
    if (vals.length) facets[f] = vals;
  }
  return {
    slug: r.slug,
    name: r.name,
    tagline: r.tagline || r.description || "",
    category: r.category,
    tier: r.tier,
    domain: r.domain,
    source: r.source,
    savedAt: r.verifiedAt ? r.verifiedAt.slice(0, 10) : null,
    componentCount: r.componentCount,
    img: r.hasImage ? `/og/${r.imageKey}.webp` : null,
    kinds: r.kinds,
    components: r.components,
    facets,
    hay: [...r.notableFor, r.subcategory].join(" ").toLowerCase(),
  };
}

export type PreviewSource = {
  img?: string | null;
  hasImage?: boolean;
  imageKey?: string;
  components?: string[];
  componentCount?: number | null;
  facets?: Record<string, string[] | string>;
};

export type RowLite = Pick<Row, "slug" | "name" | "tagline" | "category" | "tier"> & PreviewSource;

const PREVIEW_FACETS = ["framework", "styling", "license", "pricing"] as const;

const EMPTY_FACET = new Set(["not-applicable", "unknown", "none"]);

const PREVIEW_TAGS = 6;

export type Preview = {

  img: string | null;

  tags: string[];

  more: number;

  facts: string[];
};

export function previewOf(r: RowLite): Preview | null {
  const img = r.img ?? (r.hasImage && r.imageKey ? `/og/${r.imageKey}.webp` : null);
  const components = r.components ?? [];
  const tags = components.slice(0, PREVIEW_TAGS);
  const total = r.componentCount ?? components.length;
  const facts: string[] = [];
  for (const key of PREVIEW_FACETS) {
    const raw = r.facets?.[key];
    const first = Array.isArray(raw) ? raw[0] : raw;
    if (first && !EMPTY_FACET.has(first)) facts.push(first);
  }
  if (!img && !tags.length && !facts.length) return null;
  return { img, tags, more: Math.max(0, total - tags.length), facts };
}

export const TIER_ORDER: Record<string, number> = { S: 0, A: 1, B: 2, C: 3 };

export function byTierThenName<T extends { tier: string; name: string }>(a: T, b: T): number {
  return (TIER_ORDER[a.tier] ?? 9) - (TIER_ORDER[b.tier] ?? 9) || a.name.localeCompare(b.name);
}
