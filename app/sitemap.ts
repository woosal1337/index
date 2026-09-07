import type { MetadataRoute } from "next";
import { getCategories, getIndexes, getResources, getSurfaceVocab } from "./lib/data";
import { siteUrl } from "./lib/site";

export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const url = (path: string, priority = 0.6): MetadataRoute.Sitemap[number] => ({
    url: siteUrl(path),
    lastModified: now,
    priority,
  });

  const { byComponent } = getIndexes();

  return [
    url("/", 1),
    url("/categories", 0.8),
    url("/components", 0.8),
    url("/surfaces", 0.8),
    url("/templates", 0.8),
    url("/agents", 0.9),
    ...getCategories().map((c) => url(`/categories/${c.slug}`, 0.7)),
    ...getResources().map((r) => url(`/r/${r.slug}`, 0.6)),
    ...Object.keys(byComponent).map((c) => url(`/components/${c}`, 0.5)),
    ...getSurfaceVocab().flatMap((g) => g.surfaces).map((s) => url(`/surfaces/${s.slug}`, 0.5)),
  ];
}
