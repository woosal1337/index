import { readFileSync } from "node:fs";
import { join } from "node:path";
import { getCategoryNames, getComponentVocab, getResources, getSurfaceVocab } from "./data";
import { learningTracks } from "./learning";
import { labelize } from "./text";
import { ogImageUrl } from "./media";
import type { Resource } from "./types";

type RawBoard = { a: string; n: string; t: string; x: string; u: string; d: string; l: number; b: number; i: number[]; h: string; s: string };
type RawItem = [string, number, number, number, 0];
export type RawDeck = {
  counts: { items: number; boards: number; authors: number; videos: number };
  boards: RawBoard[];
  items: RawItem[];
};

type Image = { src: string; w: number; h: number };
type Entry = { r: Resource; name?: string; topic: string; text?: string; url?: string; images: Image[] };

export const DECKS = ["browse", "components", "surfaces", "templates", "studios", "portfolios", "learn"] as const;
export type DeckName = (typeof DECKS)[number];

let dims: Record<string, [number, number]> | null = null;

function og(r: Resource): Image[] {
  dims ??= JSON.parse(readFileSync(join(process.cwd(), "data/media-manifest.json"), "utf8")) as Record<string, [number, number]>;
  const size = r.hasImage ? dims[`/og/${r.imageKey}.webp`] : undefined;
  return size ? [{ src: ogImageUrl(r.imageKey), w: size[0], h: size[1] }] : [];
}

function shots(r: Resource, keep: (pageType: string | null) => boolean = () => true): Entry[] {
  return r.templates
    .filter((t) => t.shot && t.w && t.h && keep(t.visual?.pageType ?? null))
    .map((t) => ({
      r,
      name: t.name,
      topic: [r.name, t.visual?.pageType ? labelize(t.visual.pageType) : ""].filter(Boolean).join(" · "),
      text: t.purpose ?? "",
      url: t.url,
      images: [{ src: t.shot!, w: t.w!, h: t.h! }],
    }));
}

function pack(entries: Entry[]): RawDeck {
  const boards: RawBoard[] = [];
  const items: RawItem[] = [];
  for (const e of entries) {
    if (!e.images.length) continue;
    const board = boards.length;
    const mine = e.images.map((img) => items.push([img.src, img.w, img.h, board, 0]) - 1);
    boards.push({
      a: e.r.domain,
      n: e.name ?? e.r.name,
      t: e.topic,
      x: e.text ?? e.r.tagline ?? "",
      u: e.url ?? e.r.url,
      d: "",
      l: 0,
      b: 0,
      i: mine,
      h: `/r/${e.r.slug}/`,
      s: e.r.slug,
    });
  }
  const authors = new Set(boards.map((b) => b.a)).size;
  return { counts: { items: items.length, boards: boards.length, authors, videos: 0 }, boards, items };
}

function names(groups: { [k: string]: unknown }[], key: "components" | "surfaces"): Map<string, string> {
  return new Map(groups.flatMap((g) => (g[key] as { slug: string; name: string }[]).map((v) => [v.slug, v.name] as const)));
}

export function buildDeck(name: DeckName): RawDeck {
  const resources = getResources();
  const categories = getCategoryNames();
  const inCategory = (slug: string) => resources.filter((r) => r.category === slug);

  switch (name) {
    case "browse":
      return pack(resources.map((r) => ({ r, topic: [categories[r.category], r.subcategory].filter(Boolean).join(" · "), images: og(r) })));
    case "components": {
      const label = names(getComponentVocab(), "components");
      return pack(
        resources
          .filter((r) => r.components.length)
          .map((r) => ({ r, topic: r.components.map((c) => label.get(c) ?? labelize(c)).join(", "), images: og(r) })),
      );
    }
    case "surfaces": {
      const label = names(getSurfaceVocab(), "surfaces");
      return pack([
        ...resources
          .filter((r) => r.surfaces.length)
          .map((r) => ({ r, topic: r.surfaces.map((s) => label.get(s) ?? labelize(s)).join(", "), images: og(r) })),
        ...resources.flatMap((r) => shots(r, (pageType) => pageType !== null && label.has(pageType))),
      ]);
    }
    case "templates":
      return pack(resources.flatMap((r) => shots(r)));
    case "studios":
    case "portfolios":
      return pack(inCategory(name).map((r) => ({ r, topic: [categories[r.category], r.subcategory].filter(Boolean).join(" · "), images: og(r) })));
    case "learn": {
      const bySlug = new Map(resources.map((r) => [r.slug, r]));
      const tracked = learningTracks.flatMap((t) =>
        t.items.flatMap((i) => {
          const r = bySlug.get(i.slug);
          return r ? [{ r, topic: t.title, images: og(r) }] : [];
        }),
      );
      const seen = new Set(tracked.map((e) => e.r.slug));
      const essays = inCategory("essays-guides-courses")
        .filter((r) => !seen.has(r.slug))
        .map((r) => ({ r, topic: categories[r.category] ?? "", images: og(r) }));
      return pack([...tracked, ...essays]);
    }
  }
}
