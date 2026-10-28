import type { Category, Resource } from "./types";

const TIER_RANK: Record<string, number> = { S: 0, A: 1, B: 2, C: 3 };

export type RankedGroup = {
  slug: string;
  name: string;
  description: string;
  items: Resource[];
};

const isGallery = (r: Resource) => r.kinds.includes("gallery");

function byRank(a: Resource, b: Resource): number {
  return (TIER_RANK[a.tier] ?? 9) - (TIER_RANK[b.tier] ?? 9) || a.name.localeCompare(b.name);
}

export function rankedGroups(resources: Resource[], categories: Category[], categorySlug: string): RankedGroup[] {
  const category = categories.find((c) => c.slug === categorySlug);
  if (!category) return [];
  const inCategory = resources.filter((r) => r.category === categorySlug);
  const mainDomains = new Set(inCategory.filter((r) => !isGallery(r) && r.domain).map((r) => r.domain));
  const shown = inCategory.filter((r) => !(isGallery(r) && r.domain && mainDomains.has(r.domain)));
  return category.subcategories
    .map((s) => ({
      slug: s.slug,
      name: s.name,
      description: s.description,
      items: shown.filter((r) => r.subcategory === s.slug).sort(byRank),
    }))
    .filter((g) => g.items.length > 0)
    .sort((a, b) => byRank(a.items[0], b.items[0]) || b.items.length - a.items.length);
}
