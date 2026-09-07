"use client";

import { useDeferredValue, useEffect, useMemo, useState } from "react";
import type { Row } from "../lib/rows";
import { byTierThenName, ROW_FACETS } from "../lib/rows";
import { labelize } from "../lib/text";
import ResourceGrid from "./ResourceGrid";
import ResourceList from "./ResourceList";
import { Btn } from "./primitives";

type SortKey = "relevance" | "tier" | "name" | "newest" | "components";

type View = "grid" | "list";
const VIEW_KEY = "di-view";

const SORTS: { key: SortKey; label: string }[] = [
  { key: "tier", label: "Quality" },
  { key: "name", label: "A–Z" },
  { key: "newest", label: "Recently checked" },
  { key: "components", label: "Most components" },
];

const FACET_LABEL: Record<(typeof ROW_FACETS)[number], string> = {
  license: "License",
  pricing: "Pricing",
  framework: "Framework",
  distribution: "Distribution",
  agent_readiness: "Agent-ready",
};

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

export default function Browser({
  rows,
  categories,
  initialCategory,
  showCategories = true,
  facetNames = {},
}: {
  rows: Row[];
  categories: { slug: string; name: string }[];
  initialCategory?: string;
  showCategories?: boolean;

  facetNames?: Record<string, Record<string, string>>;
}) {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<string | null>(initialCategory ?? null);
  const [tier, setTier] = useState<string | null>(null);
  const [source, setSource] = useState<Row["source"] | null>(null);
  const [facets, setFacets] = useState<Record<string, string[]>>({});
  const [sort, setSort] = useState<SortKey>("tier");
  const [more, setMore] = useState(false);
  const [view, setView] = useState<View>("grid");

  useEffect(() => {
    if (localStorage.getItem(VIEW_KEY) === "list") setView("list");
  }, []);

  const pickView = (next: View) => {
    setView(next);
    if (next === "list") localStorage.setItem(VIEW_KEY, "list");
    else localStorage.removeItem(VIEW_KEY);
  };
  const dq = useDeferredValue(q.trim().toLowerCase());

  const catCounts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const r of rows) c[r.category] = (c[r.category] || 0) + 1;
    return c;
  }, [rows]);

  const sourceCounts = useMemo(
    () => ({
      bookmark: rows.filter((r) => r.source === "bookmark").length,
      depo: rows.filter((r) => r.source === "depo").length,
      canon: rows.filter((r) => r.source === "canon").length,
    }),
    [rows]
  );

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
        .slice(0, 12);
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

  const toggleFacet = (f: string, v: string) =>
    setFacets((prev) => {
      const cur = prev[f] || [];
      return { ...prev, [f]: cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v] };
    });

  const moreCount = (tier ? 1 : 0) + (source ? 1 : 0) + Object.values(facets).reduce((s, v) => s + v.length, 0);
  const activeCount = moreCount + (cat && showCategories ? 1 : 0) + (dq ? 1 : 0);

  const clearAll = () => {
    setCat(showCategories ? null : (initialCategory ?? null));
    setTier(null);
    setSource(null);
    setFacets({});
    setQ("");
  };

  const searchField = (
    <input
      type="search"
      value={q}
      onChange={(e) => setQ(e.target.value)}
      placeholder="Search here…"
      aria-label="Search resources"
      className="input w-full sm:w-[220px]"
    />
  );
  const sortSelect = (
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
  );
  const moreButton = (
    <Btn onClick={() => setMore((v) => !v)} ariaExpanded={more} active={more} n={moreCount || undefined}>
      More filters
    </Btn>
  );
  const clearButton = (
    <Btn onClick={clearAll} disabled={activeCount === 0}>
      Clear all
    </Btn>
  );
  const viewToggle = (
    <div className="flex gap-1" role="group" aria-label="View">
      <Btn active={view === "grid"} onClick={() => pickView("grid")} title="Show thumbnails, two to a row">
        Grid
      </Btn>
      <Btn active={view === "list"} onClick={() => pickView("list")} title="Show one line per resource">
        List
      </Btn>
    </div>
  );
  const count = (
    <span className="label ml-auto tnum" aria-live="polite" aria-atomic>
      {filtered.length.toLocaleString()} / {rows.length.toLocaleString()}
    </span>
  );

  return (
    <div>
      {showCategories ? (
        <>
          <div className="flex flex-wrap gap-2">
            {searchField}
            {categories.map((c) => (
              <Btn
                key={c.slug}
                dot={c.slug}
                n={catCounts[c.slug]}
                active={cat === c.slug}
                onClick={() => setCat(cat === c.slug ? null : c.slug)}
              >
                {c.name}
              </Btn>
            ))}
            {clearButton}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {sortSelect}
            {moreButton}
            {viewToggle}
            {count}
          </div>
        </>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          {searchField}
          {sortSelect}
          {moreButton}
          {viewToggle}
          {clearButton}
          {count}
        </div>
      )}

      {more && (
        <div className="mt-3 space-y-2.5 border-t border-line pt-3">
          <FilterRow label="Quality">
            {(["S", "A", "B", "C"] as const).map((t) => (
              <Btn key={t} sm active={tier === t} onClick={() => setTier(tier === t ? null : t)}>
                {t}
              </Btn>
            ))}
          </FilterRow>

          {(sourceCounts.depo > 0 || sourceCounts.canon > 0) && (
            <FilterRow label="Origin">
              {(
                [
                  ["bookmark", "Collection", sourceCounts.bookmark],
                  ["depo", "depo.zip", sourceCounts.depo],
                  ["canon", "Core", sourceCounts.canon],
                ] as const
              ).map(([key, label, n]) =>
                n > 0 ? (
                  <Btn key={key} sm n={n} active={source === key} onClick={() => setSource(source === key ? null : key)}>
                    {label}
                  </Btn>
                ) : null
              )}
            </FilterRow>
          )}
          {ROW_FACETS.map((f) => {
            const opts = facetOptions[f] || [];
            if (!opts.length) return null;
            return (
              <FilterRow key={f} label={FACET_LABEL[f]}>
                {opts.map((o) => (
                  <Btn
                    key={o.value}
                    sm
                    n={o.n}
                    active={(facets[f] || []).includes(o.value)}
                    onClick={() => toggleFacet(f, o.value)}
                  >
                    {facetNames[f]?.[o.value] ?? labelize(o.value)}
                  </Btn>
                ))}
              </FilterRow>
            );
          })}
        </div>
      )}

      {view === "grid" ? (
        <ResourceGrid
          rows={filtered}
          className="mt-8"
          emptyText="Nothing matches those filters."
        />
      ) : (
        <ResourceList
          rows={filtered}
          className="mt-8"
          emptyText="Nothing matches those filters."
        />
      )}
    </div>
  );
}

function FilterRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[96px_minmax(0,1fr)] items-start gap-x-2">
      <span className="label pt-2">{label}</span>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}
