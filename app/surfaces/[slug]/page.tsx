import { notFound } from "next/navigation";
import Shell from "../../_components/Shell";
import ResourceList from "../../_components/ResourceList";
import { Breadcrumb, Empty, SectionHead } from "../../_components/primitives";
import { getIndexes, getResources, getSurfaceVocab } from "../../lib/data";
import { pageMetadata } from "../../lib/site";

export function generateStaticParams() {
  return getSurfaceVocab()
    .flatMap((g) => g.surfaces)
    .map((s) => ({ slug: s.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const s = getSurfaceVocab().flatMap((g) => g.surfaces).find((x) => x.slug === slug);
  return pageMetadata(`/surfaces/${slug}`, s?.name ?? slug, s?.description);
}

export default async function SurfacePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const groups = getSurfaceVocab();
  const group = groups.find((g) => g.surfaces.some((s) => s.slug === slug));
  const surface = group?.surfaces.find((s) => s.slug === slug);
  if (!surface) notFound();

  const resources = getResources();
  const { bySurface } = getIndexes();
  const bySlug = new Map(resources.map((r) => [r.slug, r]));
  const helpers = (bySurface[slug] || []).map((s) => bySlug.get(s)).filter(Boolean) as typeof resources;
  const checks = surface.checklist || [];

  return (
    <Shell title={surface.name}>
      <Breadcrumb trail={[{ href: "/surfaces", label: "Surfaces" }]} current={surface.name} />

      <header className="mb-9">
        <h1 className="title">{surface.name}</h1>
        <p className="prose mt-3 text-[15px] text-fg-3">{surface.description}</p>
        <p className="label mt-4">
          {group?.name} · <span className="tnum">{checks.length}</span> checks ·{" "}
          <span className="tnum">{helpers.length}</span> {helpers.length === 1 ? "resource" : "resources"}
        </p>
      </header>

      <div className="space-y-12">
        <section>
          <SectionHead label="Before you ship" meta={`${checks.length}`} />
          {checks.length === 0 ? (
            <Empty>No checklist for this surface yet.</Empty>
          ) : (
            <ol className="space-y-1.5">
              {checks.map((c, i) => (
                <li key={i} className="flex gap-3 text-[15px] text-fg-2">
                  <span className="label mt-1 w-5 shrink-0">{String(i + 1).padStart(2, "0")}</span>
                  <span>{c}</span>
                </li>
              ))}
            </ol>
          )}
        </section>

        <section>
          <SectionHead label="Resources that help you build this" meta={`${helpers.length}`} />
          {helpers.length === 0 ? (
            <Empty>Nothing in the index is tagged for this surface yet.</Empty>
          ) : (
            <ResourceList rows={helpers} />
          )}
        </section>
      </div>
    </Shell>
  );
}
