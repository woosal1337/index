"use client";

import Link from "next/link";
import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, m } from "motion/react";
import type { Row } from "../lib/rows";
import { byTierThenName, ROW_FACETS } from "../lib/rows";
import { labelize, tierLabel } from "../lib/text";
import { OA_EVENTS, track } from "../lib/analytics";
import { useShell } from "./ShellProvider";
import { ViewToggle } from "./AppSidebar";
import { Reveal } from "./motion";
import ResourceCard from "./ResourceCard";
import Canvas from "./Canvas";
import { catStyle } from "./primitives";
import { CloseIcon, SearchIcon, SlidersIcon } from "./icons";

type SortKey = "tier" | "name" | "newest" | "components";
type Facet = (typeof ROW_FACETS)[number];

const PAGE = 24;
const TIERS = ["S", "A", "B", "C"] as const;
const MAX_FACET_OPTIONS = 10;
const EASE = [0.2, 0.8, 0.2, 1] as const;

const SORTS: { key: SortKey; label: string }[] = [
  { key: "tier", label: "Quality" },
  { key: "name", label: "Name, A to Z" },
  { key: "newest", label: "Recently checked" },
  { key: "components", label: "Most components" },
];

const FACET_LABEL: Record<Facet, string> = {
  license: "License",
  pricing: "Pricing",
  framework: "Framework",
  distribution: "Distribution",
  agent_readiness: "Agent readiness",
};

const SOURCE_LABEL: Record<Row["source"], string> = {
  bookmark: "Collection",
  depo: "depo.zip",
  canon: "Core",
};

export type BrowserCategory = { slug: string; name: string; description?: string };

function score(r: Row, q: string): number {
  const name = r.name.toLowerCase();
  if (name === q) return 1000;
  if (name.startsWith(q)) return 500;
  if (name.includes(q)) return 300;
  if (r.domain.toLowerCase().includes(q)) return 200;
  if (r.tagline.toLowerCase().includes(q)) return 100;
  if (r.components.some((c) => c.includes(q))) return 80;
  if (r.kinds.some((k) => k.includes(q))) return 60;
  if (r.hay.includes(q)) return 30;
  return -1;
}

function Chip({
  active,
  onClick,
  n,
  title,
  dot,
  sm,
  children,
}: {
  active: boolean;
  onClick: () => void;
  n?: number;
  title?: string;
  dot?: string;
  sm?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      className={`chip${sm ? " sm" : ""}${active ? " is-active" : ""}`}
      aria-pressed={active}
      onClick={onClick}
      title={title}
      style={dot ? catStyle(dot) : undefined}
    >
      {dot && <span className="dot" aria-hidden />}
      {children}
      {n != null && <span className="n">{n.toLocaleString()}</span>}
    </button>
  );
}

export default function Browser({
  rows,
  categories,
  initialCategory,
  showCategories = true,
  facetNames = {},
  categoryNames,
}: {
  rows: Row[];
  categories: BrowserCategory[];
  initialCategory?: string;
  showCategories?: boolean;
  facetNames?: Record<string, Record<string, string>>;
  categoryNames?: Record<string, string>;
}) {
  const { view, setView } = useShell();
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<string | null>(initialCategory ?? null);
  const [tier, setTier] = useState<string | null>(null);
  const [source, setSource] = useState<Row["source"] | null>(null);
  const [facets, setFacets] = useState<Record<string, string[]>>({});
  const [sort, setSort] = useState<SortKey>("tier");
  const [open, setOpen] = useState(false);
  const [shown, setShown] = useState(PAGE);
  const sentinel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.documentElement.setAttribute("data-view", view);
    return () => document.documentElement.removeAttribute("data-view");
  }, [view]);

  const pickCat = (slug: string | null) => {
    if (slug) track(OA_EVENTS.filterChange, { filter: "category", value: slug, enabled: cat !== slug });
    setCat(slug);
  };

  const dq = useDeferredValue(q.trim().toLowerCase());

  const names = useMemo(
    () => categoryNames ?? Object.fromEntries(categories.map((c) => [c.slug, c.name])),
    [categoryNames, categories]
  );

  const catCounts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const r of rows) c[r.category] = (c[r.category] || 0) + 1;
    return c;
  }, [rows]);

  const tierCounts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const r of rows) c[r.tier] = (c[r.tier] || 0) + 1;
    return c;
  }, [rows]);

  const sourceCounts = useMemo(() => {
    const c: Record<Row["source"], number> = { bookmark: 0, depo: 0, canon: 0 };
    for (const r of rows) c[r.source] += 1;
    return c;
  }, [rows]);

  const facetOptions = useMemo(() => {
    const out: Record<string, { value: string; n: number }[]> = {};
    for (const f of ROW_FACETS) {
      const counts: Record<string, number> = {};
      for (const r of rows) {
        for (const val of r.facets[f] || []) {
          if (val === "unknown" || val === "not-applicable") continue;
          counts[val] = (counts[val] || 0) + 1;
        }
      }
      out[f] = Object.entries(counts)
        .map(([value, n]) => ({ value, n }))
        .sort((a, b) => b.n - a.n)
        .slice(0, MAX_FACET_OPTIONS);
    }
    return out;
  }, [rows]);

  const filtered = useMemo(() => {
    let list = rows;
    if (cat) list = list.filter((r) => r.category === cat);
    if (tier) list = list.filter((r) => r.tier === tier);
    if (source) list = list.filter((r) => r.source === source);
    for (const [f, vals] of Object.entries(facets)) {
      if (!vals.length) continue;
      list = list.filter((r) => vals.some((x) => (r.facets[f] || []).includes(x)));
    }
    if (dq) {
      return list
        .map((r) => ({ r, s: score(r, dq) }))
        .filter((x) => x.s >= 0)
        .sort((a, b) => b.s - a.s || byTierThenName(a.r, b.r))
        .map((x) => x.r);
    }
    const sorted = [...list];
    switch (sort) {
      case "name":
        sorted.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case "newest":
        sorted.sort((a, b) => (b.savedAt || "").localeCompare(a.savedAt || "") || byTierThenName(a, b));
        break;
      case "components":
        sorted.sort((a, b) => (b.componentCount ?? 0) - (a.componentCount ?? 0) || byTierThenName(a, b));
        break;
      default:
        sorted.sort(byTierThenName);
    }
    return sorted;
  }, [rows, cat, tier, source, facets, dq, sort]);

  useEffect(() => {
    setShown(PAGE);
  }, [filtered]);

  useEffect(() => {
    if (view !== "grid") return;
    const el = sentinel.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setShown((n) => Math.min(filtered.length, n + PAGE));
        }
      },
      { rootMargin: "700px 0px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [view, filtered.length]);

  const facetName = (f: string, v: string) => facetNames[f]?.[v] ?? labelize(v);

  const toggleFacet = (f: string, v: string) => {
    track(OA_EVENTS.filterChange, { filter: f, value: v, enabled: !(facets[f] || []).includes(v) });
    setFacets((prev) => {
      const cur = prev[f] || [];
      return { ...prev, [f]: cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v] };
    });
  };

  const panelCount = (tier ? 1 : 0) + (source ? 1 : 0) + Object.values(facets).reduce((s, v) => s + v.length, 0);
  const activeCount = panelCount + (cat && showCategories ? 1 : 0) + (dq ? 1 : 0);

  const clearAll = () => {
    setCat(showCategories ? null : (initialCategory ?? null));
    setTier(null);
    setSource(null);
    setFacets({});
    setQ("");
  };

  const active: { key: string; label: string; remove: () => void }[] = [];
  if (tier) active.push({ key: "tier", label: `Quality ${tier}`, remove: () => setTier(null) });
  if (source) active.push({ key: "source", label: SOURCE_LABEL[source], remove: () => setSource(null) });
  for (const [f, vals] of Object.entries(facets)) {
    for (const v of vals) {
      active.push({ key: `${f}:${v}`, label: `${FACET_LABEL[f as Facet]}: ${facetName(f, v)}`, remove: () => toggleFacet(f, v) });
    }
  }

  const catInfo = cat ? categories.find((c) => c.slug === cat) : undefined;
  const hasOrigin = sourceCounts.depo > 0 || sourceCounts.canon > 0;
  const sections: Row[][] = [];
  for (let i = 0; i < Math.min(shown, filtered.length); i += PAGE) sections.push(filtered.slice(i, i + PAGE));

  return (
    <div className="browse" id="browse">
      <div className="toolbar">
        <label className="tool-search">
          <SearchIcon />
          <span className="sr-only">Search these resources</span>
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Filter by name, domain, or component"
            className="input"
          />
        </label>

        <label className="select">
          <span className="sr-only">Sort</span>
          <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)} aria-label="Sort resources">
            {SORTS.map((x) => (
              <option key={x.key} value={x.key}>
                Sort: {x.label}
              </option>
            ))}
          </select>
        </label>

        <button
          type="button"
          className={`btn${open ? " is-active" : ""}`}
          aria-expanded={open}
          aria-controls="filter-panel"
          onClick={() => setOpen((v) => !v)}
        >
          <SlidersIcon />
          Filters
          {panelCount > 0 && <span className="n">{panelCount}</span>}
        </button>

        <ViewToggle view={view} onChange={setView} lg />

        <span className="count" aria-live="polite" aria-atomic>
          {filtered.length.toLocaleString()} / {rows.length.toLocaleString()}
          {dq ? " · best match first" : ""}
        </span>
      </div>

      {showCategories && (
        <div className="chips" role="group" aria-label="Categories">
          <Chip active={!cat} onClick={() => pickCat(null)} n={rows.length}>
            All
          </Chip>
          {categories.map((c) => (
            <Chip
              key={c.slug}
              active={cat === c.slug}
              dot={c.slug}
              n={catCounts[c.slug] ?? 0}
              title={c.description}
              onClick={() => pickCat(cat === c.slug ? null : c.slug)}
            >
              {c.name}
            </Chip>
          ))}
        </div>
      )}

      <AnimatePresence initial={false}>
        {open && (
          <m.div
            key="filters"
            id="filter-panel"
            className="filter-panel"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: EASE }}
          >
            <div className="filter-panel-inner">
              <div className="filter-group">
                <div className="filter-label">
                  <span>Quality tier</span>
                </div>
                <div className="filter-chips">
                  {TIERS.map((t) => (
                    <Chip key={t} sm active={tier === t} n={tierCounts[t] ?? 0} title={tierLabel(t)} onClick={() => setTier(tier === t ? null : t)}>
                      {t} · {tierLabel(t)}
                    </Chip>
                  ))}
                </div>
              </div>

              {hasOrigin && (
                <div className="filter-group">
                  <div className="filter-label">
                    <span>Origin</span>
                  </div>
                  <div className="filter-chips">
                    {(Object.keys(SOURCE_LABEL) as Row["source"][]).map((key) =>
                      sourceCounts[key] > 0 ? (
                        <Chip key={key} sm active={source === key} n={sourceCounts[key]} onClick={() => setSource(source === key ? null : key)}>
                          {SOURCE_LABEL[key]}
                        </Chip>
                      ) : null
                    )}
                  </div>
                </div>
              )}

              {ROW_FACETS.map((f) => {
                const opts = facetOptions[f] || [];
                if (!opts.length) return null;
                return (
                  <div key={f} className="filter-group">
                    <div className="filter-label">
                      <span>{FACET_LABEL[f]}</span>
                    </div>
                    <div className="filter-chips">
                      {opts.map((o) => (
                        <Chip key={o.value} sm active={(facets[f] || []).includes(o.value)} n={o.n} onClick={() => toggleFacet(f, o.value)}>
                          {facetName(f, o.value)}
                        </Chip>
                      ))}
                    </div>
                  </div>
                );
              })}

              <div className="filter-foot">
                <span>
                  {filtered.length.toLocaleString()} {filtered.length === 1 ? "result" : "results"}
                </span>
                {activeCount > 0 && (
                  <button type="button" className="link" onClick={clearAll}>
                    Clear all filters
                  </button>
                )}
                <button type="button" className="link ml-auto" onClick={() => setOpen(false)}>
                  Close
                </button>
              </div>
            </div>
          </m.div>
        )}
      </AnimatePresence>

      {(active.length > 0 || catInfo) && !open && (
        <div className="active-filters">
          {catInfo && showCategories && (
            <Link href={`/categories/${catInfo.slug}`} className="chip sm" style={catStyle(catInfo.slug)} title="Open the category page">
              <span className="dot" aria-hidden />
              {catInfo.name}
            </Link>
          )}
          {active.map((f) => (
            <button key={f.key} type="button" className="chip sm is-active" onClick={f.remove} title="Remove this filter">
              {f.label}
              <CloseIcon />
            </button>
          ))}
          {activeCount > 0 && (
            <button type="button" className="link" onClick={clearAll}>
              Clear all
            </button>
          )}
        </div>
      )}

      <AnimatePresence mode="wait" initial={false}>
        {view === "grid" ? (
          <m.div
            key="grid"
            className="browse-body"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
          >
            {filtered.length === 0 ? (
              <p className="empty">Nothing matches these filters.</p>
            ) : (
              sections.map((chunk, i) => (
                <Reveal key={`${chunk[0].slug}-${i}`} className="section">
                  <ul className="section-grid">
                    {chunk.map((r) => (
                      <li key={r.slug}>
                        <ResourceCard item={r} categoryName={names[r.category]} />
                      </li>
                    ))}
                  </ul>
                </Reveal>
              ))
            )}
            <div ref={sentinel} className="feed-more" aria-live="polite">
              {filtered.length === 0
                ? ""
                : shown < filtered.length
                  ? `${Math.min(shown, filtered.length).toLocaleString()} of ${filtered.length.toLocaleString()} loaded`
                  : `All ${filtered.length.toLocaleString()} shown`}
            </div>
          </m.div>
        ) : (
          <m.div
            key="canvas"
            className="browse-body is-canvas"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
          >
            <Canvas items={filtered} categoryNames={names} />
          </m.div>
        )}
      </AnimatePresence>
    </div>
  );
}
