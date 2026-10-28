#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const p = (...s) => join(ROOT, ...s);
const readJSON = (f) => JSON.parse(readFileSync(f, "utf8"));
const [command, ...rest] = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = rest.indexOf(`--${name}`);
  return i >= 0 ? rest[i + 1] : fallback;
};
const DIR = p(".cache/visual");
const PASSES = ["1", "2", "3"];
const vocab = readJSON(p("taxonomy/styles.json"));
const surfaces = readJSON(p("taxonomy/surfaces.json")).groups.flatMap((g) => g.surfaces.map((s) => s.slug));
const allowed = {
  page_type: new Set([...surfaces, ...vocab.page_types.extra]),
  sections: new Set(vocab.sections),
  style: new Set(vocab.styles.map((s) => s.slug)),
  density: new Set(vocab.density.map((d) => d.slug)),
  imagery: new Set(vocab.imagery.map((i) => i.slug)),
};
const LIMITS = { sections: [0, 12], style: [1, 3], imagery: [1, 2] };
const batchFile = (n) => join(DIR, "batches", `${n}.json`);
const outFile = (pass, n) => join(DIR, "out", pass, `${n}.json`);

function items() {
  const resources = readJSON(p("data/dist/resources.json"));
  const list = [];
  for (const site of readJSON(p("data/dist/showcase.json")))
    for (const shot of site.shots) list.push({ id: `shot:${shot.id}`, image: `public${shot.local}`, kind: "site screen", context: `${site.name}, ${shot.pageUrl}` });
  const seen = new Set();
  for (const r of resources)
    for (const t of r.templates.filter((t) => t.shot)) {
      const id = `tpl:${basename(t.shot, ".webp")}`;
      if (seen.has(id)) continue;
      seen.add(id);
      list.push({ id, image: `public${t.shot}`, kind: "template or asset preview", context: `${r.name}: ${t.name}${t.purpose ? `, ${t.purpose}` : ""}` });
    }
  for (const r of resources.filter((r) => ["studios", "portfolios", "artists-creators"].includes(r.category) && r.hasImage))
    list.push({ id: `res:${r.slug}`, image: `public/og/${r.imageKey}.webp`, kind: "studio, portfolio, or artist site", context: `${r.name}, ${r.url}` });
  return list.filter((it) => existsSync(p(it.image)));
}

function batches() {
  const size = Number(flag("size", 150));
  const list = items();
  mkdirSync(join(DIR, "batches"), { recursive: true });
  const count = Math.ceil(list.length / size);
  for (let n = 1; n <= count; n++) writeFileSync(batchFile(n), `${JSON.stringify(list.slice((n - 1) * size, n * size), null, 1)}\n`);
  console.log(`Wrote ${count} batches of up to ${size} images (${list.length} images) to .cache/visual/batches/`);
}

function problems(pass, n) {
  const batch = readJSON(batchFile(n));
  const f = outFile(pass, n);
  if (!existsSync(f)) return [`pass ${pass} batch ${n}: no output file`];
  let out;
  try {
    out = readJSON(f);
  } catch (e) {
    return [`pass ${pass} batch ${n}: ${e.message}`];
  }
  const errs = [];
  for (const it of batch) {
    const t = out[it.id];
    if (!t) { errs.push(`${it.id}: missing`); continue; }
    if (!allowed.page_type.has(t.page_type)) errs.push(`${it.id}: page_type "${t.page_type}" is not allowed`);
    if (!allowed.density.has(t.density)) errs.push(`${it.id}: density "${t.density}" is not allowed`);
    for (const [k, [min, max]] of Object.entries(LIMITS)) {
      if (!Array.isArray(t[k]) || t[k].length < min || t[k].length > max) errs.push(`${it.id}: ${k} needs ${min} to ${max} values`);
      for (const v of t[k] || []) if (!allowed[k].has(v)) errs.push(`${it.id}: ${k} "${v}" is not allowed`);
    }
  }
  for (const id of Object.keys(out)) if (!batch.some((it) => it.id === id)) errs.push(`${id}: not in batch ${n}`);
  return errs.map((e) => `pass ${pass} batch ${n}: ${e}`);
}

function check() {
  const pass = rest[0];
  const nums = rest.slice(1).length ? rest.slice(1) : readdirSync(join(DIR, "batches")).map((f) => basename(f, ".json"));
  const errs = nums.flatMap((n) => problems(pass, n));
  console.log(errs.slice(0, 40).join("\n") || `Pass ${pass}: ${nums.length} batches pass.`);
  if (errs.length) process.exitCode = 1;
}

function merge() {
  const nums = readdirSync(join(DIR, "batches")).map((f) => basename(f, ".json"));
  const result = {};
  let incomplete = 0;
  for (const n of nums) {
    const outs = PASSES.map((pass) => (existsSync(outFile(pass, n)) && !problems(pass, n).length ? readJSON(outFile(pass, n)) : null)).filter(Boolean);
    if (outs.length < 2) { incomplete++; continue; }
    for (const it of readJSON(batchFile(n))) {
      const votes = outs.map((o) => o[it.id]);
      const tally = (k) => {
        const c = new Map();
        for (const v of votes) for (const x of [].concat(v[k])) c.set(x, (c.get(x) || 0) + 1);
        return [...c].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
      };
      const agreed = (k) => tally(k).filter(([, c]) => c >= 2).map(([v]) => v);
      const first = (k) => agreed(k)[0] ?? null;
      result[it.id] = { page_type: first("page_type"), sections: agreed("sections"), style: agreed("style"), density: first("density"), imagery: agreed("imagery"), passes: outs.length };
    }
  }
  const sorted = Object.fromEntries(Object.entries(result).sort(([a], [b]) => a.localeCompare(b)));
  writeFileSync(p("data/features/visual.json"), `${JSON.stringify(sorted, null, 1)}\n`);
  const vals = Object.values(result);
  console.log(`Merged ${vals.length} images into data/features/visual.json. ${incomplete} batches have fewer than two valid passes.`);
  console.log(`With a page type: ${vals.filter((v) => v.page_type).length}. With a style: ${vals.filter((v) => v.style.length).length}. With imagery: ${vals.filter((v) => v.imagery.length).length}.`);
}

const UA = "IndexBot/1.0 (+https://index.chele.bi)";
const rgb = (c) => (c?.match(/[\d.]+/g) || []).map(Number);
const hex = (c) => {
  const [r, g, b, a = 1] = rgb(c);
  return r === undefined || a === 0 ? null : `#${[r, g, b].map((x) => Math.round(x).toString(16).padStart(2, "0")).join("")}`;
};
const luminance = (c) => {
  const [r, g, b] = rgb(c);
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
};
const family = (f) => f?.split(",")[0].replace(/["']/g, "").trim() || null;
const radius = (r, h) => {
  const px = parseFloat(r);
  if (Number.isNaN(px)) return null;
  if (px >= 999 || (h && px >= h / 2 - 1)) return "pill";
  return px === 0 ? "square" : px <= 4 ? "small" : px <= 12 ? "medium" : "large";
};

function readStyles() {
  const visible = (el) => {
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && r.top < innerHeight * 2;
  };
  const pick = (sel) => [...document.querySelectorAll(sel)].find(visible) || null;
  const bgOf = (el) => {
    for (let e = el; e; e = e.parentElement) {
      const c = getComputedStyle(e).backgroundColor;
      if (c && c !== "transparent" && !/rgba\(.*,\s*0\)$/.test(c)) return c;
    }
    return "rgb(255, 255, 255)";
  };
  const heading = pick("h1") || pick("h2");
  const button = pick("button, a[class*=btn], a[class*=button], [role=button], input[type=submit]");
  const paragraph = pick("p") || document.body;
  const probe = document.elementFromPoint(innerWidth / 2, Math.min(innerHeight - 1, 400)) || document.body;
  return {
    background: bgOf(probe),
    text: getComputedStyle(paragraph).color,
    headingFont: heading ? getComputedStyle(heading).fontFamily : null,
    bodyFont: getComputedStyle(paragraph).fontFamily,
    buttonBackground: button ? bgOf(button) : null,
    buttonRadius: button ? getComputedStyle(button).borderRadius : null,
    buttonHeight: button ? button.getBoundingClientRect().height : null,
  };
}

async function css() {
  const { chromium } = await import("playwright");
  const sites = [
    ...readJSON(p("data/dist/showcase.json")).map((s) => ({ id: `site:${s.slug}`, url: s.url })),
    ...readJSON(p("data/dist/resources.json")).filter((r) => ["studios", "portfolios", "artists-creators"].includes(r.category)).map((r) => ({ id: `res:${r.slug}`, url: r.url })),
  ];
  mkdirSync(join(DIR, "css"), { recursive: true });
  const cacheFile = (id) => join(DIR, "css", `${id.replace(/[^a-z0-9-]/gi, "_")}.json`);
  const todo = sites.filter((s) => !existsSync(cacheFile(s.id)));
  const browser = await chromium.launch();
  let next = 0;
  await Promise.all(Array.from({ length: 4 }, async () => {
    while (next < todo.length) {
      const site = todo[next++];
      const tab = await browser.newPage({ userAgent: UA, viewport: { width: 1440, height: 900 } });
      try {
        await tab.goto(site.url, { waitUntil: "load", timeout: 30000 });
        await tab.waitForTimeout(1500);
        writeFileSync(cacheFile(site.id), JSON.stringify({ url: site.url, ok: true, raw: await tab.evaluate(readStyles) }));
      } catch (e) {
        writeFileSync(cacheFile(site.id), JSON.stringify({ url: site.url, ok: false, error: String(e.message).slice(0, 200) }));
      } finally {
        await tab.close();
      }
    }
  }));
  await browser.close();
  const out = {};
  for (const s of sites) {
    const c = readJSON(cacheFile(s.id));
    if (!c.ok) continue;
    const { raw } = c;
    const accent = hex(raw.buttonBackground);
    out[s.id] = {
      colorMode: luminance(raw.background) < 0.4 ? "dark" : "light",
      background: hex(raw.background),
      text: hex(raw.text),
      accent: accent && accent !== hex(raw.background) ? accent : null,
      headingFont: family(raw.headingFont),
      bodyFont: family(raw.bodyFont),
      buttonRadius: radius(raw.buttonRadius, raw.buttonHeight),
    };
  }
  writeFileSync(p("data/features/visual-css.json"), `${JSON.stringify(out, null, 1)}\n`);
  const vals = Object.values(out);
  console.log(`Read the computed CSS of ${vals.length} of ${sites.length} sites into data/features/visual-css.json. Dark: ${vals.filter((v) => v.colorMode === "dark").length}.`);
}

const COMMANDS = { batches, check, merge, css };
if (!COMMANDS[command]) {
  console.error(`Use: node scripts/visual.mjs ${Object.keys(COMMANDS).join("|")}`);
  process.exit(1);
}
await COMMANDS[command]();
