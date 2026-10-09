import Link from "next/link";
import Shell from "../_components/Shell";
import { Empty, PageHead } from "../_components/primitives";
import { Reveal } from "../_components/motion";
import { PuzzleIcon } from "../_components/icons";
import { getComponentVocab, getIndexes } from "../lib/data";
import { pageMetadata } from "../lib/site";

export const metadata = pageMetadata("/components", "Components",
  "Browse UI components and the libraries in Index that include them.");

export default function ComponentsPage() {
  const { byComponent } = getIndexes();
  const groups = getComponentVocab();
  const covered = Object.keys(byComponent).length;
  const vocab = groups.reduce((s, g) => s + g.components.length, 0);

  return (
    <Shell>
      <PageHead
        icon={<PuzzleIcon />}
        title="Components"
        meta={`${covered} of ${vocab} canonical components have a provider`}
        intro="An agent rarely asks for a component library. It asks which library ships a Gantt chart. Each component links to the resources that provide it, best tier first."
      />

      {covered === 0 ? (
        <Empty>
          No component tags yet. Run <code className="mono">npm run data</code> after enrichment.
        </Empty>
      ) : (
        <div className="grid gap-4">
          {groups.map((g) => {
            const provided = g.components
              .filter((c) => (byComponent[c.slug] || []).length > 0)
              .sort((a, b) => (byComponent[b.slug]?.length ?? 0) - (byComponent[a.slug]?.length ?? 0));
            if (!provided.length) return null;
            return (
              <Reveal key={g.slug} className="section">
                <div className="section-title">
                  {g.name}
                  <span className="meta">{provided.length} available</span>
                </div>
                <ul className="rows cols">
                  {provided.map((c) => (
                    <li key={c.slug}>
                      <Link
                        href={`/components/${c.slug}`}
                        className="row"
                        title={`${byComponent[c.slug].length} resources ship ${c.name}`}
                      >
                        <span className="main">{c.name}</span>
                        <span className="meta">
                          <b>{byComponent[c.slug].length}</b>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </Reveal>
            );
          })}
        </div>
      )}
    </Shell>
  );
}
