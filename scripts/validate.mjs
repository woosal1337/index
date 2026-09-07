#!/usr/bin/env node

import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const p = (...s) => join(ROOT, ...s);
const readJSON = (f) => JSON.parse(readFileSync(f, "utf8"));
const FIX = process.argv.includes("--fix");

const cats = readJSON(p("taxonomy/categories.json"));
const facetsVocab = readJSON(p("taxonomy/facets.json"));
const compVocab = readJSON(p("taxonomy/components.json"));
const surfVocab = readJSON(p("taxonomy/surfaces.json"));

const CATEGORY = new Set(cats.categories.map((c) => c.slug));
const SUBCAT = new Map(cats.categories.map((c) => [c.slug, new Set(c.subcategories.map((s) => s.slug))]));
const KIND = new Set(cats.kinds.map((k) => k.slug));
const COMPONENT = new Set(compVocab.groups.flatMap((g) => g.components.map((c) => c.slug)));
const SURFACE = new Set(surfVocab.groups.flatMap((g) => g.surfaces.map((s) => s.slug)));
const FACET = new Map(facetsVocab.facets.map((f) => [f.slug, new Set(f.values.map((v) => v.slug))]));
const MULTI = new Map(facetsVocab.facets.map((f) => [f.slug, f.multi]));

const REQUIRED = ["id", "slug", "url", "name", "category", "subcategory", "kinds", "facets", "quality_tier"];
const TIERS = new Set(["S", "A", "B", "C"]);

const problems = {
  invalidFile: [],
  invalidShape: [],
  missingField: [],
  badCategory: [],
  badSubcategory: [],
  badKind: [],
  badComponent: [],
  badSurface: [],
  badFacetName: [],
  badFacetValue: [],
  badTier: [],
  dupSlug: [],
  dupId: [],
  thinGuidance: [],
};

const files = existsSync(p("data/entries"))
  ? readdirSync(p("data/entries"))
      .filter((f) => f.endsWith(".json") && (f.startsWith("links-") || f.startsWith("gap-") || f.startsWith("canon-") || f.startsWith("user-")))
      .sort()
  : [];

const seenIds = new Map();
if (!files.length) problems.invalidFile.push("No entry files found. Add records to data/entries.");
let total = 0;
let changed = 0;

for (const file of files) {
  const abs = p("data/entries", file);
  let rows;
  try {
    rows = readJSON(abs);
    if (!Array.isArray(rows)) throw new Error("Expected an array of records.");
  } catch (e) {
    problems.invalidFile.push(`${file}: ${e.message}`);
    continue;
  }
  let dirty = false;

  for (const r of rows) {
    total++;
    if (!r || typeof r !== "object" || Array.isArray(r)) {
      problems.invalidShape.push(`${file}: expected a record object.`);
      continue;
    }
    const invalid = ["id", "slug", "url", "name", "category", "subcategory", "quality_tier"]
      .some((key) => r[key] !== undefined && typeof r[key] !== "string")
      || ["kinds", "components", "surfaces"].some((key) =>
        r[key] !== undefined && (!Array.isArray(r[key]) || r[key].some((v) => typeof v !== "string")))
      || (r.facets !== undefined && (!r.facets || typeof r.facets !== "object" || Array.isArray(r.facets)));
    if (invalid) {
      problems.invalidShape.push(`${file}: invalid field types. Use the documented record schema.`);
      continue;
    }
    const where = `${file}:${r.id?.slice(0, 8) ?? "?"} ${r.name ?? ""}`;

    for (const f of REQUIRED) {
      const v = r[f];
      if (v === undefined || v === null || v === "" || (Array.isArray(v) && !v.length)) {
        problems.missingField.push(`${where} — ${f}`);
      }
    }

    if (r.id) {
      if (seenIds.has(r.id)) problems.dupId.push(`${where} (also ${seenIds.get(r.id)})`);
      else seenIds.set(r.id, file);
    }

    if (r.category && !CATEGORY.has(r.category)) problems.badCategory.push(`${where} — "${r.category}"`);
    if (r.category && r.subcategory && SUBCAT.has(r.category) && !SUBCAT.get(r.category).has(r.subcategory))
      problems.badSubcategory.push(`${where} — "${r.subcategory}" not in ${r.category}`);

    if (Array.isArray(r.kinds)) {
      const bad = r.kinds.filter((k) => !KIND.has(k));
      if (bad.length) {
        problems.badKind.push(`${where} — ${bad.join(", ")}`);
        if (FIX) { r.kinds = r.kinds.filter((k) => KIND.has(k)); dirty = true; }
      }
    }

    if (Array.isArray(r.components)) {
      const bad = r.components.filter((c) => !COMPONENT.has(c));
      if (bad.length) {
        problems.badComponent.push(`${where} — ${bad.slice(0, 6).join(", ")}${bad.length > 6 ? ` (+${bad.length - 6})` : ""}`);
        if (FIX) { r.components = r.components.filter((c) => COMPONENT.has(c)); dirty = true; }
      }
    }

    if (Array.isArray(r.surfaces)) {
      const bad = r.surfaces.filter((s) => !SURFACE.has(s));
      if (bad.length) {
        problems.badSurface.push(`${where} — ${bad.slice(0, 6).join(", ")}${bad.length > 6 ? ` (+${bad.length - 6})` : ""}`);
        if (FIX) { r.surfaces = r.surfaces.filter((s) => SURFACE.has(s)); dirty = true; }
      }
    }

    if (r.facets && typeof r.facets === "object") {
      for (const [fname, fval] of Object.entries(r.facets)) {
        if (!FACET.has(fname)) {
          problems.badFacetName.push(`${where} — "${fname}"`);
          if (FIX) { delete r.facets[fname]; dirty = true; }
          continue;
        }
        const legal = FACET.get(fname);
        const isMulti = MULTI.get(fname);
        let vals = Array.isArray(fval) ? fval : fval ? [fval] : [];
        const bad = vals.filter((v) => !legal.has(v));
        if (bad.length) {
          problems.badFacetValue.push(`${where} — ${fname}: ${bad.join(", ")}`);
          if (FIX) { vals = vals.filter((v) => legal.has(v)); dirty = true; }
        }
        if (FIX) {
          const next = isMulti ? vals : vals[0] ?? "unknown";
          if (JSON.stringify(next) !== JSON.stringify(fval)) { r.facets[fname] = next; dirty = true; }
        }
      }
      if (FIX) {
        for (const fname of FACET.keys()) {
          if (!(fname in r.facets)) {
            r.facets[fname] = MULTI.get(fname) ? ["unknown"] : "unknown";
            dirty = true;
          }
        }
      }
    }

    if (r.quality_tier && !TIERS.has(r.quality_tier)) problems.badTier.push(`${where} — "${r.quality_tier}"`);
    if (typeof r.agent_guidance !== "string" || r.agent_guidance.length < 60) problems.thinGuidance.push(where);
  }

  if (FIX && dirty) {
    writeFileSync(abs, JSON.stringify(rows, null, 1));
    changed++;
  }
}

const slugSeen = new Map();
for (const file of files) {
  let rows;
  try { rows = readJSON(p("data/entries", file)); } catch { continue; }
  if (!Array.isArray(rows)) continue;
  for (const r of rows) {
    if (!r?.slug) continue;
    if (slugSeen.has(r.slug) && slugSeen.get(r.slug) !== r.id)
      problems.dupSlug.push(`${r.slug} — ${file} and ${slugSeen.get(r.slug)}`);
    else slugSeen.set(r.slug, r.id);
  }
}

console.log(`\nValidated ${total} records across ${files.length} files${FIX ? ` — rewrote ${changed}` : ""}\n`);

if (!total) problems.invalidFile.push("No records found. Add records to data/entries.");
let issues = 0;
for (const [k, list] of Object.entries(problems)) {
  if (!list.length) continue;
  issues += list.length;
  console.log(`${k}: ${list.length}`);
  for (const x of list.slice(0, 12)) console.log(`   ${x}`);
  if (list.length > 12) console.log(`   … +${list.length - 12} more`);
  console.log("");
}

if (!issues) console.log("No problems found.\n");

const needTier = problems.missingField.filter((x) => x.endsWith("quality_tier"));
if (needTier.length) {
  writeFileSync(p("data/needs-tier.json"), JSON.stringify(needTier, null, 1));
  console.log(`${needTier.length} records need a quality_tier — written to data/needs-tier.json`);
}

process.exitCode = issues ? 1 : 0;
