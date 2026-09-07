import { existsSync, readFileSync, readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { commentRanges } from "./lib/code-comments.mjs";

const skipped = new Set([".git", ".next", "out", "node_modules", ".claude", ".codex", "media", "dist"]);
const ignoredFiles = new Set(["next-env.d.ts", "cult_tree.txt", "elliptic-sync.json"]);
const excludedMedia = new Set(["public/media", "public/og", "public/shots", "public/tpl", "public/api"]);
const sourceTextFields = new Set(["body", "full_text", "caption", "transcript"]);
const allowedMarkdown = new Set(["README.md", "THIRD_PARTY.md"]);
const failures = [];
let comments = 0;

function checkURLs(value, file) {
  if (typeof value === "string" && /^https?:\/\//.test(value)) {
    try {
      const url = new URL(value);
      if (url.username || url.password || [...url.searchParams.keys()].some((key) =>
        /^(?:token|access_token|jwt|signature|x-amz-signature|x-amz-credential)$/i.test(key))) {
        failures.push(`${file}: remove the credential-bearing URL.`);
      }
    } catch { return; }
  } else if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) {
      if (sourceTextFields.has(key)) failures.push(`${file}: remove the full source text field ${key}.`);
      checkURLs(child, file);
    }
  }
}

function walk(dir = ".") {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (path === "data/enriched") continue;
    if (skipped.has(entry.name) || excludedMedia.has(path) || ignoredFiles.has(entry.name)) continue;
    if (entry.name === "AGENTS.md" || entry.name === "research" || entry.name === "mcp") {
      failures.push(`${path}: remove this private or incomplete release content.`);
      continue;
    }
    if (/^\.env(?:\.|$)/.test(entry.name)) continue;
    if (entry.isDirectory()) { walk(path); continue; }
    if (!entry.isFile() || /\.(?:woff2|png|webp|jpe?g|ico)$/.test(path)) continue;
    if (/\.(?:md|mdx|markdown)$/i.test(path) && !allowedMarkdown.has(path)) {
      failures.push(`${path}: remove the agent guide or project notes from the release.`);
    }
    const source = readFileSync(path, "utf8");
    const ranges = commentRanges(path, source);
    if (ranges.length) {
      comments += ranges.length;
      failures.push(`${path}: ${ranges.length} code comments remain.`);
    }
    if (/(?:^|[\s"'`])\/(?:Users|home)\/[a-z][\w.-]*\//i.test(source)) failures.push(`${path}: remove the personal filesystem path.`);
    if (/^data\/.*\.json$/.test(path)) checkURLs(JSON.parse(source), path);
  }
}

if (existsSync(".git")) {
  const tracked = spawnSync("git", ["ls-files", "-z", "--", "data/enriched"], { encoding: "utf8" });
  if (tracked.status !== 0) failures.push("Cannot check Git tracking for raw source files.");
  else if (tracked.stdout) failures.push("data/enriched: remove raw source files from Git tracking.");
}
walk();
for (const file of ["LICENSE", "THIRD_PARTY.md", "public/fonts/OFL-Oswald.txt", "public/fonts/OFL-SpaceMono.txt", "public/fonts/OFL-Geist.txt", "public/fonts/OFL-Silkscreen.txt"]) {
  if (!existsSync(file)) failures.push(`${file}: add the license notice.`);
}
if (failures.length) {
  console.error([...new Set(failures)].join("\n"));
  process.exitCode = 1;
} else console.log(`Release check passed: ${comments} code comments and no flagged private paths, URL credentials, or full source text fields.`);
