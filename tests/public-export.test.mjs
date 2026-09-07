import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { catalogDescription, pageMetadata, siteOrigin } from "../app/lib/site.ts";

test("the site origin defaults to the launch domain and accepts an override", () => {
  assert.equal(siteOrigin(""), "https://index.chele.bi");
  assert.equal(siteOrigin(" https://example.com/ "), "https://example.com");
  assert.equal(siteOrigin("http://localhost:3000"), "http://localhost:3000");
  for (const value of ["not-a-url", "ftp://example.com", "https://user:password@example.com", "https://example.com/path", "https://example.com/?q=1", "https://example.com/#hash"]) {
    assert.throws(() => siteOrigin(value));
  }
});

test("metadata uses current counts and each route's URL", () => {
  const description = catalogDescription({ resources: 1234, vocabComponents: 25, vocabSurfaces: 10 });
  assert.match(description, /^1,234 design resources, tagged against 25 components and 10 app surfaces\./);
  const metadata = pageMetadata("/r/kibo-ui", "Kibo UI", description);
  assert.equal(metadata.alternates.canonical, `${siteOrigin()}/r/kibo-ui/`);
  assert.equal(metadata.openGraph.url, metadata.alternates.canonical);
  assert.equal(metadata.openGraph.description, description);
  assert.equal(metadata.twitter.description, description);
  assert.equal(metadata.twitter.title, "Kibo UI · Index");
});

test("the data build keeps references but excludes full source text", (t) => {
  const root = mkdtempSync(join(tmpdir(), "index-public-export-test-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(join(root, "scripts"));
  mkdirSync(join(root, "data/entries"), { recursive: true });
  mkdirSync(join(root, "data/enriched"));
  mkdirSync(join(root, "data/references"));
  cpSync("scripts/build-data.mjs", join(root, "scripts/build-data.mjs"));
  cpSync("taxonomy", join(root, "taxonomy"), { recursive: true });
  const valid = JSON.parse(readFileSync("data/entries/links-00.json", "utf8"))[0];
  writeFileSync(join(root, "data/entries/links-00.json"), JSON.stringify([valid]));
  writeFileSync(join(root, "data/links.json"), "[]");
  const imageKey = valid.id.replace(/[^A-Za-z0-9_-]/g, "_");
  writeFileSync(join(root, "data/media-manifest.json"), JSON.stringify({ [`/og/${imageKey}.webp`]: [1200, 630] }));
  const reference = {
    id: valid.id, fetch_ok: true, author_handle: "example", author_name: "Example",
    title: "Source title", full_text: "ARTICLE_BODY_SENTINEL",
    caption: "CAPTION_SENTINEL", transcript: "TRANSCRIPT_SENTINEL",
    key_takeaways: ["A short summary."], design_topics: ["Design"],
  };
  for (const file of ["x-articles-00.json", "instagram-00.json"]) {
    writeFileSync(join(root, "data/references", file), JSON.stringify([reference]));
    writeFileSync(join(root, "data/enriched", file), "INVALID_RAW_SOURCE_SENTINEL");
  }
  const result = spawnSync(process.execPath, [join(root, "scripts/build-data.mjs")], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  for (const file of ["data/dist/resources.json", "public/api/resources.json"]) {
    const output = readFileSync(join(root, file), "utf8");
    assert.doesNotMatch(output, /ARTICLE_BODY_SENTINEL|CAPTION_SENTINEL|TRANSCRIPT_SENTINEL/);
    const [resource] = JSON.parse(output);
    assert.equal(resource.id, valid.id);
    assert.equal(resource.url, valid.url);
    assert.equal(resource.article.author, "example");
    assert.deepEqual(resource.article.takeaways, ["A short summary."]);
    assert.equal(resource.instagram.author, "example");
    assert.equal(resource.hasImage, true);
  }
});
