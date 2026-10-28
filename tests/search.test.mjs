import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { acceptsMap, checkFilters, rankPalette } from "../app/lib/search.ts";

const accepts = acceptsMap(JSON.parse(readFileSync("taxonomy/facets.json", "utf8")).facets);
const record = (facets, category = "component-libraries") => ({ category, facets });

test("filters accept compatible framework and styling values", () => {
  assert.equal(checkFilters(record({ framework: ["react"] }), { framework: ["next"] }, accepts), "met");
  assert.equal(checkFilters(record({ framework: ["web-components"] }), { framework: ["vue"] }, accepts), "met");
  assert.equal(checkFilters(record({ styling: ["tailwind-v4"] }), { styling: ["tailwind-any"] }, accepts), "met");
  assert.equal(checkFilters(record({ framework: ["vue"] }), { framework: ["react"] }, accepts), "violated");
  assert.equal(checkFilters(record({ license: ["apache-2.0"] }), { license: ["mit"] }, accepts), "violated");
});

test("filters separate unknown values from facets that do not apply", () => {
  assert.equal(checkFilters(record({ framework: ["unknown"] }), { framework: ["react"] }, accepts), "unverified");
  assert.equal(checkFilters(record({ framework: ["not-applicable"] }, "typography"), { framework: ["react"] }, accepts), "met");
  assert.equal(checkFilters(record({}, "typography"), { category: "color" }, accepts), "violated");
});

test("the palette ranks an exact name above a substring match", () => {
  const item = (s, n) => ({ s, n, t: "", c: "", tr: "B", d: "", h: n.toLowerCase() });
  const ranked = rankPalette([item("magic-ui-pro", "Magic UI Pro"), item("magic-ui", "Magic UI")], "magic ui");
  assert.deepEqual(ranked.map((x) => x.s), ["magic-ui", "magic-ui-pro"]);
});
