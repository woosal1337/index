import { existsSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const LOCK = join(dirname(fileURLToPath(import.meta.url)), "..", "data", ".boards.lock");

function alive(pid) {
  try { process.kill(pid, 0); return true; } catch { return false; }
}

export function acquire(who) {
  if (existsSync(LOCK)) {
    const held = JSON.parse(readFileSync(LOCK, "utf8"));
    if (held.pid !== process.pid && alive(held.pid)) {
      console.error(
        `\ndata/boards.json is locked by ${held.who} (pid ${held.pid}, since ${held.at}).\n` +
        `Wait for it to finish. Two writers would undo each other's work.\n`
      );
      process.exit(1);
    }
    rmSync(LOCK, { force: true }); 
  }
  writeFileSync(LOCK, JSON.stringify({ pid: process.pid, who, at: new Date().toISOString() }));
  const release = () => rmSync(LOCK, { force: true });
  process.on("exit", release);
  process.on("SIGINT", () => { release(); process.exit(130); });
  process.on("SIGTERM", () => { release(); process.exit(143); });
  return release;
}
