import { notFound } from "next/navigation";
import Shell from "../../_components/Shell";
import ResourceList from "../../_components/ResourceList";
import { Breadcrumb, Empty, SectionHead } from "../../_components/primitives";
import { getComponentVocab, getIndexes, getResources } from "../../lib/data";
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
    <Shell title={comp?.name ?? slug}>
      <Breadcrumb trail={[{ href: "/components", label: "Components" }]} current={comp?.name ?? slug} />

      <header className="mb-9">
        <h1 className="title">{comp?.name ?? slug}</h1>
        <p className="mt-3 text-[15px] text-fg-3">
          <span className="tnum">{providers.length}</span>{" "}
          {providers.length === 1 ? "resource in the index ships" : "resources in the index ship"} this component,
          best first.
          {group && <> Group: {group.name}.</>}
        </p>
        {comp?.aliases?.length ? (
          <p className="label mt-4">Also called · {comp.aliases.slice(0, 10).join(" · ")}</p>
        ) : null}
      </header>

      <div className="space-y-12">
        {comp?.checklist?.length ? (
          <section>
            <SectionHead label="Before you ship" meta={`${comp.checklist.length}`} />
            <ol className="space-y-1.5">
              {comp.checklist.map((c, i) => (
                <li key={c} className="flex gap-3 text-[15px] text-fg-2">
                  <span className="label mt-1 w-5 shrink-0">{String(i + 1).padStart(2, "0")}</span>
                  <span>{c}</span>
                </li>
              ))}
            </ol>
            {comp.checklist_source ? (
              <p className="mt-3 text-[12.5px] text-fg-4">
                Checks from{" "}
                <a
                  href="https://www.checklist.design/"
                  target="_blank"
                  rel="noreferrer noopener"
                  className="underline decoration-line-hard underline-offset-2 hover:text-fg"
                >
                  {comp.checklist_source}
                </a>
                , MIT.
              </p>
            ) : null}
          </section>
        ) : null}

        <section>
          <SectionHead label="Ships it" meta={`${providers.length}`} />
          {providers.length === 0 ? (
            <Empty>Nothing in the index ships this component yet.</Empty>
          ) : (
            <ResourceList rows={providers} />
          )}
        </section>
      </div>
    </Shell>
  );
}
