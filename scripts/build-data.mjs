#!/usr/bin/env node

import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync } from "node:fs";
import { join, dirname, basename } from "node:path";
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
import { ABOUT, SEARCH_ORIGIN, SEARCH_RULES } from "../app/lib/agent.ts";
import { siteUrl } from "../app/lib/site.ts";

const sha1_16 = (u) => createHash("sha1").update(u).digest("hex").slice(0, 16);

console.log("Loading sources…");

const imageDims = existsSync(p("data/dist/image-dims.json"))
  ? readJSON(p("data/dist/image-dims.json"))
  : existsSync(p("data/media-manifest.json"))
    ? readJSON(p("data/media-manifest.json"))
    : {};
const hasMedia = (mediaPath) =>
  Boolean(imageDims[mediaPath]) || existsSync(p("public", mediaPath.slice(1)));
const withDims = (path) => {
  const d = imageDims[path];
  return d ? { w: d[0], h: d[1] } : { w: null, h: null };
};

const taxonomy = {
  categories: readJSON(p("taxonomy/categories.json")),
  facets: readJSON(p("taxonomy/facets.json")),
  components: readJSON(p("taxonomy/components.json")),
  surfaces: readJSON(p("taxonomy/surfaces.json")),
  styles: readJSON(p("taxonomy/styles.json")),
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
      return hasMedia(shot)
        ? { ...t, shot, ...withDims(shot) }
        : t;
    }),
    templateCount: e.template_count ?? null,
    install: e.install || null,
    pkg: e.package || null,
    docsUrl: e.docs_url || null,
    repoUrl: e.repo_url || null,
    registryUrl: e.registry_url || null,
    machineUrls: e.machine_urls || [],
    sameAs: e.same_as || null,
    partOf: e.part_of || null,
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

const slugById = new Map(resources.map((r) => [r.id, r.slug]));
for (const r of resources) {
  r.sameAs = slugById.get(r.sameAs) ?? null;
  r.partOf = slugById.get(r.partOf) ?? null;
}

const fixed = existsSync(p("data/features/fixed.json")) ? readJSON(p("data/features/fixed.json")) : {};
for (const r of resources) {
  const f = fixed[r.id] || {};
  const npm = f.npm || [];
  r.signals = {
    stars: f.github?.stars ?? r.github?.stars ?? null,
    weeklyDownloads: npm.length ? Math.max(...npm.map((x) => x.weeklyDownloads ?? 0)) : null,
    lastRelease: npm.map((x) => x.lastRelease).filter(Boolean).sort().pop() ?? null,
    pushedAt: f.github?.pushedAt ?? null,
    archived: Boolean(f.github?.archived),
    deprecated: npm.some((x) => x.deprecated),
    checked: [f.page?.checked, f.github?.checked, ...npm.map((x) => x.checked)].filter(Boolean).sort().pop() ?? null,
  };
  r.machineUrls = [...r.machineUrls];
  for (const m of f.machineUrls || []) {
    if (!r.machineUrls.some((x) => x.url === m.url)) r.machineUrls.push({ kind: m.kind, url: m.url });
  }
}

const model = existsSync(p("data/features/model.json")) ? readJSON(p("data/features/model.json")) : {};
for (const r of resources) {
  const m = model[r.id];
  Object.assign(r, { summary: null, aliases: [], useCases: [], notFor: [], exampleQueries: [], profile: {}, scope: null, builtOn: [] });
  if (!m) continue;
  Object.assign(r, {
    summary: m.summary,
    aliases: m.aliases.map((a) => a.value),
    useCases: m.use_cases,
    notFor: m.not_for,
    exampleQueries: m.queries,
    profile: m.profile || {},
    scope: m.scope,
    builtOn: (m.built_on || []).map((x) => x.value),
    components: [...new Set([...r.components, ...m.components.map((c) => c.slug)])],
    surfaces: [...new Set([...r.surfaces, ...m.surfaces.map((x) => x.slug)])],
  });
  for (const [k, v] of Object.entries(m.facets)) {
    const current = [].concat(r.facets[k] ?? []);
    if (v !== "unknown" && current.every((x) => x === "unknown")) r.facets = { ...r.facets, [k]: [].concat(v) };
  }
}

const visualTags = existsSync(p("data/features/visual.json")) ? readJSON(p("data/features/visual.json")) : {};
const visualCss = existsSync(p("data/features/visual-css.json")) ? readJSON(p("data/features/visual-css.json")) : {};
const look = (id) => {
  const v = visualTags[id];
  return v ? { pageType: v.page_type, sections: v.sections, style: v.style, density: v.density, imagery: v.imagery } : null;
};
for (const r of resources) {
  const tags = look(`res:${r.slug}`);
  const css = visualCss[`res:${r.slug}`];
  r.visual = tags || css ? { ...tags, ...css } : null;
  r.templates = r.templates.map((t) => (t.shot && look(`tpl:${basename(t.shot, ".webp")}`) ? { ...t, visual: look(`tpl:${basename(t.shot, ".webp")}`) } : t));
}

const items = (existsSync(p("data/items")) ? readdirSync(p("data/items")).filter((f) => f.endsWith(".json")).sort() : [])
  .flatMap((f) => {
    const file = readJSON(p("data/items", f));
    const resource = slugById.get(file.resource_id);
    if (!resource) return [];
    return file.items.map((it) => ({
      id: `${resource}/${it.name}`,
      resource,
      name: it.name,
      type: it.type,
      title: it.title,
      description: it.description,
      component: it.component,
      surface: it.surface,
      dependencies: it.dependencies,
      install: it.url ? `npx shadcn@latest add ${it.url}` : null,
      url: it.url,
    }));
  });
console.log(`  registry items: ${items.length} (${items.filter((i) => i.install).length} with an install command)`);

function safeHost(u) {
  try {
    return new URL(u).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

let withImage = 0;
for (const r of resources) {
  r.hasImage = hasMedia(`/og/${r.imageKey}.webp`);
  if (r.hasImage) withImage++;
}
console.log(`  thumbnails available: ${withImage}/${resources.length}`);

const showcaseRaw = existsSync(p("data/showcase/refero.json"))
  ? readJSON(p("data/showcase/refero.json"))
  : [];

const showcase = showcaseRaw.map((s) => ({
  ...s,
  css: visualCss[`site:${s.slug}`] ?? null,
  shots: s.shots.map((sh) => ({
    ...sh,
    local: hasMedia(`/shots/${sh.id}.webp`) ? `/shots/${sh.id}.webp` : null,
    visual: look(`shot:${sh.id}`),
  })),
}));

const styleIndex = {};
const pageTypeIndex = {};
const modeIndex = {};
for (const s of showcase) {
  for (const sh of s.shots) {
    for (const st of sh.visual?.style || []) (styleIndex[st] ||= []).push(sh.id);
    if (sh.visual?.pageType) (pageTypeIndex[sh.visual.pageType] ||= []).push(sh.id);
  }
  if (s.css?.colorMode) (modeIndex[s.css.colorMode] ||= []).push(s.slug);
}

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
  items: items.length,
  itemsInstallable: items.filter((i) => i.install).length,
  generatedAt: new Date().toISOString().slice(0, 10),
};

console.log("Writing…");
out("data/dist/resources.json", resources);

out("data/dist/indexes.json", { byComponent, bySurface, facetCounts, categoryCounts });
out("data/dist/search.json", searchIndex);
out("data/dist/stats.json", stats);
out("data/dist/showcase.json", showcase);
out("data/dist/showcase-indexes.json", { fontIndex, colorIndex, styleIndex, pageTypeIndex, modeIndex });

out("public/api/resources.json", resources);
out("public/api/taxonomy.json", taxonomy);
out("public/api/indexes.json", { byComponent, bySurface, facetCounts, categoryCounts });
out("public/api/stats.json", stats);

out("public/api/search.json", searchIndex);
out("public/api/showcase.json", showcase);
out("public/api/showcase-indexes.json", { fontIndex, colorIndex, styleIndex, pageTypeIndex, modeIndex });
out("data/dist/items.json", items);
out("public/api/items.json", items);

const known = (v) => (Array.isArray(v) ? v : v ? [v] : []).filter((x) => x !== "unknown" && x !== "not-applicable");
const itemsByResource = new Map();
const itemsByComponent = new Map();
for (const i of items) {
  if (!i.install) continue;
  itemsByResource.set(i.resource, [...(itemsByResource.get(i.resource) || []), i]);
  if (i.component) itemsByComponent.set(i.component, [...(itemsByComponent.get(i.component) || []), i]);
}
const writeAll = (dir, files) => {
  mkdirSync(p(dir), { recursive: true });
  for (const [name, body] of files) writeFileSync(p(dir, name), typeof body === "string" ? body : JSON.stringify(body));
  console.log(`  → ${dir}/ (${files.length} files)`);
};
writeAll("public/api/r", resources.map((r) => {
  const its = itemsByResource.get(r.slug) || [];
  return [`${r.slug}.json`, { ...r, templates: (r.templates || []).slice(0, 100), page: siteUrl(`/r/${r.slug}`), itemCount: its.length, items: its.slice(0, 300).map((i) => ({ name: i.name, title: i.title, component: i.component, install: i.install })) }];
}));
writeAll("public/api/components", taxonomy.components.groups.flatMap((g) => g.components).map((c) => {
  const its = itemsByComponent.get(c.slug) || [];
  const list = byComponent[c.slug] || [];
  return [`${c.slug}.json`, {
    slug: c.slug,
    name: c.name,
    aliases: c.aliases || [],
    states: c.states || [],
    ariaPattern: c.aria_pattern || null,
    checklist: c.checklist || [],
    checklistSource: c.checklist_source || null,
    resourceCount: list.length,
    resources: list.slice(0, 25).map((slug) => bySlug.get(slug)).map((r) => ({
      id: r.slug, name: r.name, page: siteUrl(`/r/${r.slug}`), tier: r.tier, summary: r.summary || r.tagline,
      framework: known(r.facets?.framework), license: known(r.facets?.license), install: r.install || null,
    })),
    itemCount: its.length,
    items: its.slice(0, 40).map((i) => ({ resource: i.resource, name: i.title || i.name, install: i.install })),
  }];
}));

const ruleList = SEARCH_RULES.map((r, i) => `${i + 1}. ${r}`);
const skill = [
  `---`,
  `name: index`,
  `description: Find design resources for the current project in Index, a reviewed catalog of component libraries, shadcn registries, templates, fonts, icons, motion, and inspiration, with install commands and licenses. Use it when the user asks for a UI component, a library, a template, a font, an icon set, or design references.`,
  `---`,
  ``,
  `# Index`,
  ``,
  ABOUT,
  ``,
  `## Connect`,
  ``,
  `- MCP server: ${SEARCH_ORIGIN}/mcp (Streamable HTTP, no key). Tools: search, fetch, component_guide.`,
  `- Without MCP: GET ${SEARCH_ORIGIN}/search?q=date+range+picker&framework=react returns the same JSON as the search tool.`,
  `- Static files: ${siteUrl("/").replace(/\/$/, "")}/api/r/<id>.json for one record, and /api/components/<component>.json for one component.`,
  ``,
  `## Search rules`,
  ``,
  ...ruleList,
  ``,
  `## Read the results`,
  ``,
  `- match is strong, weak, or none. With none, say that Index has nothing that fits. Do not force a pick.`,
  `- why lists what each result matched: a component, a filter value, a style, or similar meaning.`,
  `- install is the command to run. items lists single registry items with their own install command.`,
  `- Filters are hard limits. When nothing passes, the search drops one and lists it in relaxed.`,
  ``,
].join("\n");
writeAll("public/api/skill", [["SKILL.md", skill]]);

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
  `Search through the MCP server or its JSON endpoint rather than reading the large files:`,
  ``,
  `- MCP: ${SEARCH_ORIGIN}/mcp (Streamable HTTP, no key). Tools: search, fetch, component_guide.`,
  `- HTTP: ${SEARCH_ORIGIN}/search?q=date+range+picker&framework=react`,
  `- One record: /api/r/<id>.json, with its registry items and install commands`,
  `- One component: /api/components/<component>.json, with its checklist, states, ARIA pattern, and best implementations`,
  `- Agent skill: /api/skill/SKILL.md`,
  ``,
  ...ruleList,
  ``,
  `Full data, too large for one context window:`,
  ``,
  `- /api/resources.json — every record, full detail`,
  `- /api/items.json — every single shadcn registry item with its install command`,
  `- /api/indexes.json — byComponent and bySurface reverse indexes, plus facet counts`,
  `- /api/taxonomy.json — the controlled vocabularies (categories, kinds, facets, components, surfaces, styles)`,
  `- /api/stats.json — corpus counts`,
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
