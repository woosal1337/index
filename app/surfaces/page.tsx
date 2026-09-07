import Link from "next/link";
import Shell from "../_components/Shell";
import { PageHead, SectionHead } from "../_components/primitives";
import { getIndexes, getSurfaceVocab } from "../lib/data";
import { pageMetadata } from "../lib/site";

export const metadata = pageMetadata("/surfaces", "Surfaces",
  "Browse app screens and flows, with checklists and resources to help you build them.");

export default function SurfacesPage() {
  const { bySurface } = getIndexes();
  const groups = getSurfaceVocab();

  const total = groups.reduce((s, g) => s + g.surfaces.length, 0);
  const totalItems = groups.reduce((s, g) => s + g.surfaces.reduce((n, x) => n + (x.checklist?.length || 0), 0), 0);

  return (
    <Shell title="Surfaces">
      <PageHead
        title={
          <>
            Surfaces
          </>
        }
        intro={
          <>
            A component vocabulary tells you what to build things <em>from</em>. This tells you what to build:{" "}
            <span className="tnum">{total}</span> screens and flows drawn from checklist.design and extended for
            modern products, each with the concrete requirements it must satisfy.
          </>
        }
        meta={
          <>
            <span className="tnum">{total}</span> surfaces · <span className="tnum">{totalItems.toLocaleString()}</span>{" "}
            checks
          </>
        }
      />

      <div className="space-y-10">
        {groups.map((g) => (
          <section key={g.slug}>
            <SectionHead label={g.name} meta={`${g.surfaces.length}`} />
            <ul className="rows">
              {g.surfaces.map((s) => {
                const n = (bySurface[s.slug] || []).length;
                const checks = s.checklist?.length ?? 0;
                return (
                  <li key={s.slug}>
                    <Link href={`/surfaces/${s.slug}`} className="row" title={s.description}>
                      <span className="main text-[15px]">
                        {s.name}
                        {s.description && <span className="desc"> · {s.description}</span>}
                      </span>
                      <span className="leader" aria-hidden />
                      <span className="meta">
                        {n > 0 && (
                          <>
                            <b>{n}</b> {n === 1 ? "resource" : "resources"} ·{" "}
                          </>
                        )}
                        {checks} checks
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </Shell>
  );
}
