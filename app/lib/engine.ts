import { acceptsMap, checkFilters, FILTER_FACETS, type Accepts, type Filters } from "./search.ts";
import { findAll, normalize, vocabMap, type Vocab, type VocabEntry } from "./vocab.ts";

type FacetValues = Record<string, string[] | string>;

export type EngineResource = {
  slug: string;
  name: string;
  tagline: string;
  description: string;
  agentGuidance: string;
  category: string;
  subcategory: string;
  kinds: string[];
  facets: FacetValues;
  components: string[];
  surfaces: string[];
  notableFor: string[];
  pkg: string | null;
  repoUrl: string | null;
  domain: string;
  tier: string;
  templates: { name: string; purpose?: string }[];
  sameAs: string | null;
  signals?: { stars: number | null; archived: boolean; deprecated: boolean };
  aliases?: string[];
  summary?: string | null;
  useCases?: string[];
  exampleQueries?: string[];
  profile?: Record<string, unknown>;
  scope?: string | null;
  visual?: { style?: string[]; colorMode?: string } | null;
};

export type EngineItem = { resource: string; name: string; title: string | null; component: string | null; surface: string | null };

export type EngineTaxonomy = {
  facets: { slug: string; values: (VocabEntry & { accepts?: string[] })[] }[];
  components: VocabEntry[];
  surfaces: VocabEntry[];
  kinds: VocabEntry[];
  styles?: VocabEntry[];
  categories: { slug: string; name: string; subcategories?: { slug: string; name: string }[] }[];
};

export type EngineVectors = { slugs: string[]; dims: number; data: Float32Array; labels?: string[]; weight?: number; minSimilarity?: number };

export type Hit = { slug: string; score: number; why: string[]; via?: number };
export type SearchResult = { hits: Hit[]; abstained: boolean; relaxed: string[]; parsed: Parsed; evidence: number; similarity: number | null };
type Parsed = {
  intent: "inspire" | "learn" | null;
  reference: string | null;
  components: string[];
  surfaces: string[];
  kinds: string[];
  styles: string[];
  mode: "dark" | "light" | null;
  prefer: Partial<Record<(typeof FILTER_FACETS)[number], string[]>>;
  avoid: Partial<Record<(typeof FILTER_FACETS)[number], string[]>>;
  avoidTerms: string[];
  facetWords: string[];
};

const FIELDS = { name: 5, ids: 4, tagline: 3, vocab: 3, kinds: 2, notable: 1.5, queries: 1.5, items: 1.2, templates: 1, body: 1 } as const;
type Field = keyof typeof FIELDS;
const K1 = 1.2;
const B = 0.75;

export const WEIGHTS = {
  lexical: 1,
  component: 0.2,
  surface: 0.3,
  kind: 0.15,
  categoryMatch: 0.6,
  categoryMiss: -0.25,
  prefMet: 0.25,
  prefMiss: -0.15,
  avoid: -0.6,
  unverified: -0.03,
  tier: { S: 0.12, A: 0.08, B: 0.03, C: 0 } as Record<string, number>,
  stars: 0.05,
  ready: 0.06,
  style: 1.2,
  mode: 0.1,
  dead: -0.6,
  stale: -0.1,
  generalTool: -0.1,
  intent: 0.35,
  similarComponents: 0.5,
  similarSubcategory: 0.25,
  coverage: 0.75,
  entityEvidence: 0.5,
  abstain: 0.45,
  sureEvidence: 1,
  minSimilarity: 0.603,
  dense: 0.25,
  rrfK: 60,
};

const READY = new Set(["mcp-server", "agent-skill", "registry-json", "cli-installable", "llms-txt"]);
const STOPWORDS = new Set("a an the for with and or of to in on at by my our your i me we is are be it its this that from into as".split(" "));
const stem = (w: string) => {
  if (w.length > 4 && w.endsWith("ies")) return `${w.slice(0, -3)}y`;
  if (/(ss|us|is)$/.test(w)) return w;
  if (w.length > 3 && /(s|x|ch|sh)es$/.test(w)) return w.slice(0, -2);
  if (w.length > 3 && w.endsWith("s")) return w.slice(0, -1);
  return w;
};

export function tokens(text: string): string[] {
  const words = normalize(text).split(" ").filter((w) => w && !STOPWORDS.has(w)).map(stem);
  const pairs = words.slice(1).map((w, i) => words[i] + w);
  return [...words, ...pairs];
}

const asList = (v: string[] | string | undefined) => (Array.isArray(v) ? v : v ? [v] : []);

function editDistanceAtMost(a: string, b: string, max: number) {
  if (Math.abs(a.length - b.length) > max) return false;
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    let best = i;
    for (let j = 1; j <= b.length; j++) {
      row[j] = Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      best = Math.min(best, row[j]);
    }
    if (best > max) return false;
    prev = row;
  }
  return prev[b.length] <= max;
}

export function createEngine({ resources, items, taxonomy, vectors }: { resources: EngineResource[]; items: EngineItem[]; taxonomy: EngineTaxonomy; vectors?: EngineVectors }) {
  const accepts: Accepts = acceptsMap(taxonomy.facets);
  const compBySlug = new Map(taxonomy.components.map((c) => [c.slug, c]));
  const surfBySlug = new Map(taxonomy.surfaces.map((s) => [s.slug, s]));
  const kindBySlug = new Map(taxonomy.kinds.map((k) => [k.slug, k]));
  const catName = new Map(taxonomy.categories.flatMap((c) => [[c.slug, c.name], ...(c.subcategories || []).map((s) => [s.slug, s.name])]) as [string, string][]);
  const label = (e: VocabEntry | undefined) => (e ? [e.name || e.slug, ...(e.aliases || [])].join(" ") : "");

  const maps = {
    component: vocabMap(taxonomy.components),
    surface: vocabMap(taxonomy.surfaces, (s) => [String(s.name || "").replace(/\(.*?\)/g, "")]),
    kind: vocabMap(taxonomy.kinds),
    style: vocabMap(taxonomy.styles || []),
    facet: Object.fromEntries(FILTER_FACETS.map((f) => [f, vocabMap(taxonomy.facets.find((x) => x.slug === f)?.values.filter((v) => v.slug !== "unknown" && v.slug !== "not-applicable") || [])])) as Record<string, Vocab>,
  };

  const itemsBy = new Map<string, EngineItem[]>();
  for (const it of items) itemsBy.set(it.resource, [...(itemsBy.get(it.resource) || []), it]);

  const docs = resources.map((r) => {
    const its = itemsBy.get(r.slug) || [];
    const components = new Set([...r.components, ...its.map((i) => i.component).filter((c): c is string => Boolean(c))]);
    const surfaces = new Set([...r.surfaces, ...its.map((i) => i.surface).filter((s): s is string => Boolean(s))]);
    const unique = (s: string) => [...new Set(tokens(s))];
    const text: Record<Field, string[]> = {
      name: tokens(`${r.name} ${r.slug.replace(/-/g, " ")} ${(r.aliases || []).join(" ")}`),
      ids: tokens(`${r.pkg || ""} ${(r.repoUrl || "").replace(/^https?:\/\/(www\.)?github\.com\//, "")} ${r.domain}`),
      tagline: tokens(`${r.tagline} ${r.summary || ""}`),
      vocab: tokens([...components].map((c) => label(compBySlug.get(c))).concat([...surfaces].map((s) => label(surfBySlug.get(s))), catName.get(r.category) || "", catName.get(r.subcategory) || "").join(" ")),
      kinds: tokens(`${r.kinds.map((k) => label(kindBySlug.get(k))).join(" ")} ${Object.values(r.profile || {}).flat().filter((v) => typeof v === "string").join(" ")}`),
      notable: tokens(r.notableFor.join(" ")),
      queries: unique((r.exampleQueries || []).join(" ")),
      items: unique(its.map((i) => `${i.name.replace(/-/g, " ")} ${i.title || ""}`).join(" ")),
      templates: unique(r.templates.map((t) => `${t.name} ${t.purpose || ""}`).join(" ")),
      body: tokens(`${r.description} ${r.agentGuidance} ${(r.useCases || []).join(" ")}`),
    };
    return { r, components, surfaces, text };
  });

  const vectorRows = new Map<string, number[]>();
  vectors?.slugs.forEach((s, i) => vectorRows.set(s, [...(vectorRows.get(s) || []), i]));
  const denseWeight = vectors?.weight ?? WEIGHTS.dense;
  const minSimilarity = vectors?.minSimilarity ?? WEIGHTS.minSimilarity;
  const avgLen = Object.fromEntries((Object.keys(FIELDS) as Field[]).map((f) => [f, docs.reduce((s, d) => s + d.text[f].length, 0) / docs.length || 1])) as Record<Field, number>;
  const postings = new Map<string, [number, number][]>();
  docs.forEach((d, i) => {
    const tf = new Map<string, number>();
    for (const f of Object.keys(FIELDS) as Field[]) {
      const norm = 1 - B + (B * d.text[f].length) / avgLen[f];
      for (const t of d.text[f]) tf.set(t, (tf.get(t) || 0) + FIELDS[f] / norm);
    }
    for (const [t, w] of tf) {
      if (!postings.has(t)) postings.set(t, []);
      postings.get(t)!.push([i, w]);
    }
  });
  const vocabulary = [...postings.keys()];
  const idf = (t: string) => {
    const df = postings.get(t)?.length || 0;
    return Math.log(1 + (docs.length - df + 0.5) / (df + 0.5));
  };
  const correct = (t: string) => {
    if (postings.has(t) || t.length < 5) return t;
    const max = t.length >= 8 ? 2 : 1;
    let best: string | null = null;
    for (const v of vocabulary) {
      if (v[0] !== t[0] || !editDistanceAtMost(t, v, max)) continue;
      if (!best || (postings.get(v)!.length > postings.get(best)!.length)) best = v;
    }
    return best ?? t;
  };

  const byName = new Map<string, number>();
  docs.forEach((d, i) => {
    for (const k of [normalize(d.r.name), d.r.slug.replace(/-/g, " ")]) if (!byName.has(k)) byName.set(k, i);
  });
  const reference = (phrase: string) => {
    const words = phrase.split(" ");
    for (let n = words.length; n > 0; n--) {
      const k = words.slice(0, n).join(" ");
      for (const key of [k, `${k} ui`, `${k} js`]) if (byName.has(key)) return { doc: byName.get(key)!, text: k };
    }
    return null;
  };
  const IMPLEMENT = /\b(template|templates|starter|kit|component|components|library|block|blocks|code|install|npm|react|vue|svelte|next|nextjs|tailwind|shadcn|hook|package|sdk|api)\b/;
  const INSPIRE = /\b(pages|screens|sites|websites|examples|inspiration|showcase|references|homepages|dashboards|landing pages|designs)\b/;
  const LEARN = /\b(how to|principles|best practices|guidelines|explained|tips|theory|laws of|what is)\b/;

  function parse(query: string): { parsed: Parsed; text: string } {
    const norm = normalize(query);
    const negations = [...norm.matchAll(/\b(?:no|not|without|avoid|except|non)\s+([a-z0-9]+(?:\s[a-z0-9]+)?)/g)];
    const avoidPhrases = negations.map((m) => m[1]);
    let text = negations.reduce((t, m) => t.replace(m[0], " "), norm);
    const like = text.match(/\b(?:like|similar to|alternative to|alternatives to|instead of)\s+([a-z0-9][a-z0-9 ]*?)(?=\s+(?:but|that|with|for|and)\b|$)/);
    const ref = like ? reference(like[1].trim()) : null;
    if (like && ref) text = text.replace(like[0], " ").replace(/\b(but|that|lighter|smaller|cheaper|better)\b/g, " ");
    const avoid: Parsed["avoid"] = {};
    for (const phrase of avoidPhrases) {
      for (const f of FILTER_FACETS) {
        const hits = findAll(maps.facet[f], phrase, new Set()).map((h) => h.slug);
        if (hits.length) avoid[f] = [...(avoid[f] || []), ...hits];
      }
    }
    const prefer: Parsed["prefer"] = {};
    const facetWords: string[] = [];
    for (const f of FILTER_FACETS) {
      const found = findAll(maps.facet[f], text);
      if (found.length) prefer[f] = [...new Set(found.map((h) => h.slug))];
      for (const h of found) facetWords.push(...tokens(h.text));
    }
    const styleHits = findAll(maps.style, text);
    const kindHits = findAll(maps.kind, text);
    const surfaces = [...new Set(findAll(maps.surface, text).map((h) => h.slug))];
    const learn = LEARN.test(norm);
    const inspire = !learn && !IMPLEMENT.test(norm) && (surfaces.length > 0 || INSPIRE.test(norm));
    return {
      text,
      parsed: {
        intent: learn ? "learn" : inspire ? "inspire" : null,
        reference: ref ? docs[ref.doc].r.slug : null,
        components: [...new Set(findAll(maps.component, text).map((h) => h.slug))],
        surfaces,
        kinds: [...new Set([...kindHits.map((h) => h.slug), ...(ref ? docs[ref.doc].r.kinds : [])])],
        styles: [...new Set(styleHits.map((h) => h.slug))],
        mode: /\bdark\b/.test(norm) ? "dark" : /\blight\b/.test(norm) ? "light" : null,
        prefer,
        avoid,
        avoidTerms: [...new Set(avoidPhrases.flatMap((p) => tokens(p)))],
        facetWords: [...new Set(facetWords)],
      },
    };
  }

  function facetState(r: EngineResource, f: string, want: string[]) {
    const have = asList(r.facets?.[f]);
    if (have.includes("not-applicable")) return "na";
    const known = have.filter((v) => v !== "unknown");
    if (!known.length) return "unknown";
    return want.some((w) => known.some((v) => accepts.get(f)?.get(w)?.has(v) ?? v === w)) ? "met" : "miss";
  }

  function search(query: string, filters: Filters = {}, { limit = 10, queryVector }: { limit?: number; queryVector?: ArrayLike<number> } = {}): SearchResult {
    const { parsed, text } = parse(query);
    if (filters.component) parsed.components = [...new Set([filters.component, ...parsed.components])];
    if (filters.surface) parsed.surfaces = [...new Set([filters.surface, ...parsed.surfaces])];
    const words = normalize(text).split(" ").filter((w) => w && !STOPWORDS.has(w)).map(stem).map(correct);
    const singles = new Set(words);
    const qTokens = [...new Set([...words, ...words.slice(1).map((w, i) => words[i] + w)])];

    const lex = new Map<number, number>();
    const covered = new Map<number, number>();
    const content = new Set([...singles].filter((t) => !parsed.facetWords.includes(t)));
    const queryMass = [...content].reduce((m, t) => m + idf(t), 0) || 1;
    for (const t of qTokens) {
      const w = idf(t);
      for (const [i, tf] of postings.get(t) || []) {
        lex.set(i, (lex.get(i) || 0) + (w * tf) / (K1 + tf));
        if (content.has(t)) covered.set(i, (covered.get(i) || 0) + w);
      }
    }
    const maxLex = Math.max(0, ...lex.values()) || 1;

    const refDoc = parsed.reference ? docs.find((d) => d.r.slug === parsed.reference)! : null;
    const refGroup = refDoc ? refDoc.r.sameAs ?? refDoc.r.slug : null;
    const candidates = new Set<number>(lex.keys());
    docs.forEach((d, i) => {
      if (parsed.components.some((c) => d.components.has(c)) || parsed.surfaces.some((s) => d.surfaces.has(s))) candidates.add(i);
      if (refDoc && d.r.subcategory === refDoc.r.subcategory) candidates.add(i);
    });
    if (refGroup) for (const i of [...candidates]) if ((docs[i].r.sameAs ?? docs[i].r.slug) === refGroup) candidates.delete(i);

    const hard: (typeof FILTER_FACETS)[number][] = FILTER_FACETS.filter((f) => filters[f]?.length);
    const relaxOrder = ["styling", "license", "pricing", "platform", "framework"] as const;
    let active = [...hard];
    const relaxed: string[] = [];
    const passing = () => [...candidates].filter((i) => checkFilters(docs[i].r, Object.fromEntries(active.map((f) => [f, filters[f]])), accepts) !== "violated");
    let pool = passing();
    for (const f of relaxOrder) {
      if (pool.length || !active.includes(f)) continue;
      active = active.filter((x) => x !== f);
      relaxed.push(f);
      pool = passing();
    }

    const scored = pool.map((i) => {
      const d = docs[i];
      const r = d.r;
      const why: string[] = [];
      const coverage = Math.min(1, (covered.get(i) || 0) / queryMass);
      let s = WEIGHTS.lexical * ((lex.get(i) || 0) / maxLex) + WEIGHTS.coverage * coverage;
      const compHits = parsed.components.filter((c) => d.components.has(c));
      if (parsed.components.length) s += (WEIGHTS.component * compHits.length) / parsed.components.length;
      for (const c of compHits) why.push(`component: ${c}`);
      const surfHits = parsed.surfaces.filter((x) => d.surfaces.has(x));
      if (parsed.surfaces.length) s += (WEIGHTS.surface * surfHits.length) / parsed.surfaces.length;
      for (const x of surfHits) why.push(`surface: ${x}`);
      const styleHits = parsed.styles.filter((x) => r.visual?.style?.includes(x));
      if (parsed.styles.length) s += (WEIGHTS.style * styleHits.length) / parsed.styles.length;
      for (const x of styleHits) why.push(`style: ${x}`);
      if (parsed.mode && r.visual?.colorMode === parsed.mode) s += WEIGHTS.mode;
      if (parsed.kinds.some((k) => r.kinds.includes(k))) {
        s += WEIGHTS.kind;
        why.push(`kind: ${parsed.kinds.filter((k) => r.kinds.includes(k)).join(", ")}`);
      }
      if (filters.category) s += r.category === filters.category ? WEIGHTS.categoryMatch : WEIGHTS.categoryMiss;
      if (parsed.intent === "inspire" && (r.category === "inspiration-galleries" || r.kinds.includes("gallery"))) { s += WEIGHTS.intent; why.push("intent: inspiration"); }
      if (parsed.intent === "learn" && (r.category === "essays-guides-courses" || r.kinds.some((k) => ["article", "course", "reference", "checklist"].includes(k)))) { s += WEIGHTS.intent; why.push("intent: learn"); }
      if (refDoc) {
        const shared = [...d.components].filter((c) => refDoc.components.has(c)).length;
        const union = new Set([...d.components, ...refDoc.components]).size || 1;
        s += WEIGHTS.similarComponents * (shared / union);
        if (r.subcategory === refDoc.r.subcategory) s += WEIGHTS.similarSubcategory;
        why.push(`similar to: ${refDoc.r.slug}`);
      }
      for (const f of FILTER_FACETS) {
        const want = filters[f]?.length ? filters[f]! : parsed.prefer[f];
        if (want?.length) {
          const st = facetState(r, f, want);
          if (st === "met") { s += WEIGHTS.prefMet; why.push(`${f}: ${want.join("|")}`); }
          else if (st === "miss") s += WEIGHTS.prefMiss;
          else if (st === "unknown") s += WEIGHTS.unverified;
        }
        if (parsed.avoid[f]?.length && facetState(r, f, parsed.avoid[f]!) === "met") s += WEIGHTS.avoid;
      }
      if (parsed.avoidTerms.length && parsed.avoidTerms.some((t) => d.text.name.includes(t) || d.text.tagline.includes(t) || d.text.notable.includes(t))) s += WEIGHTS.avoid / 2;
      s += WEIGHTS.tier[r.tier] ?? 0;
      s += WEIGHTS.stars * Math.min(1, Math.log10(1 + (r.signals?.stars ?? 0)) / 5);
      if (asList(r.facets?.agent_readiness).some((v) => READY.has(v))) s += WEIGHTS.ready;
      if (asList(r.facets?.maturity).includes("dead-link")) s += WEIGHTS.dead;
      if (r.signals?.archived || r.signals?.deprecated) s += WEIGHTS.stale;
      if (r.scope === "general-tool") s += WEIGHTS.generalTool;
      return { slug: r.slug, group: r.sameAs ?? r.slug, score: s, why, evidence: coverage + (compHits.length || surfHits.length || styleHits.length || refDoc ? WEIGHTS.entityEvidence : 0), styled: styleHits.length > 0 };
    });

    scored.sort((a, b) => b.score - a.score || a.slug.localeCompare(b.slug));
    const best = scored[0];
    const collapse = <T extends { group: string }>(list: T[]) => {
      const seen = new Set<string>();
      return list.filter((h) => !seen.has(h.group) && seen.add(h.group));
    };
    let ranked: { slug: string; group: string; score: number; why: string[]; via?: number }[] = collapse(scored);
    let similarity: number | null = null;
    if (queryVector && vectors) {
      const allowed = Object.fromEntries(active.map((f) => [f, filters[f]]));
      const dense: { i: number; dot: number; via: number }[] = [];
      docs.forEach((d, i) => {
        const rows = vectorRows.get(d.r.slug);
        if (!rows || (refGroup && (d.r.sameAs ?? d.r.slug) === refGroup) || checkFilters(d.r, allowed, accepts) === "violated") return;
        let best = -Infinity;
        let via = rows[0];
        for (const row of rows) {
          let dot = 0;
          for (let j = 0, o = row * vectors.dims; j < vectors.dims; j++) dot += vectors.data[o + j] * queryVector[j];
          if (dot > best) {
            best = dot;
            via = row;
          }
        }
        dense.push({ i, dot: best, via });
      });
      dense.sort((a, b) => b.dot - a.dot);
      similarity = dense[0]?.dot ?? null;
      const fused = new Map(ranked.slice(0, 100).map((h, rank) => [h.slug, { ...h, score: WEIGHTS.lexical / (WEIGHTS.rrfK + rank + 1) }]));
      dense.slice(0, 100).forEach(({ i, via }, rank) => {
        const r = docs[i].r;
        const add = denseWeight / (WEIGHTS.rrfK + rank + 1);
        const prev = fused.get(r.slug);
        const label = vectors.labels?.[via];
        const part = label && !label.startsWith("resource:") ? via : undefined;
        if (prev) {
          prev.score += add;
          if (part !== undefined && rank < 10) Object.assign(prev, { why: [...prev.why, `meaning match: ${label}`], via: part });
        } else fused.set(r.slug, { slug: r.slug, group: r.sameAs ?? r.slug, score: add, why: [part !== undefined ? `meaning match: ${label}` : "meaning match"], via: part });
      });
      ranked = collapse([...fused.values()].sort((a, b) => b.score - a.score || a.slug.localeCompare(b.slug)));
    }
    const hits: Hit[] = ranked.slice(0, limit).map((h) => ({ slug: h.slug, score: Number(h.score.toFixed(5)), why: h.why, ...(h.via !== undefined && { via: h.via }) }));
    const weak = !refDoc && !scored.some((h) => h.styled) && similarity !== null && best && best.evidence < WEIGHTS.sureEvidence && similarity < minSimilarity;
    const abstained = !best || best.evidence < WEIGHTS.abstain || Boolean(weak);
    return { hits: abstained ? [] : hits, abstained, relaxed, parsed, evidence: best?.evidence ?? 0, similarity };
  }

  return { search, parse, size: docs.length };
}
