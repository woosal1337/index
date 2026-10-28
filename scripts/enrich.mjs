#!/usr/bin/env node

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { fromPackage, githubRepo, htmlText, itemUrl, licenseSlug, packageNames } from "./lib/enrich.mjs";
import { vocabMatcher } from "../app/lib/vocab.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const p = (...s) => join(ROOT, ...s);
const readJSON = (f) => JSON.parse(readFileSync(f, "utf8"));
const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : fallback;
};
const STAGES = new Set(flag("only", "registry,npm,github,probe,page").split(","));
const MAX_AGE = Number(flag("max-age-days", 7)) * 864e5;
const LIMIT = Number(flag("limit", Infinity));
const UA = "IndexBot/1.0 (+https://index.chele.bi)";
const CACHE = p(".cache/enrich");
const ITEM_TYPES = new Set(["registry:ui", "registry:component", "registry:block", "registry:page", "registry:item", "registry:theme"]);

const token = process.env.GITHUB_TOKEN
  || spawnSync("gh", ["auth", "token"], { encoding: "utf8" }).stdout?.trim()
  || "";

const records = readdirSync(p("data/entries"))
  .filter((f) => /^(links|gap|canon|user)-.*\.json$/.test(f))
  .sort()
  .flatMap((f) => readJSON(p("data/entries", f)))
  .slice(0, LIMIT);
const byId = new Map(records.map((r) => [r.id, r]));
const featuresPath = p("data/features/fixed.json");
const features = existsSync(featuresPath) ? readJSON(featuresPath) : {};
const feature = (id) => (features[id] ||= {});

const sha = (s) => createHash("sha1").update(s).digest("hex");
const counts = { network: 0, notModified: 0, cached: 0, failed: 0 };

async function get(stage, url, { headers = {}, transform = (body) => body, json = false } = {}) {
  const dir = join(CACHE, stage);
  const file = join(dir, `${sha(url).slice(0, 20)}.json`);
  const old = existsSync(file) ? readJSON(file) : null;
  const save = (entry) => {
    mkdirSync(dir, { recursive: true });
    writeFileSync(file, JSON.stringify(entry));
    return entry;
  };
  if (old && Date.now() - Date.parse(old.fetchedAt) < MAX_AGE) {
    counts.cached++;
    return old;
  }
  const h = { "user-agent": UA, ...headers };
  if (old?.etag) h["if-none-match"] = old.etag;
  else if (old?.lastModified) h["if-modified-since"] = old.lastModified;
  const fetchedAt = new Date().toISOString();
  let res;
  try {
    res = await fetch(url, { headers: h, redirect: "follow", signal: AbortSignal.timeout(25000) });
  } catch (e) {
    counts.failed++;
    return save({ url, status: 0, error: String(e.cause?.code || e.message).slice(0, 120), fetchedAt, data: null });
  }
  if (res.status === 304 && old) {
    counts.notModified++;
    return save({ ...old, fetchedAt });
  }
  counts.network++;
  const text = res.ok ? await res.text() : "";
  let data = null;
  if (res.ok) {
    try {
      data = transform(json ? JSON.parse(text) : text, res);
    } catch {
      data = null;
    }
  }
  return save({
    url,
    finalUrl: res.url,
    status: res.status,
    type: res.headers.get("content-type") || "",
    etag: res.headers.get("etag"),
    lastModified: res.headers.get("last-modified"),
    hash: sha(text),
    fetchedAt,
    data,
  });
}

async function pool(list, size, fn) {
  let next = 0;
  await Promise.all(Array.from({ length: size }, async () => {
    while (next < list.length) {
      const item = list[next++];
      await fn(item);
    }
  }));
}

const checked = (entry) => entry.fetchedAt.slice(0, 10);

async function registryStage() {
  const taxonomy = {
    components: readJSON(p("taxonomy/components.json")).groups.flatMap((g) => g.components),
    surfaces: readJSON(p("taxonomy/surfaces.json")).groups.flatMap((g) => g.surfaces),
  };
  const match = vocabMatcher(taxonomy.components, taxonomy.surfaces);
  const claimed = new Set();
  const ordered = [...records].sort((a, b) => Number(Boolean(a.same_as)) - Number(Boolean(b.same_as)));
  const jobs = ordered.filter((r) => {
    const url = r.registry_url;
    if (!url || !/\.json(\?.*)?$/.test(url) || url.includes("{") || claimed.has(url)) return false;
    claimed.add(url);
    return true;
  });
  const misses = {};
  mkdirSync(p("data/items"), { recursive: true });
  await pool(jobs, 6, async (r) => {
    const index = await get("registry", r.registry_url, {
      json: true,
      transform: (j) => (Array.isArray(j) ? j : j.items || []).map((it) => ({
        name: it.name,
        type: it.type,
        title: it.title || null,
        description: it.description || null,
        dependencies: it.dependencies || [],
      })),
    });
    const items = (index.data || []).filter((it) => it.name && ITEM_TYPES.has(it.type));
    if (!items.length) return;
    const samples = items.filter((it) => it.type !== "registry:theme").slice(0, 2);
    const probes = await Promise.all(samples.map((it) => get("registry-item", itemUrl(r.registry_url, it.name), {
      json: true,
      transform: (j) => ({ ok: Boolean(j && (j.files?.some((f) => f.content) || j.cssVars)) }),
    })));
    const verified = probes.length > 0 && probes.every((e) => e.data?.ok);
    const out = items
      .map((it) => {
        const isIcon = r.category === "icons-logos" || /\bicons?\b/i.test(`${it.title || ""} ${it.description || ""}`);
        const { component, surface } = isIcon ? { component: "icon", surface: null } : match(it.name, it.title);
        if (!component && !surface) {
          const key = it.name.replace(/[-_]?\d+$/, "");
          misses[key] = (misses[key] || 0) + 1;
        }
        return {
          name: it.name,
          type: it.type.replace("registry:", ""),
          title: it.title,
          description: it.description,
          component,
          surface,
          dependencies: it.dependencies,
          url: verified ? itemUrl(r.registry_url, it.name) : null,
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
    writeFileSync(p("data/items", `${r.slug}.json`), `${JSON.stringify({ resource_id: r.id, registry_url: r.registry_url, install_verified: verified, checked: checked(index), items: out }, null, 1)}\n`);
    feature(r.id).registry = { url: r.registry_url, items: out.length, installVerified: verified, checked: checked(index) };
  });
  const candidates = Object.entries(misses).filter(([, n]) => n >= 3).sort((a, b) => b[1] - a[1]);
  writeFileSync(join(CACHE, "alias-candidates.json"), JSON.stringify(candidates, null, 1));
  console.log(`registry: ${jobs.length} registries, ${candidates.length} unmatched names seen 3+ times`);
}

async function npmStage() {
  const jobs = records.map((r) => [r, packageNames(r)]).filter(([, names]) => names.length);
  await pool(jobs, 8, async ([r, names]) => {
    const out = [];
    for (const name of names.slice(0, 3)) {
      const doc = await get("npm", `https://registry.npmjs.org/${name.replace("/", "%2F")}`, { json: true, transform: fromPackage });
      if (!doc.data) continue;
      const dl = await get("npm-downloads", `https://api.npmjs.org/downloads/point/last-week/${name}`, { json: true, transform: (j) => j.downloads ?? null });
      out.push({ package: name, ...doc.data, weeklyDownloads: dl.data, checked: checked(doc) });
    }
    if (out.length) feature(r.id).npm = out;
  });
  console.log(`npm: ${jobs.length} records with a package name`);
}

async function githubStage() {
  const headers = { accept: "application/vnd.github+json", ...(token ? { authorization: `Bearer ${token}` } : {}) };
  const jobs = records.map((r) => [r, githubRepo(r.repo_url) || githubRepo(r.url)]).filter(([, repo]) => repo);
  await pool(jobs, 4, async ([r, repo]) => {
    const meta = await get("github", `https://api.github.com/repos/${repo}`, {
      headers,
      json: true,
      transform: (j) => ({
        repo: j.full_name,
        stars: j.stargazers_count,
        license: j.license?.spdx_id ?? null,
        licenseSlug: licenseSlug(j.license?.spdx_id),
        pushedAt: j.pushed_at?.slice(0, 10) ?? null,
        archived: Boolean(j.archived),
        topics: j.topics || [],
        homepage: j.homepage || null,
      }),
    });
    if (!meta.data) {
      feature(r.id).github = { repo, status: meta.status, checked: checked(meta) };
      return;
    }
    await get("github-readme", `https://api.github.com/repos/${repo}/readme`, {
      headers: { ...headers, accept: "application/vnd.github.raw" },
      transform: (text) => text.slice(0, 40000),
    });
    feature(r.id).github = { ...meta.data, checked: checked(meta) };
  });
  console.log(`github: ${jobs.length} records with a repository${token ? "" : " (no token, 60 requests per hour)"}`);
}

async function probeStage() {
  const origins = new Map();
  for (const r of records) {
    try {
      const o = new URL(r.url).origin;
      if (!origins.has(o)) origins.set(o, []);
      origins.get(o).push(r);
    } catch {
      continue;
    }
  }
  await pool([...origins], 8, async ([origin, rs]) => {
    const llms = await get("probe", `${origin}/llms.txt`, {
      transform: (text, res) => (/text\/(plain|markdown)/.test(res.headers.get("content-type") || "") && !/^\s*</.test(text) ? { bytes: text.length } : null),
    });
    const sitemap = await get("probe", `${origin}/sitemap.xml`, {
      transform: (text) => (/<(urlset|sitemapindex)\b/.test(text) ? { urls: (text.match(/<loc>/g) || []).length } : null),
    });
    const found = [];
    if (llms.data) found.push({ kind: "llms-txt", url: `${origin}/llms.txt`, method: "probe", checked: checked(llms) });
    if (sitemap.data) found.push({ kind: "sitemap", url: `${origin}/sitemap.xml`, urls: sitemap.data.urls, method: "probe", checked: checked(sitemap) });
    for (const r of rs) {
      if (found.length) feature(r.id).machineUrls = found;
      else delete feature(r.id).machineUrls;
    }
  });
  console.log(`probe: ${origins.size} origins`);
}

async function pageStage() {
  let chromium = null;
  try {
    ({ chromium } = await import("playwright"));
  } catch {
    console.log("page: Playwright is not installed, so pages that need JavaScript keep a thin text. Run npm install --no-save playwright.");
  }
  const thin = [];
  await pool(records, 8, async (r) => {
    const page = await get("page", r.url, {
      transform: (html) => {
        const t = htmlText(html);
        return { ...t, text: t.text.slice(0, 30000), rendered: false };
      },
    });
    if (page.data && page.data.text.length < 400) thin.push([r, page]);
    feature(r.id).page = {
      status: page.status,
      finalUrl: page.finalUrl && page.finalUrl.replace(/\/$/, "") !== r.url.replace(/\/$/, "") ? page.finalUrl : undefined,
      title: page.data?.title || undefined,
      description: page.data?.description || undefined,
      textChars: page.data?.text.length ?? 0,
      checked: checked(page),
    };
  });
  if (chromium && thin.length) {
    const browser = await chromium.launch();
    await pool(thin, 3, async ([r, page]) => {
      const file = join(CACHE, "page", `${sha(r.url).slice(0, 20)}.json`);
      const tab = await browser.newPage({ userAgent: UA });
      try {
        await tab.goto(r.url, { waitUntil: "networkidle", timeout: 30000 });
        const text = (await tab.innerText("body")).replace(/\s+/g, " ").trim().slice(0, 30000);
        page.data = { ...page.data, text, rendered: true };
        writeFileSync(file, JSON.stringify(page));
        Object.assign(feature(r.id).page, { textChars: text.length, rendered: true });
      } catch {
        Object.assign(feature(r.id).page, { rendered: false });
      } finally {
        await tab.close();
      }
    });
    await browser.close();
  }
  console.log(`page: ${records.length} pages, ${thin.length} needed JavaScript`);
}

function derive() {
  const conflicts = [];
  for (const r of records) {
    const f = features[r.id];
    if (!f) continue;
    const npm = f.npm || [];
    const derived = {};
    const framework = [...new Set(npm.flatMap((x) => x.framework))];
    if (framework.length) derived.framework = { value: framework, method: "npm", checked: npm[0].checked };
    const styling = [...new Set(npm.flatMap((x) => x.styling))];
    if (styling.length) derived.styling = { value: styling, method: "npm", checked: npm[0].checked };
    const builtOn = [...new Set(npm.flatMap((x) => x.builtOn))];
    if (builtOn.length) derived.builtOn = { value: builtOn, method: "npm", checked: npm[0].checked };
    const lic = npm.find((x) => x.licenseSlug);
    if (lic) derived.license = { value: [lic.licenseSlug], method: "npm", checked: lic.checked };
    else if (f.github?.licenseSlug) derived.license = { value: [f.github.licenseSlug], method: "github", checked: f.github.checked };
    if (Object.keys(derived).length) f.derived = derived;
    else delete f.derived;
    for (const facet of ["framework", "license"]) {
      const d = derived[facet];
      const v = r.facets?.[facet];
      const have = (Array.isArray(v) ? v : v ? [v] : []).filter((x) => x !== "unknown" && x !== "not-applicable");
      if (d && have.length && !d.value.some((x) => have.includes(x))) conflicts.push({ id: r.id, slug: r.slug, facet, entry: have, fixed: d.value, method: d.method });
    }
  }
  writeFileSync(join(CACHE, "conflicts.json"), JSON.stringify(conflicts, null, 1));
  const by = conflicts.reduce((m, c) => ({ ...m, [c.facet]: (m[c.facet] || 0) + 1 }), {});
  console.log(`derive: ${conflicts.length} conflicts with entry facets ${JSON.stringify(by)} written to .cache/enrich/conflicts.json`);
}

mkdirSync(CACHE, { recursive: true });
for (const [stage, run] of [["registry", registryStage], ["npm", npmStage], ["github", githubStage], ["probe", probeStage], ["page", pageStage]]) {
  if (STAGES.has(stage)) await run();
}
derive();

const sorted = Object.fromEntries(Object.keys(features).filter((id) => byId.has(id) || LIMIT !== Infinity).sort().map((id) => [id, features[id]]));
mkdirSync(p("data/features"), { recursive: true });
writeFileSync(featuresPath, `${JSON.stringify(sorted, null, 1)}\n`);
console.log(`Wrote data/features/fixed.json for ${Object.keys(sorted).length} records. Requests: ${JSON.stringify(counts)}`);
