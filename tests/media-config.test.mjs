import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

test("the media helper requires an explicit bucket", () => {
  const env = { ...process.env };
  delete env.S3_BUCKET;
  const result = spawnSync("bash", ["scripts/fetch-media.sh"], { env, encoding: "utf8" });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Set S3_BUCKET to the media bucket/);
});

test("the Docker build checks the media bucket with the other S3 settings", () => {
  const dockerfile = readFileSync("Dockerfile", "utf8");
  assert.match(dockerfile, /^ARG S3_BUCKET=""$/m);
  assert.ok(dockerfile.includes('${S3_BUCKET:?Set the S3 bucket.}'));
  assert.ok(dockerfile.includes('id=S3_BUCKET,env=S3_BUCKET'));
});

test("the Vercel deployment proxies only the three media paths", () => {
  const config = JSON.parse(readFileSync("vercel.json", "utf8"));
  const exportCheck = readFileSync("scripts/check-export.mjs", "utf8");
  assert.deepEqual(config.rewrites, [
    { source: "/og/:path*", destination: "https://index-media.chele.bi/og/:path*" },
    { source: "/shots/:path*", destination: "https://index-media.chele.bi/shots/:path*" },
    { source: "/tpl/:path*", destination: "https://index-media.chele.bi/tpl/:path*" },
  ]);
  assert.match(exportCheck, /mediaPaths\.has\(path\)/);
});

test("the data build keeps the tracked media inventory without local media", (t) => {
  const root = mkdtempSync(join(tmpdir(), "index-media-config-test-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(join(root, "scripts"));
  mkdirSync(join(root, "data"));
  cpSync("scripts/webp-dims.mjs", join(root, "scripts/webp-dims.mjs"));
  const manifest = { "/og/example.webp": [1200, 630] };
  writeFileSync(join(root, "data/media-manifest.json"), JSON.stringify(manifest));
  const result = spawnSync(process.execPath, ["scripts/webp-dims.mjs"], { cwd: root, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(readFileSync(join(root, "data/dist/image-dims.json"), "utf8")), manifest);
});
