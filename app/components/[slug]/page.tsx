import { notFound } from "next/navigation";
import Shell from "../../_components/Shell";
import ResourceList from "../../_components/ResourceList";
import { Breadcrumb, Empty, PageHead } from "../../_components/primitives";
import { PuzzleIcon } from "../../_components/icons";
import { getCategoryNames, getComponentVocab, getIndexes, getResources } from "../../lib/data";
import { pageMetadata } from "../../lib/site";

export function generateStaticParams() {
  const { byComponent } = getIndexes();
  return Object.keys(byComponent).map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const c = getComponentVocab().flatMap((g) => g.components).find((x) => x.slug === slug);
  return pageMetadata(`/components/${slug}`, c ? `${c.name}: who ships it` : slug,
    c ? `Resources in Index that include a ${c.name} component.` : undefined);
}

export default async function ComponentPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const groups = getComponentVocab();
  const group = groups.find((g) => g.components.some((c) => c.slug === slug));
  const comp = group?.components.find((c) => c.slug === slug);
  const { byComponent } = getIndexes();
  const slugs = byComponent[slug] || [];
  if (!comp && !slugs.length) notFound();

  const resources = getResources();
  const bySlug = new Map(resources.map((r) => [r.slug, r]));
  const providers = slugs.map((s) => bySlug.get(s)).filter(Boolean) as typeof resources;

  return (
    <Shell>
      <Breadcrumb trail={[{ href: "/components", label: "Components" }]} current={comp?.name ?? slug} />

      <PageHead
        icon={<PuzzleIcon />}
        title={comp?.name ?? slug}
        meta={`${providers.length} ${providers.length === 1 ? "resource ships" : "resources ship"} this component${group ? ` · ${group.name}` : ""}`}
        intro={comp?.aliases?.length ? `Also called: ${comp.aliases.slice(0, 10).join(", ")}.` : undefined}
      />

      {comp?.checklist?.length ? (
        <section className="section">
          <div className="section-title">
            Before you ship
            <span className="meta">{comp.checklist.length} checks</span>
          </div>
          <ol className="checklist">
            {comp.checklist.map((c, i) => (
              <li key={c}>
                <span className="num">{String(i + 1).padStart(2, "0")}</span>
                <span>{c}</span>
              </li>
            ))}
          </ol>
          {comp.checklist_source ? (
            <p className="mt-3 px-1 text-[12.5px] text-fg-4">
              Checks from{" "}
              <a href="https://www.checklist.design/" target="_blank" rel="noreferrer noopener" className="link">
                {comp.checklist_source}
              </a>
              , MIT.
            </p>
          ) : null}
        </section>
      ) : null}

      <section className="section">
        <div className="section-title">
          Ships it
          <span className="meta">{providers.length}</span>
        </div>
        {providers.length === 0 ? (
          <Empty>Nothing in the index ships this component yet.</Empty>
        ) : (
          <ResourceList rows={providers} categoryNames={getCategoryNames()} />
        )}
      </section>
    </Shell>
  );
}
