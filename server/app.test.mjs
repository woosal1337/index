import assert from "node:assert/strict";
import { once } from "node:events";
import { createServer } from "node:http";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import { loadTaxonomy } from "../scripts/lib/catalog.mjs";
import { callerOf, createApi, createHttpHandler, createLimiter, SITE } from "./app.mjs";

const taxonomy = loadTaxonomy(join(dirname(fileURLToPath(import.meta.url)), ".."));
const base = {
  description: "A test record.", agentGuidance: "", subcategory: "react-component-libraries", category: "component-libraries",
  kinds: ["component-library"], components: [], surfaces: [], notableFor: [], pkg: null, repoUrl: null, docsUrl: null, registryUrl: null,
  machineUrls: [], domain: "example.com", tier: "B", templates: [], sameAs: null, install: null,
};
const resource = (slug, extra) => ({ ...base, slug, url: `https://${slug}.example.com`, name: slug.replace(/-/g, " "), tagline: "", facets: {}, ...extra });
const catalog = {
  taxonomy,
  resources: [
    resource("toastkit", { tagline: "Notifications for React", components: ["toast"], install: "npm i toastkit", facets: { framework: ["react"], license: ["mit"] } }),
    resource("vue-toasts", { tagline: "Toast messages for Vue", components: ["toast"], facets: { framework: ["vue"], license: ["mit"] } }),
    resource("calendar-ui", { tagline: "Scheduling widgets", components: ["date-picker"], facets: { framework: ["react"] }, templates: [{ name: "Booking page", url: "https://calendar-ui.example.com/t/booking" }] }),
  ],
  showcase: [{
    slug: "acme", name: "Acme", url: "https://acme.example.com", domain: "acme.example.com", fonts: ["Inter"], css: { colorMode: "dark" },
    shots: [
      { id: 1, pageUrl: "https://acme.example.com/pricing", local: "/shots/1.webp", fonts: [], colors: ["#000000"], visual: { pageType: "pricing-website", style: ["minimal"], sections: ["pricing-table"] } },
      { id: 2, pageUrl: "https://acme.example.com/", local: "/shots/2.webp", fonts: [], colors: ["#ffffff"], visual: { pageType: "homepage", style: ["brutalist"] } },
      { id: 3, pageUrl: "https://acme.example.com/pricing", local: "/shots/3.webp", fonts: [], colors: ["#000000"], visual: { pageType: "pricing-website", style: ["minimal"] } },
    ],
  }],
  items: [{ resource: "calendar-ui", name: "date-range-picker", title: "Date range picker", component: "date-range-picker", surface: null, install: "npx shadcn@latest add https://calendar-ui.example.com/r/date-range-picker.json", url: "https://calendar-ui.example.com/r/date-range-picker.json" }],
};

async function serve(t, options = {}) {
  const api = createApi(catalog);
  const logs = [];
  const server = createServer(createHttpHandler({ api, embed: async () => undefined, taxonomy, version: "test", log: (e) => logs.push(e), ...options }));
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(() => server.close());
  return { url: `http://127.0.0.1:${server.address().port}`, logs };
}

async function connect(t, url, versionNegotiation) {
  const client = new Client({ name: "test", version: "1" }, { versionNegotiation });
  await client.connect(new StreamableHTTPClientTransport(new URL(`${url}/mcp`)));
  t.after(() => client.close());
  return client;
}

for (const [era, negotiation] of [["2025 clients", { mode: "legacy" }], ["2026-07-28 clients", { mode: { pin: "2026-07-28" } }]]) {
  test(`${era} list three read-only tools and get search results`, async (t) => {
    const { url, logs } = await serve(t);
    const client = await connect(t, url, negotiation);
    const { tools } = await client.listTools();
    assert.deepEqual(tools.map((x) => x.name).sort(), ["component_guide", "fetch", "search"]);
    assert.ok(tools.every((x) => x.annotations.readOnlyHint && !x.annotations.openWorldHint));
    const out = await client.callTool({ name: "search", arguments: { query: "toast notifications", framework: ["react"] } });
    assert.equal(out.structuredContent.results[0].id, "toastkit");
    assert.ok(out.structuredContent.results.every((r) => r.id !== "vue-toasts"));
    assert.equal(logs.at(-1).tool, "search");
  });
}

test("the tools resolve component names, report empty answers, and explain bad input", async (t) => {
  const { url } = await serve(t);
  const client = await connect(t, url, { mode: "legacy" });
  const call = async (name, args) => (await client.callTool({ name, arguments: args }));
  const items = (await call("search", { query: "date range picker" })).structuredContent.results[0].items;
  assert.match(items[0].install, /shadcn@latest add/);
  assert.equal((await call("search", { query: "kubernetes autoscaling" })).structuredContent.match, "none");
  assert.equal((await call("search", { query: "server error page", surface: "error-500" })).isError, undefined);
  const bad = await call("search", { query: "picker", component: "flux capacitor" });
  assert.equal(bad.isError, true);
  assert.match(bad.content[0].text, /no component called "flux capacitor"/);
  const record = (await call("fetch", { id: "https://index.chele.bi/r/toastkit/" })).structuredContent;
  assert.equal(record.id, "toastkit");
  assert.match(record.text, /Install: npm i toastkit/);
  const guide = (await call("component_guide", { component: "snackbar", framework: ["react"] })).structuredContent;
  assert.equal(guide.component, "toast");
  assert.deepEqual(guide.implementations.map((r) => r.id), ["toastkit"]);
});

test("plain HTTP search returns JSON, rejects unknown filter values, and accepts MCP posts without a JSON content type", async (t) => {
  const { url } = await serve(t);
  const ok = await fetch(`${url}/search?q=toast&framework=vue`);
  assert.equal(ok.headers.get("access-control-allow-origin"), "*");
  assert.deepEqual((await ok.json()).results.map((r) => r.id), ["vue-toasts"]);
  assert.equal((await fetch(`${url}/search?q=toast&framework=cobol`)).status, 400);
  const init = await fetch(`${url}/mcp`, {
    method: "POST",
    headers: { accept: "application/json, text/event-stream", "content-type": "text/plain" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "bare", version: "1" } } }),
  });
  assert.equal(init.status, 200);
  assert.match(await init.text(), /"serverInfo"/);
});

test("each caller IP gets its own search budget and the Anthropic range shares one", async (t) => {
  const { url } = await serve(t, { limits: { search: { ip: 2, anthropic: 3 }, other: { ip: 100, anthropic: 100 } } });
  const hit = (ip) => fetch(`${url}/search?q=toast`, { headers: { "cf-connecting-ip": ip } });
  assert.deepEqual([(await hit("203.0.113.5")).status, (await hit("203.0.113.5")).status], [200, 200]);
  const blocked = await hit("203.0.113.5");
  assert.equal(blocked.status, 429);
  assert.ok(Number(blocked.headers.get("retry-after")) >= 1);
  assert.equal((await hit("203.0.113.6")).status, 200);
  for (const ip of ["160.79.104.1", "160.79.105.9", "160.79.111.200"]) assert.equal((await hit(ip)).status, 200);
  assert.equal((await hit("160.79.104.2")).status, 429);
});

test("callers group by IPv6 /64, and buckets refill over time", () => {
  assert.equal(callerOf("2001:db8:1:2::5").key, callerOf("2001:db8:1:2:ffff::9").key);
  assert.notEqual(callerOf("2001:db8:1:2::5").key, callerOf("2001:db8:1:3::5").key);
  assert.equal(callerOf("::ffff:160.79.106.4").tier, "anthropic");
  const limit = createLimiter(60);
  for (let i = 0; i < 60; i++) assert.equal(limit.take("k", 0), 0);
  assert.equal(limit.take("k", 0), 1);
  assert.equal(limit.take("k", 2000), 0);
  limit.prune(10 * 60000);
  assert.equal(limit.size(), 0);
});

test("screen search ranks by page type and style without vectors, and fetch reads a screen", async (t) => {
  const { url } = await serve(t);
  const out = await (await fetch(`${url}/search?q=minimal+pricing+page&type=screens`)).json();
  assert.equal(out.results[0].id, "shot:1");
  assert.equal(out.results.filter((r) => r.url === "https://acme.example.com/pricing").length, 1);
  assert.deepEqual(out.results[0].why, ["page type: pricing-website", "style: minimal"]);
  assert.match(out.results[0].image, new RegExp(`^${SITE}/shots/1\\.webp\\?v=`));
  assert.equal((await (await fetch(`${url}/search?q=quarterly+tax+report&type=screens`)).json()).match, "none");
  const client = await connect(t, url, { mode: "legacy" });
  const shot = (await client.callTool({ name: "fetch", arguments: { id: "shot:2" } })).structuredContent;
  assert.equal(shot.metadata.pageType, "homepage");
});

test("unified vectors credit a record for its matching template and rank screens by look", () => {
  const api = createApi(catalog);
  const docs = [
    { id: "res:toastkit", kind: "resource", parent: "toastkit", label: "toastkit" },
    { id: "tpl:calendar-ui:0", kind: "template", parent: "calendar-ui", label: "Booking page", url: "https://calendar-ui.example.com/t/booking" },
    { id: "shot:1", kind: "screen", parent: "acme", label: "Acme /pricing" },
    { id: "shot:2", kind: "screen", parent: "acme", label: "Acme /" },
  ];
  api.useVectors({ docs, dims: 2, data: Float32Array.from([0, 1, 1, 0, 0.6, 0.8, 1, 0]) });
  const out = api.search({ query: "scheduling booking page" }, Float32Array.from([1, 0]));
  const hit = out.results.find((r) => r.id === "calendar-ui");
  assert.deepEqual(hit.matched, { kind: "template", name: "Booking page", url: "https://calendar-ui.example.com/t/booking" });
  const screens = api.search({ query: "landing hero", type: "screens" }, Float32Array.from([1, 0]));
  assert.equal(screens.mode, "hybrid");
  assert.equal(screens.results[0].id, "shot:2");
});

test("fetch returns record facts, not instructions for the agent", async (t) => {
  const { url } = await serve(t);
  const client = await connect(t, url, { mode: "legacy" });
  const { text } = (await client.callTool({ name: "fetch", arguments: { id: "toastkit" } })).structuredContent;
  assert.doesNotMatch(text, /DESIGN\.md|in my project/);
});
