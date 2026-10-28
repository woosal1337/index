#!/usr/bin/env node

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { findAll, vocabMap } from "../app/lib/vocab.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const p = (...s) => join(ROOT, ...s);
const readJSON = (f) => JSON.parse(readFileSync(f, "utf8"));
const [command, ...rest] = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = rest.indexOf(`--${name}`);
  return i >= 0 ? rest[i + 1] : fallback;
};
const DIR = p(".cache/extract");
const sha = (s) => createHash("sha1").update(s).digest("hex").slice(0, 20);
const schema = readJSON(p("scripts/lib/extract-schema.json"));
const components = readJSON(p("taxonomy/components.json")).groups.flatMap((g) => g.components);
const surfaces = readJSON(p("taxonomy/surfaces.json")).groups.flatMap((g) => g.surfaces);
const facetList = readJSON(p("taxonomy/facets.json")).facets;
const facetValues = new Map(facetList.map((f) => [f.slug, new Set(f.values.map((v) => v.slug))]));
const notApplicable = (category) => schema.facets.filter((k) => facetList.find((f) => f.slug === k)?.not_applicable_in?.includes(category));
const groupOf = (category) => Object.entries(schema.profile_groups).find(([, g]) => g.categories.includes(category))?.[0];

const records = readdirSync(p("data/entries"))
  .filter((f) => /^(links|gap|canon|user)-.*\.json$/.test(f))
  .flatMap((f) => readJSON(p("data/entries", f)));
const bySlug = new Map(records.map((r) => [r.slug, r]));

function cached(stage, url) {
  const f = p(".cache/enrich", stage, `${sha(url)}.json`);
  return existsSync(f) ? readJSON(f).data : null;
}

function bundle(r, fixed, itemsBy) {
  const f = fixed[r.id] || {};
  const npm = (f.npm || []).map((n) => `npm package ${n.package} ${n.version ?? ""}, license ${n.license ?? "none stated"}, frameworks from dependencies: ${n.framework.join(", ") || "none"}, styling from dependencies: ${n.styling.join(", ") || "none"}, built on: ${n.builtOn.join(", ") || "none"}, last release ${n.lastRelease ?? "unknown"}, weekly downloads ${n.weeklyDownloads ?? "unknown"}${n.deprecated ? ", deprecated" : ""}`);
  const gh = f.github?.repo ? [`GitHub repository ${f.github.repo}, license ${f.github.license ?? "none stated"}, stars ${f.github.stars}, last push ${f.github.pushedAt}, ${f.github.archived ? "archived" : "not archived"}, topics: ${(f.github.topics || []).join(", ") || "none"}`] : [];
  const reg = f.registry ? [`shadcn registry ${f.registry.url} with ${f.registry.items} items, install ${f.registry.installVerified ? "verified" : "not verified"}`] : [];
  const items = itemsBy.get(r.slug) || [];
  const readme = f.github?.repo ? cached("github-readme", `https://api.github.com/repos/${f.github.repo.toLowerCase()}/readme`) : null;
  const sources = {
    record: [r.name, r.tagline, r.description, r.agent_guidance, r.why_it_matters, (r.notable_for || []).join("; "), r.pricing_detail, r.install].filter(Boolean).join("\n"),
    facts: [...npm, ...gh, ...reg].join("\n"),
    items: [...new Set(items.map((i) => (i.title && i.title !== i.name ? `${i.name} (${i.title})` : i.name)))].slice(0, 300).join(", "),
    page: (cached("page", r.url)?.text || "").slice(0, 9000),
    readme: typeof readme === "string" ? readme.replace(/!\[[^\]]*\]\([^)]*\)/g, "").replace(/<img[^>]*>/g, "").slice(0, 9000) : "",
  };
  const all = Object.values(sources).join("\n");
  const count = (map) => {
    const n = new Map();
    for (const h of findAll(map, all)) n.set(h.slug, (n.get(h.slug) || 0) + 1);
    return n;
  };
  const compCount = count(vocabMap(components));
  for (const c of [...(r.components || []), ...items.map((i) => i.component).filter(Boolean)]) compCount.set(c, (compCount.get(c) || 0) + 5);
  const surfCount = count(vocabMap(surfaces, (s) => [String(s.name).replace(/\(.*?\)/g, "")]));
  for (const s of [...(r.surfaces || []), ...items.map((i) => i.surface).filter(Boolean)]) surfCount.set(s, (surfCount.get(s) || 0) + 5);
  const top = (m, vocab, n) => [...m].sort((a, b) => b[1] - a[1]).slice(0, n).map(([s]) => `${s} (${vocab.find((v) => v.slug === s)?.name ?? s})`);
  return {
    id: r.id,
    slug: r.slug,
    name: r.name,
    url: r.url,
    category: r.category,
    subcategory: r.subcategory,
    kinds: r.kinds,
    profile_group: groupOf(r.category),
    not_applicable: notApplicable(r.category),
    current: {
      components: r.components || [],
      surfaces: r.surfaces || [],
      facets: Object.fromEntries(schema.facets.map((k) => [k, r.facets?.[k] ?? "unknown"])),
      install: r.install || null,
      package: r.package || null,
    },
    shortlists: { components: top(compCount, components, 50), surfaces: top(surfCount, surfaces, 25) },
    sources,
  };
}

function sample(n, seed) {
  let s = seed;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const pool = records.filter((r) => !r.same_as);
  const byCat = {};
  for (const r of pool) (byCat[r.category] ||= []).push(r);
  const cats = Object.keys(byCat).sort();
  const quota = Object.fromEntries(cats.map((c) => [c, 2]));
  let left = n - 2 * cats.length;
  const share = cats.map((c) => [c, byCat[c].length / pool.length]).sort((a, b) => b[1] - a[1]);
  for (let i = 0; left > 0; i = (i + 1) % share.length) {
    const [c, w] = share[i];
    const add = Math.max(1, Math.round(w * (n - 2 * cats.length)));
    const take = Math.min(add, left);
    quota[c] += take;
    left -= take;
  }
  return cats.flatMap((c) => {
    const list = [...byCat[c]].sort((a, b) => a.slug.localeCompare(b.slug));
    const out = [];
    while (out.length < Math.min(quota[c], list.length)) out.push(list.splice(Math.floor(rnd() * list.length), 1)[0]);
    return out;
  });
}

const normalize = (s) => String(s ?? "").toLowerCase().replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, "-").replace(/\s+/g, " ").trim();
const words = (s) => String(s || "").trim().split(/\s+/).filter(Boolean).length;

function check(b, o) {
  const problems = [];
  const sourceText = Object.fromEntries(Object.entries(b.sources).map(([k, v]) => [k, normalize(v)]));
  const quoted = { ok: 0, total: 0 };
  const evidence = (where, e) => {
    quoted.total++;
    if (!e || typeof e.quote !== "string" || !schema.sources.includes(e.source)) return problems.push(`${where}: needs a quote and a source from ${schema.sources.join(", ")}`);
    if (e.quote.trim().length < schema.limits.quote_min_chars) return problems.push(`${where}: quote "${e.quote}" is shorter than ${schema.limits.quote_min_chars} characters`);
    if (!sourceText[e.source].includes(normalize(e.quote))) return problems.push(`${where}: quote "${e.quote.slice(0, 80)}" is not in ${e.source}`);
    quoted.ok++;
  };
  if (o.id !== b.id || o.slug !== b.slug) problems.push("id or slug does not match the bundle");
  if (typeof o.summary !== "string" || !o.summary || words(o.summary) > schema.limits.summary_words) problems.push(`summary: write 1 to ${schema.limits.summary_words} words`);
  if (!Array.isArray(o.aliases) || o.aliases.length > schema.limits.aliases) problems.push(`aliases: give a list of at most ${schema.limits.aliases}`);
  const squash = (v) => String(v ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
  for (const [i, a] of (o.aliases || []).entries()) {
    evidence(`aliases[${i}]`, a);
    const v = String(a?.value ?? "");
    if (v && a.quote && !normalize(a.quote).includes(normalize(v))) problems.push(`aliases[${i}]: the quote must contain "${v}"`);
    if (squash(v) === squash(b.name)) problems.push(`aliases[${i}]: "${v}" only restates the record name`);
    if (/:\/\/|^www\./i.test(v) || (!/[\s/]/.test(v) && /\.(mjs|jsx|tsx?|css|json|md|html?|zip|png|svg)$/i.test(v)) || (!/[\s/@]/.test(v) && (/^(www|api|docs|app|cdn)\./i.test(v) || (v.match(/\./g) || []).length >= 2))) problems.push(`aliases[${i}]: "${v}" looks like a file name, URL, or hostname`);
    if (words(v) > 6) problems.push(`aliases[${i}]: "${v}" is a phrase, not a name`);
  }
  const compSlugs = new Set(components.map((c) => c.slug));
  const surfSlugs = new Set(surfaces.map((s) => s.slug));
  for (const [key, vocab] of [["components", compSlugs], ["surfaces", surfSlugs]]) {
    if (!Array.isArray(o[key])) { problems.push(`${key}: give a list`); continue; }
    for (const [i, c] of o[key].entries()) {
      if (!vocab.has(c?.slug)) problems.push(`${key}[${i}]: "${c?.slug}" is not a ${key.slice(0, -1)} slug`);
      evidence(`${key}[${i}] ${c?.slug}`, c);
    }
  }
  for (const k of schema.facets) {
    const f = o.facets?.[k];
    if (b.not_applicable.includes(k)) {
      if (f !== "not-applicable") problems.push(`facets.${k}: this category requires "not-applicable"`);
      continue;
    }
    if (f === "unknown") continue;
    if (f === "not-applicable") {
      if (!facetValues.get(k).has("not-applicable")) problems.push(`facets.${k}: "not-applicable" is not a value of this facet`);
      continue;
    }
    if (!Array.isArray(f) || !f.length) { problems.push(`facets.${k}: give a list of { value, quote, source }, "unknown", or "not-applicable"`); continue; }
    const seen = new Set();
    for (const [i, e] of f.entries()) {
      if (!facetValues.get(k).has(e?.value) || ["unknown", "not-applicable"].includes(e?.value)) problems.push(`facets.${k}[${i}]: "${e?.value}" is not a value in taxonomy/facets.json`);
      if (seen.has(e?.value)) problems.push(`facets.${k}[${i}]: "${e?.value}" is listed twice`);
      seen.add(e?.value);
      evidence(`facets.${k}[${i}] ${e?.value}`, e);
    }
  }
  for (const [i, x] of (o.built_on || []).entries()) {
    if (!schema.built_on.includes(x?.value)) problems.push(`built_on[${i}]: "${x?.value}" is not in the schema`);
    evidence(`built_on[${i}]`, x);
  }
  if (!schema.scope.includes(o.scope)) problems.push(`scope: use ${schema.scope.join(" | ")}`);
  const group = schema.profile_groups[b.profile_group];
  for (const [field, value] of Object.entries(o.profile || {})) {
    const spec = group?.fields[field];
    if (!spec) { problems.push(`profile.${field}: not a field of ${b.profile_group}`); continue; }
    const fine = spec.multi ? Array.isArray(value) && value.every((v) => spec.values.includes(v))
      : spec.type === "boolean" ? typeof value === "boolean"
      : spec.type === "integer" ? Number.isInteger(value)
      : spec.type === "words" ? Array.isArray(value) && value.every((v) => typeof v === "string")
      : typeof value === "string";
    if (!fine) problems.push(`profile.${field}: ${JSON.stringify(value)} does not fit ${spec.multi ? `values ${spec.values.join(", ")}` : spec.type}`);
    const ev = (o.profile_evidence || []).filter((e) => e.field === field);
    if (!ev.length) problems.push(`profile.${field}: add a profile_evidence entry`);
    for (const e of ev) evidence(`profile_evidence ${field}`, e);
  }
  const [uMin, uMax] = schema.limits.use_cases;
  const [nMin, nMax] = schema.limits.not_for;
  const [qMin, qMax] = schema.limits.queries;
  if (!Array.isArray(o.use_cases) || o.use_cases.length < uMin || o.use_cases.length > uMax) problems.push(`use_cases: give ${uMin} to ${uMax}`);
  if (!Array.isArray(o.not_for) || o.not_for.length < nMin || o.not_for.length > nMax) problems.push(`not_for: give ${nMin} to ${nMax}`);
  if (!Array.isArray(o.queries) || o.queries.length < qMin || o.queries.length > qMax) problems.push(`queries: give ${qMin} to ${qMax}`);
  for (const q of o.queries || []) if (words(q) > schema.limits.query_words) problems.push(`queries: "${q}" is longer than ${schema.limits.query_words} words`);
  return { problems, quoted };
}

if (command === "bundle") {
  const fixed = readJSON(p("data/features/fixed.json"));
  const items = existsSync(p("data/dist/items.json")) ? readJSON(p("data/dist/items.json")) : [];
  const itemsBy = new Map();
  for (const it of items) itemsBy.set(it.resource, [...(itemsBy.get(it.resource) || []), it]);
  const chosen = rest.includes("--all") ? records : flag("slugs") ? flag("slugs").split(",").map((s) => bySlug.get(s)) : sample(Number(flag("sample", 50)), Number(flag("seed", 7)));
  mkdirSync(join(DIR, "bundles"), { recursive: true });
  mkdirSync(join(DIR, "out"), { recursive: true });
  for (const r of chosen) writeFileSync(join(DIR, "bundles", `${r.slug}.json`), JSON.stringify(bundle(r, fixed, itemsBy), null, 1));
  const name = flag("name", "pilot");
  writeFileSync(join(DIR, `${name}.json`), JSON.stringify(chosen.map((r) => r.slug), null, 1));
  const cats = chosen.reduce((m, r) => ({ ...m, [r.category]: (m[r.category] || 0) + 1 }), {});
  console.log(`Wrote ${chosen.length} bundles and .cache/extract/${name}.json`, cats);
} else if (command === "check") {
  const slugs = rest.filter((s) => !s.startsWith("--"));
  const list = slugs.length ? slugs : readdirSync(join(DIR, "out")).map((f) => f.replace(/\.json$/, ""));
  let failed = 0;
  const total = { ok: 0, total: 0 };
  for (const slug of list) {
    const outFile = join(DIR, "out", `${slug}.json`);
    const bundleFile = join(DIR, "bundles", `${slug}.json`);
    if (!existsSync(bundleFile)) { console.log(`${slug}: no bundle`); failed++; continue; }
    if (!existsSync(outFile)) { console.log(`${slug}: no output file`); failed++; continue; }
    let o;
    try { o = readJSON(outFile); } catch (e) { console.log(`${slug}: invalid JSON (${e.message})`); failed++; continue; }
    const { problems, quoted } = check(readJSON(bundleFile), o);
    total.ok += quoted.ok;
    total.total += quoted.total;
    if (problems.length) {
      failed++;
      console.log(`${slug}: ${problems.length} problems`);
      for (const x of problems) console.log(`  - ${x}`);
    } else console.log(`${slug}: ok`);
  }
  console.log(`\n${list.length - failed} of ${list.length} records pass. ${total.ok} of ${total.total} quotes found in their source.`);
  process.exitCode = failed ? 1 : 0;
} else if (command === "merge") {
  const outPath = p("data/features/model.json");
  const merged = existsSync(outPath) ? readJSON(outPath) : {};
  const conflicts = [];
  let added = 0;
  for (const slug of readdirSync(join(DIR, "out")).map((f) => f.replace(/\.json$/, ""))) {
    const bundleFile = join(DIR, "bundles", `${slug}.json`);
    if (!existsSync(bundleFile)) continue;
    const b = readJSON(bundleFile);
    const o = readJSON(join(DIR, "out", `${slug}.json`));
    if (check(b, o).problems.length) continue;
    const fields = { ...o };
    delete fields.id;
    delete fields.slug;
    merged[o.id] = { ...fields, model: flag("model", "claude-sonnet-5-5"), checked: new Date().toISOString().slice(0, 10) };
    added++;
    merged[o.id].facets = Object.fromEntries(schema.facets.map((k) => [k, Array.isArray(o.facets[k]) ? o.facets[k].map((e) => e.value) : o.facets[k]]));
    merged[o.id].facet_evidence = Object.fromEntries(schema.facets.filter((k) => Array.isArray(o.facets[k])).map((k) => [k, o.facets[k]]));
    for (const k of schema.facets) {
      const have = [].concat(b.current.facets[k]).filter((v) => v !== "unknown" && v !== "not-applicable");
      const got = Array.isArray(o.facets[k]) ? o.facets[k].map((e) => e.value) : [];
      if (have.length && got.length && [...have].sort().join() !== [...got].sort().join()) conflicts.push({ slug, facet: k, current: have, extracted: o.facets[k] });
    }
  }
  writeFileSync(outPath, `${JSON.stringify(Object.fromEntries(Object.entries(merged).sort(([a], [b]) => a.localeCompare(b))), null, 1)}\n`);
  writeFileSync(join(DIR, "conflicts.json"), JSON.stringify(conflicts, null, 1));
  console.log(`Merged ${added} records into data/features/model.json (${Object.keys(merged).length} in total). ${conflicts.length} facet conflicts in .cache/extract/conflicts.json`);
} else if (command === "review") {
  const name = flag("name", "pilot");
  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const row = (slug, key, value, quote, source) => `<tr data-key="${esc(`${slug}|${key}`)}"><td>${esc(key)}</td><td><b>${esc(value)}</b>${quote ? `<div class="q">“${esc(quote)}” <i>${esc(source)}</i></div>` : ""}</td><td class="v"><button data-v="ok">right</button><button data-v="wrong">wrong</button></td></tr>`;
  const sections = readJSON(join(DIR, `${name}.json`)).filter((s) => existsSync(join(DIR, "out", `${s}.json`))).map((slug) => {
    const o = readJSON(join(DIR, "out", `${slug}.json`));
    const b = readJSON(join(DIR, "bundles", `${slug}.json`));
    const rows = [
      row(slug, "summary", o.summary),
      ...o.aliases.map((a) => row(slug, `alias ${a.value}`, a.value, a.quote, a.source)),
      ...o.components.map((c) => row(slug, `component ${c.slug}`, c.slug, c.quote, c.source)),
      ...o.surfaces.map((c) => row(slug, `surface ${c.slug}`, c.slug, c.quote, c.source)),
      ...schema.facets.flatMap((k) => (Array.isArray(o.facets[k]) ? o.facets[k].map((e) => row(slug, `${k} ${e.value}`, e.value, e.quote, e.source)) : [row(slug, `facet ${k}`, o.facets[k])])),
      ...(o.built_on || []).map((x) => row(slug, `built on ${x.value}`, x.value, x.quote, x.source)),
      row(slug, "scope", o.scope),
      ...Object.entries(o.profile || {}).map(([k, v]) => {
        const e = (o.profile_evidence || []).find((x) => x.field === k);
        return row(slug, `profile ${k}`, [].concat(v).join(", "), e?.quote, e?.source);
      }),
      row(slug, "use cases", o.use_cases.join(" · ")),
      row(slug, "queries", o.queries.join(" · ")),
    ];
    return `<section><h2><a href="${esc(b.url)}" target="_blank">${esc(b.name)}</a> <small>${esc(b.category)} · ${esc(slug)}</small></h2>${o.notes ? `<p class="n">${esc(o.notes)}</p>` : ""}<table>${rows.join("")}</table></section>`;
  });
  const html = `<!doctype html><meta charset="utf-8"><title>Extraction review</title><style>
body{font:14px/1.45 system-ui;margin:24px auto;max-width:980px;padding:0 16px;color:#111;background:#fff}
section{border-top:1px solid #ddd;padding:12px 0}h2{font-size:16px;margin:4px 0}small{color:#777;font-weight:400}
table{width:100%;border-collapse:collapse}td{border-bottom:1px solid #eee;padding:5px;vertical-align:top}td:first-child{width:150px;color:#555}
.q{color:#666;font-size:12px}.n{color:#a60}.v{width:120px;white-space:nowrap}button{border:1px solid #bbb;background:#fafafa;border-radius:4px;margin-right:4px;cursor:pointer}
tr.ok button[data-v=ok]{background:#cfc}tr.wrong button[data-v=wrong]{background:#fcc}#bar{position:sticky;top:0;background:#fff;padding:8px 0;border-bottom:1px solid #ddd}
</style><div id="bar"><b>Extraction review</b> · mark a value only when it is wrong; unmarked counts as right · <span id="c"></span> <button id="copy">Copy results</button></div>${sections.join("")}<script>
const KEY="index-review-${esc(name)}";let s={};try{s=JSON.parse(localStorage.getItem(KEY)||"{}")}catch{}
const paint=()=>{for(const tr of document.querySelectorAll("tr[data-key]")){tr.className=s[tr.dataset.key]||""}document.getElementById("c").textContent=Object.values(s).filter(v=>v==="wrong").length+" marked wrong"};
document.addEventListener("click",e=>{const b=e.target.closest("button[data-v]");if(!b)return;const k=b.closest("tr").dataset.key;s[k]=s[k]===b.dataset.v?undefined:b.dataset.v;try{localStorage.setItem(KEY,JSON.stringify(s))}catch{}paint()});
document.getElementById("copy").onclick=()=>navigator.clipboard.writeText(JSON.stringify(s));paint();
</script>`;
  writeFileSync(join(DIR, `review-${name}.html`), html);
  console.log(`Wrote .cache/extract/review-${name}.html for ${sections.length} records`);
} else {
  console.log("Use: node scripts/extract.mjs bundle [--sample 50 --seed 7 | --slugs a,b] [--name pilot]\n     node scripts/extract.mjs check [slug ...]\n     node scripts/extract.mjs review [--name pilot]");
}
