import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve, join } from "node:path";
import test from "node:test";
import { commentRanges } from "../scripts/lib/code-comments.mjs";
import { previewServer } from "../scripts/lib/preview-server.mjs";

const valid = JSON.parse(readFileSync("data/entries/links-00.json", "utf8"))[0];

function validate(t, records, raw) {
  const root = mkdtempSync(join(tmpdir(), "index-validator-test-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(join(root, "scripts"));
  mkdirSync(join(root, "data/entries"), { recursive: true });
  cpSync("scripts/validate.mjs", join(root, "scripts/validate.mjs"));
  cpSync("taxonomy", join(root, "taxonomy"), { recursive: true });
  if (records !== undefined || raw !== undefined) {
    writeFileSync(join(root, "data/entries/links-00.json"), raw ?? JSON.stringify(records));
  }
  return spawnSync(process.execPath, [join(root, "scripts/validate.mjs")], { encoding: "utf8" });
}

test("valid records pass validation", (t) => assert.equal(validate(t, [valid]).status, 0));

for (const [name, records, raw] of [
  ["duplicate slugs", [valid, { ...valid, id: "duplicate" }]],
  ["duplicate IDs", [valid, { ...valid, slug: "duplicate" }]],
  ["unknown taxonomy values", [{ ...valid, components: ["not-a-component"] }]],
  ["missing quality tier", [{ ...valid, quality_tier: null }]],
  ["wrong field types", [{ ...valid, id: 123 }]],
  ["non-object records", [null]],
  ["non-array files", {}],
  ["malformed JSON", undefined, "{"],
  ["no entry files", undefined],
  ["empty catalog", []],
]) {
  test(`validation fails for ${name}`, (t) => assert.notEqual(validate(t, records, raw).status, 0));
}

test("comment detection keeps URLs, regexes, and strings separate from comments", () => {
  const source = 'const url = "https://example.com"; const s = "/* text */"; const r = /https?:\\/\\//;';
  assert.equal(commentRanges("sample.ts", source).length, 0);
  assert.equal(commentRanges("sample.tsx", 'const x = <div>{/* note */}Text</div>; // note').length, 2);
  assert.equal(commentRanges("sample.ts", 'const x = 1; /* note */\n// note').length, 2);
});

test("preview serves pages, JSON, 404s, and rejects unsafe requests", async (t) => {
  const root = mkdtempSync(join(tmpdir(), "index-preview-test-"));
  const outside = mkdtempSync(join(tmpdir(), "index-outside-test-"));
  writeFileSync(join(root, "index.html"), "Index");
  writeFileSync(join(root, "404.html"), "Not found");
  writeFileSync(join(root, "test.json"), '{"ok":true}');
  writeFileSync(join(outside, "private.txt"), "Private");
  symlinkSync(join(outside, "private.txt"), join(root, "escape.txt"));
  const server = previewServer(resolve(root));
  await new Promise((ready) => server.listen(0, "127.0.0.1", ready));
  t.after(async () => {
    await new Promise((done) => server.close(done));
    rmSync(root, { recursive: true, force: true });
    rmSync(outside, { recursive: true, force: true });
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  assert.equal(await (await fetch(base)).text(), "Index");
  assert.deepEqual(await (await fetch(`${base}/test.json`)).json(), { ok: true });
  assert.equal((await fetch(`${base}/missing`)).status, 404);
  assert.equal((await fetch(`${base}/escape.txt`)).status, 403);
  assert.equal((await fetch(base, { method: "POST" })).status, 405);
  assert.equal(await (await fetch(base, { method: "HEAD" })).text(), "");
});
