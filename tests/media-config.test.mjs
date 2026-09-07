import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
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
