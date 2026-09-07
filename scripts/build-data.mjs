#!/usr/bin/env node

import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const p = (...s) => join(ROOT, ...s);
const readJSON = (f) => JSON.parse(readFileSync(f, "utf8"));
const globJSON = (dir, prefix) => {
  if (!existsSync(p(dir))) return [];
  return readdirSync(p(dir))
    .filter((f) => f.startsWith(prefix) && f.endsWith(".json"))
    .sort()
    .flatMap((f) => {
      const v = readJSON(p(dir, f));
      if (!Array.isArray(v)) throw new Error(`${dir}/${f}: expected an array of records.`);
      return v;
    });
};

const out = (rel, obj) => {
  const abs = p(rel);
  const text = `${JSON.stringify(obj, null, 2)}\n`;
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, text);
  const kb = (Buffer.byteLength(text) / 1024).toFixed(0);
  console.log(`  → ${rel} (${kb} KB)`);
};

import { createHash } from "node:crypto";

const sha1_16 = (u) => createHash("sha1").update(u).digest("hex").slice(0, 16);

console.log("Loading sources…");

const imageDims = existsSync(p("data/dist/image-dims.json"))
  ? readJSON(p("data/dist/image-dims.json"))
  : {};
const withDims = (path) => {
  const d = imageDims[path];
  return d ? { w: d[0], h: d[1] } : { w: null, h: null };
};

const taxonomy = {
  categories: readJSON(p("taxonomy/categories.json")),
  facets: readJSON(p("taxonomy/facets.json")),
  components: readJSON(p("taxonomy/components.json")),
  surfaces: readJSON(p("taxonomy/surfaces.json")),
};

const rawLinks = readJSON(p("data/links.json"));
const linkById = new Map(rawLinks.map((l) => [l.id, l]));

const entries = [
  ...globJSON("data/entries", "links-"),
  ...globJSON("data/entries", "gap-"),
  ...globJSON("data/entries", "canon-"),
  ...globJSON("data/entries", "user-"),
];
const essays = globJSON("data/references", "x-articles-");
const insta = globJSON("data/references", "instagram-");

console.log(
  `  entries=${entries.length} essays=${essays.length} instagram=${insta.length}`
);

const essayById = new Map(essays.map((e) => [e.id, e]));
const instaById = new Map(insta.map((e) => [e.id, e]));

const seenSlug = new Map();
const kebab = (s) =>
  (s || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);

const uniqueSlug = (s, id, url) => {
  const base = kebab(s) || "resource";
  if (!seenSlug.has(base) || seenSlug.get(base) === id) {
    seenSlug.set(base, id);
    return base;
  }
  let host = "";
  try {
    host = new URL(url).hostname.replace(/^www\./, "");
  } catch {

  }
  const qualifier =
    host === "github.com" ? "github" : kebab(host.split(".")[0]) || "alt";
  let candidate = `${base}-${qualifier}`;
  let i = 2;
  while (seenSlug.has(candidate) && seenSlug.get(candidate) !== id) {
    candidate = `${base}-${qualifier}-${i++}`;
  }
  seenSlug.set(candidate, id);
  return candidate;
};

const dropped = [];
const claimed = new Set();
const deduped = entries.filter((e) => {
  const base = kebab(e.slug || e.name);
  if (e.source === "bookmark" || !e.source) {
    claimed.add(base);
    return true;
  }
  if (claimed.has(base)) {
    dropped.push(`${e.name} (${e.url}) [${e.source}] — duplicates an existing "${base}"`);
    return false;
  }
  claimed.add(base);
  return true;
});
if (dropped.length) {
  console.log(`  dropped ${dropped.length} promoted duplicates:`);
  for (const d of dropped) console.log(`    · ${d}`);
}

const resources = deduped.map((e) => {
  const raw = linkById.get(e.id) || {};
  const essay = essayById.get(e.id);
  const ig = instaById.get(e.id);

  const r = {
    id: e.id,
    slug: uniqueSlug(e.slug || e.name, e.id, e.url || raw.url),
    url: e.url || raw.url,

    domain: e.domain || raw.domain || safeHost(e.url),
    name: e.name || raw.title || raw.domain,
    tagline: e.tagline || "",
    description: e.description || raw.description || "",
    category: e.category,
    subcategory: e.subcategory,
    kinds: e.kinds || [],
    facets: e.facets || {},
    components: e.components || [],
    componentCount: e.component_count ?? null,
    surfaces: e.surfaces || [],
    templates: (e.templates || []).map((t) => {
      const u = (t.url || "").trim();
      if (!u.startsWith("http")) return t;
      const key = sha1_16(u);
      const shot = `/tpl/${key}.webp`;
      return existsSync(p("public/tpl", `${key}.webp`))
        ? { ...t, shot, ...withDims(shot) }
        : t;
    }),
    templateCount: e.template_count ?? null,
    install: e.install || null,
    pkg: e.package || null,
    docsUrl: e.docs_url || null,
    repoUrl: e.repo_url || null,
    registryUrl: e.registry_url || null,
    github: e.github || {},
    pricingDetail: e.pricing_detail || null,
    counts: e.counts || {},
    agentGuidance: e.agent_guidance || "",
    whyItMatters: e.why_it_matters || "",
    tier: e.quality_tier || "B",
    notableFor: e.notable_for || [],
    httpStatus: e.http_status ?? null,
    verifiedAt: e.verified_at || null,
    evidence: e.evidence || "",

    imageKey: e.id.replace(/[^A-Za-z0-9_-]/g, "_"),
    ogImage: raw.og_image || null,
    favicon: raw.favicon || null,
    savedAt: null,
    source: e.source === "depo" || e.source === "canon" ? e.source : "bookmark",
  };

  if (essay && essay.fetch_ok !== false) {
    r.article = {
      author: essay.author_handle,
      authorName: essay.author_name,
      title: essay.title,
      takeaways: essay.key_takeaways || [],
      topics: essay.design_topics || [],
      metrics: {
        likes: essay.likes || 0,
        retweets: essay.retweets || 0,
        views: essay.views || 0,
        bookmarks: essay.bookmarks || 0,
      },
      postedAt: essay.posted_at || null,
      kind: essay.kind || null,
    };
  }
  if (ig && ig.fetch_ok !== false) {
    r.instagram = {
      author: ig.author_handle,
      type: ig.post_type,
      takeaways: ig.key_takeaways || [],
      topics: ig.design_topics || [],
      metrics: { likes: ig.likes || 0, comments: ig.comments || 0 },
      postedAt: ig.posted_at || null,
    };
  }
  return r;
});

function safeHost(u) {
  try {
    return new URL(u).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

let withImage = 0;
for (const r of resources) {
  r.hasImage = existsSync(p("public/og", `${r.imageKey}.webp`));
  if (r.hasImage) withImage++;
}
console.log(`  thumbnails on disk: ${withImage}/${resources.length}`);

const showcaseRaw = existsSync(p("data/showcase/refero.json"))
  ? readJSON(p("data/showcase/refero.json"))
  : [];

const showcase = showcaseRaw.map((s) => ({
  ...s,
  shots: s.shots.map((sh) => ({
    ...sh,
    local: existsSync(p("public/shots", `${sh.id}.webp`)) ? `/shots/${sh.id}.webp` : null,
  })),
}));

const fontIndex = {};
const colorIndex = {};
for (const s of showcase) {
  for (const f of s.fonts) (fontIndex[f] ||= []).push(s.slug);
  for (const c of s.colors) {

    const n = parseInt(c.slice(1), 16);
    const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    const l = (max + min) / 510;
    let key;
    if (max - min < 24) key = l < 0.25 ? "black" : l > 0.8 ? "white" : "grey";
    else {
      const h =
        max === r ? ((g - b) / (max - min) + 6) % 6 : max === g ? (b - r) / (max - min) + 2 : (r - g) / (max - min) + 4;
      const deg = h * 60;
      key =
        deg < 20 || deg >= 340 ? "red" : deg < 45 ? "orange" : deg < 70 ? "yellow" :
        deg < 165 ? "green" : deg < 200 ? "teal" : deg < 255 ? "blue" :
        deg < 290 ? "purple" : "pink";
    }
    ((colorIndex[key] ||= new Set())).add(s.slug);
  }
}
for (const k of Object.keys(colorIndex)) colorIndex[k] = [...colorIndex[k]];
for (const k of Object.keys(fontIndex)) fontIndex[k] = [...new Set(fontIndex[k])];

console.log(
  `  showcase: ${showcase.length} sites, ${showcase.reduce((n, s) => n + s.shotCount, 0)} shots, ` +
  `${Object.keys(fontIndex).length} typefaces`
);

const byComponent = {};
const bySurface = {};
for (const r of resources) {
  for (const c of r.components) (byComponent[c] ||= []).push(r.slug);
  for (const s of r.surfaces) (bySurface[s] ||= []).push(r.slug);
}

const tierRank = { S: 0, A: 1, B: 2, C: 3 };
const bySlug = new Map(resources.map((r) => [r.slug, r]));
const rankSlugs = (slugs) =>
  slugs
    .slice()
    .sort(
      (a, b) =>
        (tierRank[bySlug.get(a)?.tier] ?? 9) - (tierRank[bySlug.get(b)?.tier] ?? 9) ||
        a.localeCompare(b)
    );
for (const k of Object.keys(byComponent)) byComponent[k] = rankSlugs(byComponent[k]);
for (const k of Object.keys(bySurface)) bySurface[k] = rankSlugs(bySurface[k]);

const facetCounts = {};
for (const r of resources) {
  for (const [f, v] of Object.entries(r.facets || {})) {
    const vals = Array.isArray(v) ? v : v ? [v] : [];
    for (const val of vals) {
      ((facetCounts[f] ||= {})[val] ||= 0);
      facetCounts[f][val]++;
    }
  }
}
const categoryCounts = {};
for (const r of resources) categoryCounts[r.category] = (categoryCounts[r.category] || 0) + 1;

const searchIndex = resources.map((r) => ({
  s: r.slug,
  n: r.name,
  t: r.tagline,
  c: r.category,
  k: r.kinds,
  tr: r.tier,
  d: r.domain,

  h: [r.slug.replace(/-/g, " "), r.name, r.tagline, r.domain, ...r.kinds, ...r.components, ...r.notableFor]
    .join(" ")
    .toLowerCase(),
}));

const stats = {
  resources: resources.length,
  fromCollection: resources.filter((r) => r.source === "bookmark").length,
  added: resources.filter((r) => r.source === "depo").length,
  canon: resources.filter((r) => r.source === "canon").length,
  templates: resources.reduce((s, r) => s + (r.templates?.length || 0), 0),
  showcaseSites: showcase.length,
  showcaseShots: showcase.reduce((n, s) => n + s.shotCount, 0),
  showcaseTypefaces: Object.keys(fontIndex).length,
  componentsTagged: Object.keys(byComponent).length,
  surfacesTagged: Object.keys(bySurface).length,
  categories: taxonomy.categories.categories.length,
  vocabComponents: taxonomy.components.groups.reduce((s, g) => s + g.components.length, 0),
  vocabSurfaces: taxonomy.surfaces.groups.reduce((s, g) => s + g.surfaces.length, 0),
  generatedAt: new Date().toISOString().slice(0, 10),
};

console.log("Writing…");
out("data/dist/resources.json", resources);

out("data/dist/indexes.json", { byComponent, bySurface, facetCounts, categoryCounts });
out("data/dist/search.json", searchIndex);
out("data/dist/stats.json", stats);
out("data/dist/showcase.json", showcase);
out("data/dist/showcase-indexes.json", { fontIndex, colorIndex });

out("public/api/resources.json", resources);
out("public/api/taxonomy.json", taxonomy);
out("public/api/indexes.json", { byComponent, bySurface, facetCounts, categoryCounts });
out("public/api/stats.json", stats);

out("public/api/search.json", searchIndex);
out("public/api/showcase.json", showcase);
out("public/api/showcase-indexes.json", { fontIndex, colorIndex });

const tierOf = (t) => resources.filter((r) => r.tier === t).length;
const topBy = (cat, n = 8) =>
  resources
    .filter((r) => r.category === cat)
    .sort((a, b) => (tierRank[a.tier] ?? 9) - (tierRank[b.tier] ?? 9))
    .slice(0, n);

const catMeta = new Map(taxonomy.categories.categories.map((c) => [c.slug, c]));

const llms = [
  `# Index`,
  ``,
  `> ${stats.resources} curated design resources,`,
  `> each visited and tagged against ${stats.vocabComponents} canonical UI components and`,
  `> ${stats.vocabSurfaces} app surfaces. Every record carries a licence, a price, an install`,
  `> command where one exists, provenance, and guidance written for a coding agent.`,
  ``,
  `Generated ${stats.generatedAt}. Quality tiers: S=${tierOf("S")} A=${tierOf("A")} B=${tierOf("B")} C=${tierOf("C")}.`,
  ``,
  `## How to use this`,
  ``,
  `Fetch JSON rather than scraping these pages:`,
  ``,
  `- /api/resources.json — every record, full detail`,
  `- /api/indexes.json — byComponent and bySurface reverse indexes, plus facet counts`,
  `- /api/taxonomy.json — the controlled vocabularies (categories, kinds, facets, components, surfaces)`,
  `- /api/stats.json — corpus counts`,
  ``,
  `To answer "which library ships a kanban", read indexes.json .byComponent["kanban-board"] —`,
  `it is a list of resource slugs ordered best-first. To answer "what helps me build a`,
  `paywall", read .bySurface.paywall. Do not guess from names.`,
  ``,
  `Before generating UI in a project, read that project's DESIGN.md and match its tokens.`,
  `Pick a resource from here only when its facets are compatible with the project's stack`,
  `(framework, styling, licence). Records with maturity "dead-link", or agent_readiness`,
  `"bot-blocked" / "js-only-shell", should not be fetched again.`,
  ``,
  `## Categories`,
  ``,
];

for (const [cat, n] of Object.entries(categoryCounts).sort((a, b) => b[1] - a[1])) {
  const m = catMeta.get(cat);
  llms.push(`### ${m?.name ?? cat} (${n})`);
  if (m?.agent_hint) llms.push(``, m.agent_hint);
  llms.push(``);
  for (const r of topBy(cat)) {
    const lic = (r.facets?.license || []).join("/") || "licence unknown";
    llms.push(`- [${r.name}](${r.url}) — ${r.tagline || r.description.slice(0, 110)} [${r.tier}, ${lic}]`);
  }
  llms.push(``);
}

const topComponents = Object.entries(byComponent)
  .sort((a, b) => b[1].length - a[1].length)
  .slice(0, 60);
llms.push(`## Most-covered components`, ``);
for (const [c, list] of topComponents) llms.push(`- ${c}: ${list.length} resources`);
llms.push(``);

mkdirSync(p("public"), { recursive: true });
writeFileSync(p("public/llms.txt"), llms.join("\n"));
console.log(`  → public/llms.txt (${(Buffer.byteLength(llms.join("\n")) / 1024).toFixed(0)} KB)`);

console.table(stats);
console.log("\nTop categories:");
for (const [c, n] of Object.entries(categoryCounts).sort((a, b) => b[1] - a[1]))
  console.log(`  ${String(n).padStart(4)}  ${c}`);
