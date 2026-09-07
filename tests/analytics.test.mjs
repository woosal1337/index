import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

function analytics(window, environment = "production") {
  const source = readFileSync("app/lib/analytics.ts", "utf8");
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const context = { exports: {}, URL, process: { env: { NODE_ENV: environment } }, ...(window ? { window } : {}) };
  vm.runInNewContext(code, context);
  return context.exports;
}

const origin = "https://index.chele.bi";

test("analytics runs only on the production Index hostname", () => {
  const { analyticsEnabled } = analytics();
  assert.equal(analyticsEnabled("index.chele.bi", "production"), true);
  for (const host of ["localhost", "127.0.0.1", "preview.chele.bi", "index.chele.bi.example.com"]) {
    assert.equal(analyticsEnabled(host, "production"), false);
  }
  assert.equal(analyticsEnabled("index.chele.bi", "development"), false);
});

test("outbound events contain only the destination hostname", () => {
  const { linkEvent } = analytics();
  const event = linkEvent("https://www.example.com/private?email=person%40example.com#secret", origin);
  assert.equal(event.name, "outbound_click");
  assert.equal(JSON.stringify(event.properties), '{"host":"example.com"}');
});

test("resource and API events omit query values and fragments", () => {
  const { linkEvent } = analytics();
  for (const href of ["/r/kibo-ui/?q=private#secret", `${origin}/r/kibo-ui`]) {
    const event = linkEvent(href, origin);
    assert.equal(event.name, "resource_open");
    assert.equal(JSON.stringify(event.properties), '{"resource":"kibo-ui"}');
  }
  for (const path of ["/api/resources.json", "/api/showcase-indexes.json", "/llms.txt"]) {
    const event = linkEvent(`${path}?q=private#secret`, origin);
    assert.equal(event.name, "api_open");
    assert.equal(event.properties.path, path);
  }
});

test("irrelevant and non-web links do not emit events", () => {
  const { linkEvent } = analytics();
  for (const href of ["#main", "mailto:person@example.com", "javascript:void(0)", "/categories/", "/r/person@example.com", "http://["]) {
    assert.equal(linkEvent(href, origin), null);
  }
});

test("analytics cannot break an action when absent or blocked", () => {
  for (const window of [undefined, { location: { hostname: "index.chele.bi" } }, {
    location: { hostname: "index.chele.bi" },
    oa: { track() { throw new Error("Blocked"); } },
  }]) {
    assert.doesNotThrow(() => analytics(window).track("prompt_copy", { resource: "kibo-ui" }));
  }
});

test("production actions reach the tracker, but local actions do not", () => {
  const calls = [];
  const window = { location: { hostname: "index.chele.bi" }, oa: { track: (...args) => calls.push(args) } };
  analytics(window).track("prompt_copy", { resource: "kibo-ui" });
  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], "prompt_copy");
  analytics(window, "development").track("search_open");
  window.location.hostname = "localhost";
  analytics(window).track("search_open");
  assert.equal(calls.length, 1);
});

test("the shared layout loads one tracker with privacy signals enabled", () => {
  const layout = readFileSync("app/layout.tsx", "utf8");
  const component = readFileSync("app/_components/Analytics.tsx", "utf8");
  assert.equal(layout.match(/<Analytics\s*\/>/g)?.length, 1);
  assert.match(component, /strategy="afterInteractive"/);
  assert.match(component, /data-respect-dnt="true"/);
  assert.match(component, /data-respect-gpc="true"/);
  assert.doesNotMatch(component, /\.pageview\(/);
});

test("links that can leave the site flush before navigation", () => {
  const calls = [];
  const window = {
    location: { hostname: "index.chele.bi" },
    oa: { track: (name) => calls.push(name), flush: () => calls.push("flush") },
  };
  const { track } = analytics(window);
  track("outbound_click", { host: "example.com" });
  track("api_open", { path: "/api/resources.json" });
  track("search_open");
  assert.deepEqual(calls, ["outbound_click", "flush", "api_open", "flush", "search_open"]);
  window.oa.flush = () => { throw new Error("Blocked"); };
  assert.doesNotThrow(() => track("api_open", { path: "/api/resources.json" }));
});
