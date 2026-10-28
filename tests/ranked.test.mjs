import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { rankedGroups } from "../app/lib/ranked.ts";

const categories = [
  {
    slug: "studios",
    name: "Studios",
    description: "",
    agent_hint: "",
    subcategories: [
      { slug: "branding-studios", name: "Branding Studios", description: "Brand work." },
      { slug: "product-and-web-studios", name: "Product & Web Studios", description: "Product work." },
    ],
  },
  {
    slug: "portfolios",
    name: "Portfolios",
    description: "",
    agent_hint: "",
    subcategories: [{ slug: "designer-portfolios", name: "Designer Portfolios", description: "Personal sites." }],
  },
];

const record = (slug, category, subcategory, tier, extra = {}) => ({
  slug,
  name: slug,
  category,
  subcategory,
  tier,
  kinds: ["studio", "portfolio"],
  domain: `${slug}.studio`,
  ...extra,
});

test("ranked groups keep studios and portfolios apart and put the best first", () => {
  const resources = [
    record("steady", "studios", "product-and-web-studios", "B"),
    record("leader", "studios", "product-and-web-studios", "S"),
    record("mark", "studios", "branding-studios", "C"),
    record("solo", "portfolios", "designer-portfolios", "A"),
    record("foundry", "typography", "typefaces", "A"),
  ];
  const studios = rankedGroups(resources, categories, "studios");
  assert.deepEqual(studios.map((g) => g.slug), ["product-and-web-studios", "branding-studios"]);
  assert.deepEqual(studios[0].items.map((r) => r.slug), ["leader", "steady"]);
  const portfolios = rankedGroups(resources, categories, "portfolios");
  assert.deepEqual(portfolios.flatMap((g) => g.items.map((r) => r.slug)), ["solo"]);
});

test("ranked groups hide a gallery page when its studio has a main record", () => {
  const groups = rankedGroups([
    record("kree8-apps", "studios", "product-and-web-studios", "C", { domain: "kree8.studio", kinds: ["portfolio", "studio", "gallery"] }),
    record("kree8", "studios", "product-and-web-studios", "B", { domain: "kree8.studio" }),
    record("swipe", "studios", "product-and-web-studios", "B", { domain: "kargul.studio", kinds: ["portfolio", "gallery"] }),
  ], categories, "studios");
  assert.deepEqual(groups[0].items.map((r) => r.slug), ["kree8", "swipe"]);
});

test("ranked groups keep two portfolios on one shared host", () => {
  const groups = rankedGroups([
    record("ana", "portfolios", "designer-portfolios", "C", { domain: "read.cv" }),
    record("ben", "portfolios", "designer-portfolios", "C", { domain: "read.cv" }),
  ], categories, "portfolios");
  assert.deepEqual(groups[0].items.map((r) => r.slug), ["ana", "ben"]);
});

test("the old combined category URL redirects to the Studios page", () => {
  const config = JSON.parse(readFileSync("vercel.json", "utf8"));
  const sources = config.redirects.filter((r) => r.destination === "/studios/" && r.permanent).map((r) => r.source);
  assert.deepEqual(sources.sort(), ["/categories/studios-portfolios", "/categories/studios-portfolios/"]);
});
