import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createEngine } from "../app/lib/engine.ts";

const read = (f) => JSON.parse(readFileSync(f, "utf8"));
const categories = read("taxonomy/categories.json");
const taxonomy = {
  facets: read("taxonomy/facets.json").facets,
  components: read("taxonomy/components.json").groups.flatMap((g) => g.components),
  surfaces: read("taxonomy/surfaces.json").groups.flatMap((g) => g.surfaces),
  kinds: categories.kinds,
  styles: read("taxonomy/styles.json").styles,
  categories: categories.categories,
};

const base = {
  description: "", agentGuidance: "", subcategory: "react-component-libraries", category: "component-libraries",
  kinds: ["component-library"], components: [], surfaces: [], notableFor: [], pkg: null, repoUrl: null,
  domain: "example.com", tier: "B", templates: [], sameAs: null,
};
const resource = (slug, extra) => ({ ...base, slug, name: slug.replace(/-/g, " "), tagline: "", facets: {}, ...extra });
const resources = [
  resource("toastkit", { tagline: "Notifications for React", components: ["toast"], facets: { framework: ["react"], styling: ["tailwind-v4"] } }),
  resource("toastkit-github", { tagline: "Source for toastkit", components: ["toast"], facets: { framework: ["react"] }, sameAs: "toastkit" }),
  resource("vue-toasts", { tagline: "Toast messages for Vue", components: ["toast"], facets: { framework: ["vue"], styling: ["vanilla-css"] } }),
  resource("calendar-ui", { tagline: "Scheduling widgets", facets: { framework: ["react"] } }),
  resource("shadcn-registry-index", { name: "Registry Index", tagline: "A directory of shadcn registries", kinds: ["registry", "directory"] }),
  resource("pricing-gallery", { tagline: "Real pricing pages from SaaS products", category: "inspiration-galleries", subcategory: "site-galleries", kinds: ["gallery"], surfaces: ["pricing-website"] }),
  resource("pricing-blocks", { tagline: "Pricing page blocks", kinds: ["block-collection"], surfaces: ["pricing-website"], tier: "A" }),
];
const items = [{ resource: "calendar-ui", name: "date-range-picker", title: "Date range picker", component: "date-range-picker", surface: null }];
const engine = createEngine({ resources, items, taxonomy });
const slugs = (q, f) => engine.search(q, f).hits.map((h) => h.slug);

test("a component alias finds libraries tagged with that component", () => {
  assert.deepEqual(slugs("snackbar").slice(0, 2).sort(), ["toastkit", "vue-toasts"]);
});

test("registry items count as components of their library", () => {
  assert.equal(slugs("date range picker")[0], "calendar-ui");
});

test("hard filters drop incompatible records and relax when nothing passes", () => {
  assert.deepEqual(slugs("toast", { framework: ["next"] }), ["toastkit"]);
  const angular = engine.search("toast", { framework: ["angular"] });
  assert.deepEqual(angular.relaxed, ["framework"]);
  assert.ok(angular.hits.length > 0);
});

test("a negated facet value ranks matching records lower", () => {
  assert.equal(slugs("toast messages no tailwind")[0], "vue-toasts");
});

test("twins collapse into one result", () => {
  assert.equal(slugs("toastkit").filter((s) => s.startsWith("toastkit")).length, 1);
});

test("a typo still finds the record", () => {
  assert.equal(slugs("shadcn registy")[0], "shadcn-registry-index");
});

test("a query with no matching words abstains", () => {
  const out = engine.search("postgres connection pooler");
  assert.equal(out.abstained, true);
  assert.deepEqual(out.hits, []);
});

test("a similar-to query leaves out the reference and ranks its relatives", () => {
  const out = engine.search("like toastkit but for vue");
  assert.equal(out.parsed.reference, "toastkit");
  assert.equal(out.hits[0].slug, "vue-toasts");
  assert.ok(!out.hits.some((h) => h.slug.startsWith("toastkit")));
});

test("a page type without code words ranks galleries first", () => {
  assert.equal(engine.search("pricing pages").parsed.intent, "inspire");
  assert.equal(slugs("pricing pages")[0], "pricing-gallery");
  assert.equal(slugs("pricing page blocks tailwind")[0], "pricing-blocks");
});

test("query vectors add records that share no words and keep the abstain rule", () => {
  const vectors = { slugs: resources.map((r) => r.slug), dims: 2, data: Float32Array.from(resources.flatMap((r) => (r.slug === "calendar-ui" ? [1, 0] : [0, 1]))) };
  const hybrid = createEngine({ resources, items, taxonomy, vectors });
  const out = hybrid.search("snackbar", {}, { queryVector: [1, 0] });
  assert.ok(out.hits.some((h) => h.slug === "calendar-ui" && h.why.includes("meaning match")));
  assert.equal(out.similarity, 1);
  assert.equal(hybrid.search("postgres connection pooler", {}, { queryVector: [1, 0] }).hits.length, 0);
});

test("a weak word match with a low vector similarity abstains unless the query names a record", () => {
  const vectors = { slugs: resources.map((r) => r.slug), dims: 2, data: Float32Array.from(resources.flatMap(() => [0, 1])) };
  const hybrid = createEngine({ resources, items, taxonomy, vectors });
  assert.equal(engine.search("toast postgres").abstained, false);
  assert.equal(hybrid.search("toast postgres", {}, { queryVector: [1, 0] }).abstained, true);
  assert.equal(hybrid.search("like toastkit but for vue", {}, { queryVector: [1, 0] }).abstained, false);
});

test("a style word ranks records with that look first", () => {
  const studio = (slug, style) => resource(slug, { tagline: "Design studio portfolio", category: "studios", subcategory: "brand-studios", kinds: ["studio"], visual: { style, colorMode: "light" } });
  const styled = createEngine({ resources: [...resources, studio("calm-studio", ["minimal"]), studio("loud-studio", ["neo-brutalist"])], items, taxonomy });
  const out = styled.search("neobrutalism design studio");
  assert.deepEqual(out.parsed.styles, ["neo-brutalist"]);
  assert.equal(out.hits[0].slug, "loud-studio");
});
