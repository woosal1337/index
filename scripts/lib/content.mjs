import { cardBuilder, MODELS } from "./embedding.mjs";

export const KINDS = ["resource", "preview", "template", "item", "screen"];

export function contentDocs({ resources, items, taxonomy }, showcase, { rev = "" } = {}) {
  const doc = MODELS.gemma2.doc;
  const card = cardBuilder(taxonomy);
  const compName = new Map(taxonomy.components.map((c) => [c.slug, c.name]));
  const bySlug = new Map(resources.map((r) => [r.slug, r]));
  const docs = [];
  for (const r of resources) {
    docs.push({ id: `res:${r.slug}`, kind: "resource", parent: r.slug, label: r.name, text: doc(r.name, card(r)) });
    if (r.hasImage && r.imageKey) docs.push({ id: `og:${r.slug}`, kind: "preview", parent: r.slug, label: `${r.name} preview`, text: doc(r.name, `${r.tagline} <|image|>`), image: `/og/${r.imageKey}.webp`, rev });
    (r.templates || []).forEach((t, i) => docs.push({
      id: `tpl:${r.slug}:${i}`,
      kind: "template",
      parent: r.slug,
      label: t.name,
      url: t.url,
      text: doc(t.name, `${r.name} template. ${t.purpose || ""}`.trim() + (t.shot ? " <|image|>" : "")),
      ...(t.shot && { image: t.shot, rev }),
    }));
  }
  for (const it of items) {
    const r = bySlug.get(it.resource);
    if (!r) continue;
    const type = String(it.type || "item").replace(/^registry:/, "");
    const component = it.component ? `Component: ${compName.get(it.component) ?? it.component}.` : "";
    docs.push({ id: `item:${it.id}`, kind: "item", parent: it.resource, label: it.title || it.name, text: doc(it.title || it.name, [`${r.name} registry ${type}.`, it.description || "", component].filter(Boolean).join(" ")) });
  }
  for (const site of showcase) {
    for (const shot of site.shots) {
      if (!shot.local) continue;
      let path = "";
      try {
        path = new URL(shot.pageUrl).pathname;
      } catch {
        path = "";
      }
      docs.push({ id: `shot:${shot.id}`, kind: "screen", parent: site.slug, label: `${site.name} ${path}`.trim(), url: shot.pageUrl, text: doc(site.name, `${site.domain}${path} <|image|>`), image: shot.local, rev });
    }
  }
  return docs;
}
