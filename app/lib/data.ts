import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import type { Category, Indexes, Resource, Stats } from "./types";

const ROOT = process.cwd();

const cache = new Map<string, unknown>();

function load<T>(rel: string, fallback: T): T {
  if (cache.has(rel)) return cache.get(rel) as T;
  const f = join(ROOT, rel);
  let value: T = fallback;
  if (existsSync(f)) {
    try {
      value = JSON.parse(readFileSync(f, "utf8")) as T;
    } catch {
      value = fallback;
    }
  }
  cache.set(rel, value);
  return value;
}

export const getResources = (): Resource[] => load<Resource[]>("data/dist/resources.json", []);
export const getIndexes = (): Indexes =>
  load<Indexes>("data/dist/indexes.json", {
    byComponent: {},
    bySurface: {},
    facetCounts: {},
    categoryCounts: {},
  });
export const getStats = (): Stats =>
  load<Stats>("data/dist/stats.json", {
    resources: 0, fromCollection: 0, added: 0, canon: 0, templates: 0,
    componentsTagged: 0, surfacesTagged: 0, categories: 0,
    vocabComponents: 0, vocabSurfaces: 0, generatedAt: "",
  });

export const getCategories = (): Category[] =>
  load<{ categories: Category[] }>("taxonomy/categories.json", { categories: [] }).categories;

export const getKinds = () =>
  load<{ kinds: { slug: string; name: string; definition: string }[] }>(
    "taxonomy/categories.json",
    { kinds: [] }
  ).kinds;

export const getComponentVocab = () =>
  load<{ groups: { slug: string; name: string; components: { slug: string; name: string; aliases: string[]; checklist?: string[]; checklist_source?: string }[] }[] }>(
    "taxonomy/components.json",
    { groups: [] }
  ).groups;

export const getSurfaceVocab = () =>
  load<{ groups: { slug: string; name: string; surfaces: { slug: string; name: string; description: string; checklist: string[] }[] }[] }>(
    "taxonomy/surfaces.json",
    { groups: [] }
  ).groups;

export const getFacetVocab = () =>
  load<{ facets: { slug: string; name: string; multi: boolean; description: string; values: { slug: string; name: string }[] }[] }>(
    "taxonomy/facets.json",
    { facets: [] }
  ).facets;

export { labelize, tierLabel } from "./text";

export const getFacetNames = (): Record<string, Record<string, string>> => {
  const out: Record<string, Record<string, string>> = {};
  for (const f of getFacetVocab()) {
    out[f.slug] = {};
    for (const v of f.values) out[f.slug][v.slug] = v.name.replace(/\s*\(.*\)\s*$/, "");
  }
  return out;
};

export const getFacetLabels = (): Record<string, string> =>
  Object.fromEntries(getFacetVocab().map((f) => [f.slug, f.name]));

export const getNavCounts = (): Record<string, number> => {
  const s = getStats();
  const resources = getResources();
  return {
    resources: s.resources,
    categories: s.categories,
    components: s.componentsTagged,
    surfaces: s.vocabSurfaces,
    templates: s.templates,
    depo: resources.filter((r) => r.source === "depo").length,
  };
};
