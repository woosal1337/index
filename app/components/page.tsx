import Link from "next/link";
import Shell from "../_components/Shell";
import { Empty, PageHead, SectionHead } from "../_components/primitives";
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
    <Shell title="Components">
      <PageHead
        title={
          <>
            Who ships what
          </>
        }
        intro={
          <>
            The question an agent asks is not &ldquo;show me component libraries&rdquo;. It is &ldquo;which of
            these ships a Gantt?&rdquo;. Every component below links to the resources in this index that provide
            it, ranked by quality tier.
          </>
        }
        meta={
          <>
            <span className="tnum">{covered}</span> of <span className="tnum">{vocab}</span> canonical components
            are provided by something in the index
          </>
        }
      />

      {covered === 0 ? (
        <Empty>
          No component tags yet. Run <code className="font-mono text-[0.9em]">npm run data</code> after enrichment.
        </Empty>
      ) : (
        <div className="space-y-10">
          {groups.map((g) => {
            const provided = g.components
              .filter((c) => (byComponent[c.slug] || []).length > 0)
              .sort((a, b) => (byComponent[b.slug]?.length ?? 0) - (byComponent[a.slug]?.length ?? 0));
            if (!provided.length) return null;
            return (
              <section key={g.slug}>
                <SectionHead label={g.name} meta={`${provided.length} available`} />
                <ul className="rows grid grid-cols-1 gap-x-8 sm:grid-cols-2 lg:grid-cols-3">
                  {provided.map((c) => (
                    <li key={c.slug}>
                      <Link href={`/components/${c.slug}`} className="row" title={`${byComponent[c.slug].length} resources ship ${c.name}`}>
                        <span className="main text-[15px]">{c.name}</span>
                        <span className="leader" aria-hidden />
                        <span className="meta">{byComponent[c.slug].length}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </Shell>
  );
}
