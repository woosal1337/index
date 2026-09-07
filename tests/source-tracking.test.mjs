import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";

function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), "index-source-tracking-test-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  for (const file of ["scripts/check-release.mjs", "scripts/lib/code-comments.mjs", "LICENSE", "THIRD_PARTY.md", "public/fonts/OFL-Oswald.txt", "public/fonts/OFL-SpaceMono.txt", "public/fonts/OFL-Geist.txt", "public/fonts/OFL-Silkscreen.txt"]) {
    mkdirSync(dirname(join(root, file)), { recursive: true });
    cpSync(file, join(root, file));
  }
  symlinkSync(resolve("node_modules"), join(root, "node_modules"));
  mkdirSync(join(root, "data/references"), { recursive: true });
  mkdirSync(join(root, "data/enriched"));
  writeFileSync(join(root, "data/enriched/raw.json"), "INVALID_PRIVATE_SOURCE_SENTINEL");
  return root;
}

function check(root) {
  return spawnSync(process.execPath, ["scripts/check-release.mjs"], { cwd: root, encoding: "utf8" });
}

test("the release check ignores local raw sources", (t) => {
  const root = fixture(t);
  writeFileSync(join(root, "data/references/source.json"), JSON.stringify([{ id: "source", title: "Source title", url: "https://example.com" }]));
  const result = check(root);
  assert.equal(result.status, 0, result.stderr);
});

for (const field of ["body", "full_text", "caption", "transcript"]) {
  test(`the release check rejects the ${field} field in catalog data`, (t) => {
    const root = fixture(t);
    writeFileSync(join(root, "data/references/source.json"), JSON.stringify([{ nested: { [field]: "PRIVATE_SOURCE_SENTINEL" } }]));
    const result = check(root);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /remove the full source text field/);
    assert.doesNotMatch(result.stderr, /PRIVATE_SOURCE_SENTINEL/);
  });
}

for (const file of ["CLAUDE.md", "DESIGN.md", "CONTRIBUTING.md", "notes.md"]) {
  test(`the release check rejects ${file}`, (t) => {
    const root = fixture(t);
    writeFileSync(join(root, file), "PRIVATE_GUIDE_SENTINEL");
    const result = check(root);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /remove the agent guide or project notes/);
    assert.doesNotMatch(result.stderr, /PRIVATE_GUIDE_SENTINEL/);
  });
}

test("the release check rejects raw sources added to Git", (t) => {
  const root = fixture(t);
  writeFileSync(join(root, ".gitignore"), "data/enriched/\n");
  for (const args of [["init", "--quiet"], ["add", "--force", "--", "data/enriched/raw.json"]]) {
    const result = spawnSync("git", args, { cwd: root, encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr);
  }
  const result = check(root);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /remove raw source files from Git tracking/);
});
