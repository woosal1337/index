import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const component = readFileSync(new URL("../app/_components/CommandPalette.tsx", import.meta.url), "utf8");
const styles = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");

test("command palette hover and keyboard selection share one contrast state", () => {
  assert.match(component, /className="command-row row"/);
  assert.doesNotMatch(component, /bg-surface-2/);
  assert.match(styles, /\.row:hover,\s*\.command-row\[aria-selected="true"\] \{ background: var\(--muted-2\); \}/);
});
