import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { fromPackage, githubRepo, htmlText, itemUrl, packageNames } from "../scripts/lib/enrich.mjs";
import { vocabMatcher } from "../app/lib/vocab.ts";

const groups = (file, key) => JSON.parse(readFileSync(file, "utf8")).groups.flatMap((g) => g[key]);
const match = vocabMatcher(groups("taxonomy/components.json", "components"), groups("taxonomy/surfaces.json", "surfaces"));

test("registry item names map onto the component and surface vocabulary", () => {
  assert.equal(match("date-picker-demo").component, "date-picker");
  assert.equal(match("sidebar-07").component, "sidebar");
  assert.equal(match("bento-grid-01").component, "bento-grid");
  assert.equal(match("sonner").component, "toast");
  assert.equal(match("pricing-3").surface, "pricing-website");
  assert.deepEqual(match("jingles-sax"), { component: null, surface: null });
});

test("npm metadata gives framework, styling, primitives, license, and release date", () => {
  const doc = {
    "dist-tags": { latest: "2.1.0" },
    time: { "2.1.0": "2026-09-30T10:00:00.000Z" },
    versions: {
      "2.1.0": {
        license: "MIT",
        peerDependencies: { react: "^19", tailwindcss: "^4.1" },
        dependencies: { "@radix-ui/react-dialog": "^1", motion: "^12" },
      },
    },
  };
  const out = fromPackage(doc);
  assert.deepEqual(out.framework, ["react"]);
  assert.deepEqual(out.styling, ["tailwind-v4"]);
  assert.deepEqual(out.builtOn, ["radix", "motion"]);
  assert.equal(out.licenseSlug, "mit");
  assert.equal(out.lastRelease, "2026-09-30");
});

test("package names come from the package field and install commands", () => {
  assert.deepEqual(packageNames({ package: "motion" }), ["motion"]);
  assert.deepEqual(packageNames({ install: "npm i @scope/pkg@^2 && pnpm add -D other" }), ["@scope/pkg", "other"]);
  assert.deepEqual(packageNames({ install: "pnpm dlx shadcn@latest init" }), []);
});

test("repository and registry URLs normalize", () => {
  assert.equal(githubRepo("https://github.com/Owner/Repo.git"), "owner/repo");
  assert.equal(githubRepo("https://github.com/owner/repo/tree/main/packages"), "owner/repo");
  assert.equal(githubRepo("https://gitlab.com/owner/repo"), null);
  assert.equal(itemUrl("https://x.dev/r/registry.json", "button"), "https://x.dev/r/button.json");
});

test("page text drops scripts and styles and keeps the title and description", () => {
  const html = `<html><head><title> Kit </title><meta name="description" content="UI kit"><style>a{}</style></head><body><script>x()</script><h1>Hello &amp; welcome</h1></body></html>`;
  assert.deepEqual(htmlText(html), { title: "Kit", description: "UI kit", text: "Kit Hello & welcome" });
});
