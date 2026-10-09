import { notFound } from "next/navigation";
import Shell from "../../_components/Shell";
import ResourceList from "../../_components/ResourceList";
import { Breadcrumb, Empty, PageHead } from "../../_components/primitives";
import { LayersIcon } from "../../_components/icons";
import { getCategoryNames, getIndexes, getResources, getSurfaceVocab } from "../../lib/data";
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
    <Shell>
      <Breadcrumb trail={[{ href: "/surfaces", label: "Surfaces" }]} current={surface.name} />

      <PageHead
        icon={<LayersIcon />}
        title={surface.name}
        meta={`${group?.name ?? "Surface"} · ${checks.length} checks · ${helpers.length} ${helpers.length === 1 ? "resource" : "resources"}`}
        intro={surface.description}
      />

      <section className="section">
        <div className="section-title">
          Before you ship
          <span className="meta">{checks.length} checks</span>
        </div>
        {checks.length === 0 ? (
          <Empty>No checklist for this surface yet.</Empty>
        ) : (
          <ol className="checklist">
            {checks.map((c, i) => (
              <li key={i}>
                <span className="num">{String(i + 1).padStart(2, "0")}</span>
                <span>{c}</span>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className="section">
        <div className="section-title">
          Resources that help you build this
          <span className="meta">{helpers.length}</span>
        </div>
        {helpers.length === 0 ? (
          <Empty>Nothing in the index is tagged for this surface yet.</Empty>
        ) : (
          <ResourceList rows={helpers} categoryNames={getCategoryNames()} />
        )}
      </section>
    </Shell>
  );
}
