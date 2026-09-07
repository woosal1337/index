import { notFound } from "next/navigation";
import type { CSSProperties } from "react";
import Shell from "../../_components/Shell";
import Browser from "../../_components/Browser";
import { Breadcrumb } from "../../_components/primitives";
import { getCategories, getFacetNames, getResources } from "../../lib/data";
import { toRow } from "../../lib/rows";
import { pageMetadata } from "../../lib/site";

export function generateStaticParams() {
  return getCategories().map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const c = getCategories().find((x) => x.slug === slug);
  return pageMetadata(`/categories/${slug}`, c?.name ?? slug, c?.description);
}

export default async function CategoryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const categories = getCategories();
  const cat = categories.find((c) => c.slug === slug);
  if (!cat) notFound();

  const all = getResources();
  const inCat = all.filter((r) => r.category === slug);
  const subCounts = cat.subcategories
    .map((s) => ({ ...s, n: inCat.filter((r) => r.subcategory === s.slug).length }))
    .filter((s) => s.n > 0);

  return (
    <Shell title={cat.name}>
      <Breadcrumb trail={[{ href: "/categories", label: "Categories" }]} current={cat.name} />

      <header className="mb-9" style={{ "--dot": `var(--cat-${cat.slug}, var(--fg))` } as CSSProperties}>
        <h1 className="title flex items-center gap-3">
          <span aria-hidden className="inline-block h-2 w-2 shrink-0 rounded-full bg-[var(--dot)]" />
          {cat.name}
        </h1>
        <p className="prose mt-3 text-[15px] text-fg-3">{cat.description}</p>
        {cat.agent_hint && (
          <p className="prose mt-3 text-[15px] text-fg-3">
            <span className="text-fg">For an agent. </span>
            {cat.agent_hint}
          </p>
        )}
        <p className="label mt-4">
          <span className="tnum">{inCat.length}</span> resources
        </p>
        {subCounts.length > 0 && (
          <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-fg-3">
            {subCounts.map((s) => (
              <li key={s.slug} title={s.description} className="flex items-baseline gap-1.5">
                {s.name}
                <span className="label">{s.n}</span>
              </li>
            ))}
          </ul>
        )}
      </header>

      <Browser
        rows={inCat.map(toRow)}
        categories={[]}
        initialCategory={slug}
        showCategories={false}
        facetNames={getFacetNames()}
      />
    </Shell>
  );
}
