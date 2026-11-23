#!/usr/bin/env node

import { execFile } from "node:child_process";
import { readdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { cpus } from "node:os";

const run = promisify(execFile);
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dir = join(root, "public", "media");

const WIDTH = 192;
const QUALITY = 74;

const jobs = readdirSync(dir)
  .filter((f) => f.endsWith("-thumb.webp"))
  .map((f) => ({ src: join(dir, f), out: join(dir, f.replace("-thumb.webp", "-tiny.webp")) }))
  .filter((j) => !existsSync(j.out));

if (!jobs.length) {
  console.log("tiny tier — nothing to build");
  process.exit(0);
}

const lanes = Math.max(2, cpus().length - 1);
let next = 0;
let done = 0;
let failed = 0;

await Promise.all(
  Array.from({ length: lanes }, async () => {
    while (next < jobs.length) {
      const j = jobs[next++];
      try {
        await run("cwebp", ["-quiet", "-resize", String(WIDTH), "0", "-q", String(QUALITY), j.src, "-o", j.out]);
      } catch {
        failed++;
      }
      if (++done % 200 === 0) process.stdout.write(`\r  ${done}/${jobs.length}`);
    }
  })
);

process.stdout.write("\r");
console.log(
  `tiny tier — ${jobs.length - failed} written at ${WIDTH}px` + (failed ? ` · ${failed} failed` : "")
);
