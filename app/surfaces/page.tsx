import Link from "next/link";
import Shell from "../_components/Shell";
import { PageHead } from "../_components/primitives";
import { Reveal } from "../_components/motion";
import { LayersIcon } from "../_components/icons";
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
    <Shell>
      <PageHead
        icon={<LayersIcon />}
        title="Surfaces"
        meta={`${total} surfaces · ${totalItems.toLocaleString()} checks`}
        intro={
          <>
            A component vocabulary tells you what to build things <em>from</em>. A surface tells you what to build. Each
            screen or flow lists the requirements it must satisfy and the resources that help.
          </>
        }
      />

      <div className="grid gap-4">
        {groups.map((g) => (
          <Reveal key={g.slug} className="section">
            <div className="section-title">
              {g.name}
              <span className="meta">{g.surfaces.length}</span>
            </div>
            <ul className="rows">
              {g.surfaces.map((s) => {
                const n = (bySurface[s.slug] || []).length;
                const checks = s.checklist?.length ?? 0;
                return (
                  <li key={s.slug}>
                    <Link href={`/surfaces/${s.slug}`} className="row" title={s.description}>
                      <span className="main">
                        {s.name}
                        {s.description && <span className="desc"> · {s.description}</span>}
                      </span>
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
          </Reveal>
        ))}
      </div>
    </Shell>
  );
}
