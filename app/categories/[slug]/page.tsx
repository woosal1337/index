import { notFound } from "next/navigation";
import Shell from "../../_components/Shell";
import Browser from "../../_components/Browser";
import { Breadcrumb, catStyle, PageHead, Tag } from "../../_components/primitives";
import { getCategories, getCategoryNames, getFacetNames, getResources } from "../../lib/data";
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
    .filter((s) => s.n > 0)
    .sort((a, b) => b.n - a.n);

  return (
    <Shell>
      <Breadcrumb trail={[{ href: "/categories", label: "Categories" }]} current={cat.name} />

      <PageHead
        icon={<span className="dot" style={catStyle(cat.slug)} />}
        title={cat.name}
        meta={`${inCat.length.toLocaleString()} resources${subCounts.length ? ` · ${subCounts.length} subcategories` : ""}`}
        intro={cat.description}
      >
        {subCounts.map((s) => (
          <Tag key={s.slug} n={s.n} title={s.description} muted>
            {s.name}
          </Tag>
        ))}
      </PageHead>

      {cat.agent_hint && (
        <p className="prose -mt-2 text-[13.5px] text-fg-3">
          <span className="font-medium text-fg">For an agent. </span>
          {cat.agent_hint}
        </p>
      )}

      <Browser
        rows={inCat.map(toRow)}
        categories={[]}
        initialCategory={slug}
        showCategories={false}
        facetNames={getFacetNames()}
        categoryNames={getCategoryNames()}
      />
    </Shell>
  );
}
