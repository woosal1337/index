import Link from "next/link";
import type { CSSProperties } from "react";
import Shell from "../_components/Shell";
import { PageHead } from "../_components/primitives";
import { getCategories, getIndexes, getResources } from "../lib/data";
import { pageMetadata } from "../lib/site";

export function generateMetadata() {
  return pageMetadata("/categories", "Categories",
    `${getCategories().length} design resource categories. Browse subcategories and resource counts.`);
}

export default function CategoriesPage() {
  const resources = getResources();
  const categories = getCategories();
  const { categoryCounts } = getIndexes();
  const total = resources.length;

  const subCount = new Map<string, number>();
  for (const r of resources) {
    if (!r.subcategory) continue;
    const k = `${r.category}/${r.subcategory}`;
    subCount.set(k, (subCount.get(k) ?? 0) + 1);
  }

  const rows = categories
    .map((c) => {
      const n = categoryCounts[c.slug] ?? 0;
      const subs = (c.subcategories || [])
        .map((s) => ({ name: s.name, n: subCount.get(`${c.slug}/${s.slug}`) ?? 0 }))
        .filter((s) => s.n > 0)
        .sort((a, b) => b.n - a.n);
      return { ...c, n, subs };
    })
    .filter((c) => c.n > 0)
    .sort((a, b) => b.n - a.n);

  const largest = rows[0]?.n || 1;

  return (
    <Shell title="Categories">
      <PageHead
        title={
          <>
            Categories
          </>
        }
        intro={
          <>
            A directory usually lets one bucket swallow half its catalogue. The largest here holds{" "}
            <span className="tnum">{Math.round((largest / total) * 100)}%</span> of{" "}
            <span className="tnum">{total.toLocaleString()}</span>, because the design axes are the
            ones that must stay subdivided. Each row names the subcategories it divides into.
          </>
        }
        meta={
          <>
            {rows.length} categories · {rows.reduce((t, c) => t + c.subs.length, 0)} subcategories in use
          </>
        }
      />

      <ul className="rows">
        {rows.map((c) => (
          <li key={c.slug} style={{ "--dot": `var(--cat-${c.slug}, var(--fg))` } as CSSProperties}>
            <Link href={`/categories/${c.slug}`} className="row" title={c.description}>
              <span className="dot" aria-hidden />
              <span className="main">
                {c.name}
                {c.subs.length > 0 && (
                  <span className="desc">
                    {" · "}
                    {c.subs.map((s) => s.name).join(", ")}
                  </span>
                )}
              </span>
              <span className="leader" aria-hidden />
              <span className="meta">
                <b>{c.n}</b>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </Shell>
  );
}
