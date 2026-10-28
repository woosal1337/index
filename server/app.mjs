import { z } from "zod";
import { createMcpHandler, McpServer } from "@modelcontextprotocol/server";
import { toNodeHandler } from "@modelcontextprotocol/node";
import { ABOUT, SEARCH_RULES } from "../app/lib/agent.ts";
import { createEngine, WEIGHTS } from "../app/lib/engine.ts";
import { MEDIA_VERSION, ogImageUrl } from "../app/lib/media.ts";
import { recordFacts } from "../app/lib/prompt.ts";
import { FILTER_FACETS } from "../app/lib/search.ts";
import { findAll, normalize, surfaceFamily, vocabMap } from "../app/lib/vocab.ts";

export const SITE = "https://index.chele.bi";

export const INSTRUCTIONS = [ABOUT, ...SEARCH_RULES.map((r, i) => `${i + 1}. ${r}`)].join("\n");

const asList = (v) => (Array.isArray(v) ? v : v ? [v] : []);
const known = (v) => asList(v).filter((x) => x !== "unknown" && x !== "not-applicable");
const compact = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v != null && v !== "" && !(Array.isArray(v) && !v.length)));

export class UsageError extends Error {}

export const SCREEN_WEIGHTS = { surface: 0.08, style: 0.06, mode: 0.03, perSite: 2 };
const RESOURCE_KINDS = new Set(["resource", "preview", "template", "item"]);
const GENERIC = new Set(["page", "screen", "view", "flow", "design", "template", "section", "website", "web", "app", "mobile", "and", "the", "for", "with"]);
const singular = (w) => w.replace(/s$/, "");
const lookOf = (r) => (r.visual?.style?.length ? compact({
  styles: r.visual.style,
  colorMode: r.visual.colorMode,
  fonts: [...new Set([r.visual.headingFont, r.visual.bodyFont].filter(Boolean))],
  image: r.hasImage && r.imageKey ? `${SITE}${ogImageUrl(r.imageKey)}` : undefined,
}) : undefined);

export function createApi({ resources, items, taxonomy, showcase = [] }) {
  const bySlug = new Map(resources.map((r) => [r.slug, r]));
  const itemsBy = new Map();
  for (const it of items) itemsBy.set(it.resource, [...(itemsBy.get(it.resource) || []), it]);
  const itemById = new Map(items.map((i) => [`item:${i.id}`, i]));
  const screens = showcase.flatMap((site) => site.shots.filter((shot) => shot.local).map((shot) => ({ id: `shot:${shot.id}`, site, shot })));
  const screenById = new Map(screens.map((x) => [x.id, x]));
  let parts = [];
  let screenRows = null;
  const compBySlug = new Map(taxonomy.components.map((c) => [c.slug, c]));
  const compMap = vocabMap(taxonomy.components);
  const surfMap = vocabMap(taxonomy.surfaces, (s) => [String(s.name || "").replace(/\(.*?\)/g, "")]);
  let engine = createEngine({ resources, items, taxonomy });
  let dense = false;

  const exact = new Map([[compMap, new Set(taxonomy.components.map((x) => x.slug))], [surfMap, new Set(taxonomy.surfaces.map((x) => x.slug))]]);
  const family = surfaceFamily(taxonomy.surfaces);
  const vocab = { component: taxonomy.components, surface: taxonomy.surfaces, category: taxonomy.categories };
  const near = (text, what) => {
    const want = new Set(normalize(text).split(" ").map(singular).filter((w) => w.length > 2 && !GENERIC.has(w)));
    return [what, ...Object.keys(vocab).filter((k) => k !== what)].flatMap((kind) => vocab[kind]
      .filter((e) => normalize(`${e.slug} ${e.name ?? ""} ${(e.aliases || []).join(" ")}`).split(" ").some((w) => want.has(singular(w))))
      .map((e) => `${kind} "${e.slug}"`)).slice(0, 6);
  };
  const resolve = (map, text, what) => {
    if (!text) return undefined;
    const slug = exact.get(map).has(text) ? text : findAll(map, text, new Set())[0]?.slug;
    if (slug) return slug;
    const close = near(text, what);
    throw new UsageError(`Index has no ${what} called "${text}". ${close.length ? `Close names: ${close.join(", ")}. Use one, or` : "Try another name, or"} leave ${what} out and put the words in the query.`);
  };
  const resolveSurface = (text, query = "") => {
    const slug = resolve(surfMap, text, "surface");
    return slug && (slug === text ? [slug] : family(slug, normalize(`${text} ${query}`)));
  };

  const matched = (hit) => {
    const d = hit.via === undefined ? null : parts[hit.via];
    if (!d || d.kind === "preview") return undefined;
    if (d.kind === "item") {
      const i = itemById.get(d.id);
      return compact({ kind: "item", name: d.label, install: i?.install, url: i?.url });
    }
    return compact({ kind: d.kind, name: d.label, url: d.url });
  };

  const card = (r, hit, parsed) => {
    const its = (itemsBy.get(r.slug) || [])
      .filter((i) => i.install && (parsed.components.includes(i.component) || parsed.surfaces.includes(i.surface)))
      .slice(0, 3)
      .map((i) => compact({ name: i.title || i.name, install: i.install, url: i.url }));
    return compact({
      id: r.slug,
      title: r.name,
      url: `${SITE}/r/${r.slug}/`,
      source: r.url,
      summary: r.summary || r.tagline,
      category: r.category,
      tier: r.tier,
      framework: known(r.facets?.framework),
      styling: known(r.facets?.styling),
      license: known(r.facets?.license),
      pricing: known(r.facets?.pricing),
      look: lookOf(r),
      install: r.install,
      docs: r.docsUrl,
      repo: r.repoUrl,
      registry: r.registryUrl,
      why: hit.why,
      matched: matched(hit),
      items: its,
    });
  };

  const filtersOf = (args) => {
    const filters = Object.fromEntries(FILTER_FACETS.filter((f) => args[f]?.length).map((f) => [f, args[f]]));
    if (args.category) filters.category = args.category;
    const component = resolve(compMap, args.component, "component");
    const surface = resolveSurface(args.surface, args.query);
    if (component) filters.component = component;
    if (surface) filters.surface = surface;
    return filters;
  };

  const run = (query, filters, limit, queryVector) => {
    const res = engine.search(query, filters, { limit, queryVector: dense ? queryVector : undefined });
    const match = res.abstained ? "none" : res.evidence >= WEIGHTS.sureEvidence ? "strong" : "weak";
    return { res, match, mode: dense && queryVector ? "hybrid" : "keyword" };
  };

  const hint = (match, relaxed) => {
    if (match === "none") return "Nothing in Index fits this request. Widen or drop filters, describe the need in other words, or call component_guide and build the part yourself.";
    if (relaxed.length) return `No result met the ${relaxed.join(" and ")} filter, so the search dropped it. Check each result before you use it.`;
    if (match === "weak") return "These results match only part of the request. Read the why list of each result.";
    return undefined;
  };

  const screenCard = ({ id, site, shot }, why) => {
    let path = "";
    try {
      path = new URL(shot.pageUrl).pathname;
    } catch {
      path = "";
    }
    return compact({
      id,
      title: `${site.name} ${path}`.trim(),
      url: shot.pageUrl,
      image: `${SITE}${shot.local}?v=${MEDIA_VERSION}`,
      site: site.name,
      pageType: shot.visual?.pageType,
      styles: shot.visual?.style,
      sections: shot.visual?.sections,
      colorMode: site.css?.colorMode,
      fonts: shot.fonts?.length ? shot.fonts : site.fonts,
      colors: shot.colors,
      why,
    });
  };

  function searchScreens(args, queryVector) {
    const { parsed } = engine.parse(args.query);
    const surface = resolveSurface(args.surface, args.query);
    const want = surface ?? parsed.surfaces;
    const W = SCREEN_WEIGHTS;
    const vector = dense && screenRows && queryVector;
    const scored = [];
    for (const x of screens) {
      const v = x.shot.visual || {};
      if (surface && !surface.includes(v.pageType)) continue;
      const why = [];
      let s = 0;
      if (want.includes(v.pageType)) { s += W.surface; why.push(`page type: ${v.pageType}`); }
      const styleHits = parsed.styles.filter((st) => v.style?.includes(st));
      if (parsed.styles.length) s += (W.style * styleHits.length) / parsed.styles.length;
      for (const st of styleHits) why.push(`style: ${st}`);
      if (parsed.mode && x.site.css?.colorMode === parsed.mode) { s += W.mode; why.push(`color mode: ${parsed.mode}`); }
      let sim = null;
      const row = vector ? screenRows.index.get(x.id) : undefined;
      if (row !== undefined) {
        sim = 0;
        for (let j = 0, o = row * screenRows.dims; j < screenRows.dims; j++) sim += screenRows.data[o + j] * queryVector[j];
        s += sim;
      }
      if (sim === null && !why.length) continue;
      scored.push({ x, s, sim, why });
    }
    scored.sort((a, b) => b.s - a.s || a.x.id.localeCompare(b.x.id));
    const perSite = new Map();
    const pages = new Set();
    const top = scored.filter(({ x }) => {
      if (pages.has(x.shot.pageUrl)) return false;
      pages.add(x.shot.pageUrl);
      const n = perSite.get(x.site.slug) || 0;
      perSite.set(x.site.slug, n + 1);
      return n < W.perSite;
    }).slice(0, Math.min(args.limit ?? 8, 25));
    const match = !top.length ? "none" : top[0].why.length ? "strong" : "weak";
    return {
      ...compact({ query: args.query, type: "screens", match, mode: vector ? "hybrid" : "keyword" }),
      results: top.map(({ x, why }) => screenCard(x, why.length ? why : ["look match"])),
      ...compact({
        understood: compact({ surfaces: want, styles: parsed.styles, mode: parsed.mode }),
        hint: match === "none" ? "No screen matches these words. Name a page type, such as pricing or login, or a style, such as brutalist or minimal." : undefined,
      }),
    };
  }

  function search(args, queryVector) {
    if (args.type === "screens") return searchScreens(args, queryVector);
    const filters = filtersOf(args);
    const { res, match, mode } = run(args.query, filters, Math.min(args.limit ?? 8, 25), queryVector);
    return {
      ...compact({ query: args.query, match, mode }),
      results: res.hits.map((h) => card(bySlug.get(h.slug), h, res.parsed)),
      ...compact({
        relaxed: res.relaxed,
        understood: compact({
          components: res.parsed.components,
          surfaces: res.parsed.surfaces,
          styles: res.parsed.styles,
          intent: res.parsed.intent,
          similarTo: res.parsed.reference,
        }),
        hint: hint(match, res.relaxed),
      }),
    };
  }

  function fetchRecord({ id }) {
    const shot = screenById.get(String(id));
    if (shot) {
      const c = screenCard(shot, []);
      return { id: c.id, title: c.title, url: c.url, text: `${c.title}: a ${c.pageType || "page"} screen of ${shot.site.url}.${c.styles ? ` Style: ${c.styles.join(", ")}.` : ""}${c.sections ? ` Sections: ${c.sections.join(", ")}.` : ""}`, metadata: compact({ ...c, id: undefined, title: undefined, url: undefined, siteUrl: shot.site.url, css: shot.site.css }) };
    }
    const slug = String(id).replace(/^https?:\/\/[^/]+\/r\//, "").replace(/\/$/, "");
    const r = bySlug.get(slug);
    if (!r) throw new UsageError(`Index has no record with id "${id}". Use an id from the search results.`);
    const group = r.sameAs ?? r.slug;
    const similar = engine.search(`similar to ${r.name}`, {}, { limit: 8 }).hits
      .map((h) => bySlug.get(h.slug))
      .filter((s) => (s.sameAs ?? s.slug) !== group)
      .slice(0, 5)
      .map((s) => ({ id: s.slug, title: s.name, url: `${SITE}/r/${s.slug}/` }));
    const its = (itemsBy.get(r.slug) || []).filter((i) => i.install).slice(0, 25).map((i) => compact({ name: i.name, title: i.title, component: i.component, install: i.install }));
    const look = lookOf(r);
    const seen = look ? `\nLook, from a screenshot of the site: ${look.styles.join(", ")}${look.colorMode ? `, ${look.colorMode} mode` : ""}.` : "";
    return {
      id: r.slug,
      title: r.name,
      url: `${SITE}/r/${r.slug}/`,
      text: `${recordFacts(r)}${seen}\n\n${r.description}`,
      metadata: compact({
        source: r.url,
        look,
        category: r.category,
        subcategory: r.subcategory,
        kinds: r.kinds,
        tier: r.tier,
        facets: compact(Object.fromEntries(Object.entries(r.facets || {}).map(([k, v]) => [k, known(v)]))),
        components: r.components,
        surfaces: r.surfaces,
        install: r.install,
        package: r.pkg,
        docs: r.docsUrl,
        repo: r.repoUrl,
        registry: r.registryUrl,
        machineUrls: r.machineUrls,
        pricingDetail: r.pricingDetail,
        aliases: r.aliases,
        useCases: r.useCases,
        notFor: r.notFor,
        builtOn: r.builtOn,
        templates: (r.templates || []).slice(0, 10).map((t) => compact({ name: t.name, url: t.url })),
        items: its,
        itemCount: (itemsBy.get(r.slug) || []).length || undefined,
        similar,
        sameAs: r.sameAs,
        verifiedAt: r.verifiedAt,
      }),
    };
  }

  function componentGuide(args, queryVector) {
    const slug = resolve(compMap, args.component, "component");
    const c = compBySlug.get(slug);
    const filters = { ...filtersOf({ ...args, component: undefined }), component: slug };
    const { res, match } = run(args.query || c.name, filters, Math.min(args.limit ?? 6, 15), queryVector);
    return {
      ...compact({
        component: slug,
        name: c.name,
        aliases: (c.aliases || []).slice(0, 8),
        ariaPattern: c.aria_pattern,
        states: c.states,
        checklist: c.checklist,
        checklistSource: c.checklist_source,
        note: c.checklist?.length ? undefined : "Index has no build checklist for this component yet. Use the implementations below as references.",
        match,
      }),
      implementations: res.hits.map((h) => card(bySlug.get(h.slug), h, res.parsed)),
    };
  }

  return {
    search,
    fetch: fetchRecord,
    componentGuide,
    useVectors({ docs, data, dims, weight, minSimilarity, ...plain }) {
      if (!docs) {
        engine = createEngine({ resources, items, taxonomy, vectors: { data, dims, ...plain } });
        dense = true;
        return;
      }
      const rows = docs.map((d, i) => [d, i]).filter(([d]) => RESOURCE_KINDS.has(d.kind) && bySlug.has(d.parent));
      const own = new Float32Array(rows.length * dims);
      rows.forEach(([, i], k) => own.set(data.subarray(i * dims, (i + 1) * dims), k * dims));
      parts = rows.map(([d]) => d);
      engine = createEngine({ resources, items, taxonomy, vectors: { slugs: parts.map((d) => d.parent), labels: parts.map((d) => `${d.kind}: ${d.label}`), dims, data: own, weight, minSimilarity } });
      const shots = docs.map((d, i) => [d, i]).filter(([d]) => d.kind === "screen");
      screenRows = { dims, data, index: new Map(shots.map(([d, i]) => [d.id, i])) };
      dense = true;
    },
    status: () => ({ resources: resources.length, items: items.length, screens: screens.length, dense }),
  };
}

export function schemas(taxonomy) {
  const values = (slug) => taxonomy.facets.find((f) => f.slug === slug).values.map((v) => v.slug).filter((v) => v !== "unknown" && v !== "not-applicable");
  const facets = Object.fromEntries(FILTER_FACETS.map((f) => [f, z.array(z.enum(values(f))).max(8).optional().describe(`Hard filter: only resources with one of these ${f} values.`)]));
  const category = z.enum(taxonomy.categories.map((c) => c.slug)).optional().describe("Boost resources in this category.");
  const component = z.string().min(2).max(80).optional().describe('A UI part, for example "command palette" or "date picker".');
  const surface = z.string().min(2).max(80).optional().describe('A page or flow type, for example "pricing page" or "onboarding".');
  return {
    search: z.object({
      query: z.string().min(2).max(300).describe(`The need in plain words, for example "date range picker with presets". To ask for a look, name a style: ${(taxonomy.styles || []).map((s) => s.name.toLowerCase()).join(", ")}.`),
      type: z.enum(["resources", "screens"]).optional().describe("resources, the default, finds libraries, templates, tools, and references. screens finds real website screenshots by page type and look."),
      ...facets,
      category,
      component,
      surface,
      limit: z.number().int().min(1).max(25).optional().describe("Results to return. The default is 8."),
    }),
    fetch: z.object({ id: z.string().min(1).max(200).describe("A result id from search.") }),
    componentGuide: z.object({
      component: z.string().min(2).max(80).describe('The UI part, for example "combobox".'),
      query: z.string().max(300).optional().describe("Extra words about the need, for example \"async search with keyboard support\"."),
      ...facets,
      limit: z.number().int().min(1).max(15).optional().describe("Implementations to return. The default is 6."),
    }),
  };
}

const ANNOTATIONS = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false };
const RESULTS = z.looseObject({ results: z.array(z.looseObject({ id: z.string(), title: z.string(), url: z.string() })) });
const RECORD = z.looseObject({ id: z.string(), title: z.string(), url: z.string(), text: z.string(), metadata: z.record(z.string(), z.unknown()) });

const reply = (data) => ({ content: [{ type: "text", text: JSON.stringify(data) }], structuredContent: data });
const failure = (error) => {
  if (!(error instanceof UsageError)) throw error;
  return { content: [{ type: "text", text: error.message }], isError: true };
};

export function mcpFactory({ api, embed, taxonomy, version, onCall = () => {} }) {
  const input = schemas(taxonomy);
  return (ctx) => {
    const tier = callerOf(ctx?.requestInfo?.headers?.get?.("cf-connecting-ip") || "").tier;
    const tool = (name, fn) => async (args) => {
      const started = Date.now();
      try {
        const out = await fn(args);
        onCall({ tool: name, args, out, ms: Date.now() - started, tier });
        return reply(out);
      } catch (error) {
        return failure(error);
      }
    };
    const server = new McpServer({ name: "index", title: "Index", version }, { instructions: INSTRUCTIONS });
    server.registerTool("search", {
      title: "Search Index",
      description: "Find design resources in Index for one need. Returns ranked cards with install commands, licenses, and why each one matched, including the matching registry item or template. Filters are hard limits. Words in the query only boost results. Set type to screens to find real website screenshots by page type and look.",
      inputSchema: input.search,
      outputSchema: RESULTS,
      annotations: ANNOTATIONS,
    }, tool("search", async (args) => api.search(args, await embed(args.query))));
    server.registerTool("fetch", {
      title: "Fetch an Index record",
      description: "Get the full Index record for one id from search: install steps, links, facets, registry items, and similar resources.",
      inputSchema: input.fetch,
      outputSchema: RECORD,
      annotations: ANNOTATIONS,
    }, tool("fetch", async (args) => api.fetch(args)));
    server.registerTool("component_guide", {
      title: "Component guide",
      description: "Get the build checklist, states, and ARIA pattern for one UI component, plus the best Index implementations for your stack.",
      inputSchema: input.componentGuide,
      annotations: ANNOTATIONS,
    }, tool("component_guide", async (args) => api.componentGuide(args, await embed(`${args.component} ${args.query || ""}`.trim()))));
    return server;
  };
}

export function createLimiter(perMinute) {
  const buckets = new Map();
  const take = (key, now = Date.now()) => {
    const b = buckets.get(key) ?? { tokens: perMinute, at: now };
    b.tokens = Math.min(perMinute, b.tokens + ((now - b.at) / 60000) * perMinute);
    b.at = now;
    buckets.set(key, b);
    if (b.tokens < 1) return Math.ceil(((1 - b.tokens) / perMinute) * 60);
    b.tokens -= 1;
    return 0;
  };
  const prune = (now = Date.now()) => {
    for (const [key, b] of buckets) if (b.tokens + ((now - b.at) / 60000) * perMinute >= perMinute) buckets.delete(key);
  };
  return { take, prune, size: () => buckets.size };
}

const v6prefix = (ip) => {
  const [head, tail] = ip.includes("::") ? ip.split("::") : [ip, null];
  const a = head ? head.split(":") : [];
  const b = tail ? tail.split(":") : [];
  const full = tail === null ? a : [...a, ...Array(8 - a.length - b.length).fill("0"), ...b];
  return full.slice(0, 4).join(":");
};

export const ipOf = (req) => String(req.headers["cf-connecting-ip"] || req.socket?.remoteAddress || "");

export function callerOf(raw) {
  const ip = raw.replace(/^::ffff:/, "");
  if (/^160\.79\.(10[4-9]|11[01])\./.test(ip)) return { key: "anthropic", tier: "anthropic" };
  return { key: `ip:${ip.includes(":") ? v6prefix(ip) : ip}`, tier: "ip" };
}

export const LIMITS = {
  search: { ip: 30, anthropic: 600 },
  other: { ip: 240, anthropic: 6000 },
};

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, POST, OPTIONS",
  "access-control-allow-headers": "content-type, accept, authorization, mcp-protocol-version, mcp-method, mcp-name, mcp-session-id, last-event-id",
  "access-control-expose-headers": "mcp-protocol-version, mcp-session-id",
};

const send = (res, status, body, headers = {}) => {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", ...CORS, ...headers });
  res.end(JSON.stringify(body));
};

const readBody = (req, max) => new Promise((resolve, reject) => {
  const chunks = [];
  let size = 0;
  req.on("data", (c) => {
    size += c.length;
    if (size > max) {
      reject(new UsageError("The request body is too large."));
      req.destroy();
    } else chunks.push(c);
  });
  req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
  req.on("error", reject);
});

const isSearchCall = (msg) => (Array.isArray(msg) ? msg : [msg]).some((m) => m?.method === "tools/call");

export function createHttpHandler({ api, embed, taxonomy, version, log = () => {}, limits = LIMITS }) {
  const buckets = {
    search: { ip: createLimiter(limits.search.ip), anthropic: createLimiter(limits.search.anthropic) },
    other: { ip: createLimiter(limits.other.ip), anthropic: createLimiter(limits.other.anthropic) },
  };
  setInterval(() => Object.values(buckets).forEach((b) => Object.values(b).forEach((l) => l.prune())), 60000).unref();
  const onCall = ({ tool, args, out, ms, tier }) => log({ tool, query: args.query ?? args.id ?? args.component, filters: compact({ ...args, query: undefined, id: undefined }), match: out.match, mode: out.mode, ids: (out.results || out.implementations || []).map((r) => r.id), ms, tier });
  const mcp = toNodeHandler(createMcpHandler(mcpFactory({ api, embed, taxonomy, version, onCall }), { onerror: (e) => log({ error: String(e?.message || e) }) }));
  const searchSchema = schemas(taxonomy).search;
  const limited = (res, caller, kind, id) => {
    const wait = buckets[kind][caller.tier].take(caller.key);
    if (!wait) return false;
    const message = `Rate limit reached. Try again in ${wait} seconds.`;
    send(res, 429, id === undefined ? { error: message } : { jsonrpc: "2.0", id, error: { code: -32000, message } }, { "retry-after": String(wait) });
    return true;
  };

  return async (req, res) => {
    const url = new URL(req.url, "http://localhost");
    const caller = callerOf(ipOf(req));
    try {
      if (req.method === "OPTIONS") {
        res.writeHead(204, CORS);
        return res.end();
      }
      if (url.pathname === "/health") return send(res, 200, { ok: true, version, ...api.status() });
      if (url.pathname === "/") return send(res, 200, { name: "Index search", mcp: "/mcp", search: "/search?q=date+range+picker&framework=react", docs: `${SITE}/llms.txt` });
      if (url.pathname === "/search" && req.method === "GET") {
        if (limited(res, caller, "search")) return;
        const list = (k) => url.searchParams.get(k)?.split(",").map((s) => s.trim()).filter(Boolean);
        const parsed = searchSchema.safeParse(compact({
          query: url.searchParams.get("q") ?? undefined,
          ...Object.fromEntries(FILTER_FACETS.map((f) => [f, list(f)])),
          category: url.searchParams.get("category") ?? undefined,
          component: url.searchParams.get("component") ?? undefined,
          surface: url.searchParams.get("surface") ?? undefined,
          type: url.searchParams.get("type") ?? undefined,
          limit: url.searchParams.has("limit") ? Number(url.searchParams.get("limit")) : undefined,
        }));
        if (!parsed.success) return send(res, 400, { error: parsed.error.issues.map((i) => `${i.path.join(".") || "q"}: ${i.message}`).join("; ") });
        const started = Date.now();
        const out = api.search(parsed.data, await embed(parsed.data.query));
        log({ tool: "http-search", query: parsed.data.query, filters: compact({ ...parsed.data, query: undefined }), match: out.match, mode: out.mode, ids: (out.results || []).map((r) => r.id), ms: Date.now() - started, tier: caller.tier });
        return send(res, 200, out, { "cache-control": "public, max-age=300" });
      }
      if (url.pathname === "/mcp") {
        if (req.method !== "POST") return mcp(req, res);
        const raw = await readBody(req, 65536);
        let body;
        try {
          body = JSON.parse(raw);
        } catch {
          return send(res, 400, { jsonrpc: "2.0", id: null, error: { code: -32700, message: "The body is not valid JSON." } });
        }
        if (limited(res, caller, isSearchCall(body) ? "search" : "other", Array.isArray(body) ? null : body?.id ?? null)) return;
        req.headers["content-type"] = "application/json";
        return mcp(req, res, body);
      }
      return send(res, 404, { error: "Not found. Use /mcp, /search, or /health." });
    } catch (error) {
      if (error instanceof UsageError) return send(res, 400, { error: error.message });
      log({ error: String(error?.stack || error) });
      if (!res.headersSent) send(res, 500, { error: "The search failed." });
    }
  };
}
