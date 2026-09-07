import Shell from "./_components/Shell";
import Browser from "./_components/Browser";
import { PLink } from "./_components/primitives";
import { getCategories, getFacetNames, getResources, getStats } from "./lib/data";
import { toRow } from "./lib/rows";
import { catalogDescription, pageMetadata, SITE_TITLE } from "./lib/site";

export function generateMetadata() {
  return { ...pageMetadata("/", SITE_TITLE, catalogDescription(getStats())), title: { absolute: SITE_TITLE } };
}

export default function Home() {
  const resources = getResources();
  const categories = getCategories();
  const stats = getStats();

  const rows = resources.map(toRow);
  const present = new Set(resources.map((r) => r.category));
  const navCategories = categories
    .filter((c) => present.has(c.slug))
    .map((c) => ({ slug: c.slug, name: c.name }));

  return (
    <Shell title="Index">

      <section className="pb-6 pt-2">
        <h1 className="display">
          A design corpus
          <br />
          your coding agent can read.
        </h1>
        <p className="lede mt-6">
          <span className="numeric">{stats.resources.toLocaleString()}</span> resources, tagged against{" "}
          <span className="numeric">{stats.vocabComponents}</span> canonical components and{" "}
          <span className="numeric">{stats.vocabSurfaces}</span> app surfaces.
          <br />
          <span className="text-fg-3">Curated by hand, written for agents.</span>
        </p>
        <div className="mt-8 flex flex-wrap gap-2">
          <PLink href="/agents">For agents</PLink>
          <PLink href="/api/resources.json" external>
            JSON API
          </PLink>
          <PLink href="/llms.txt" external>
            llms.txt
          </PLink>
        </div>
      </section>

      <div className="hatch" aria-hidden />

      <section className="pt-6">
        <h2 className="heading-24">
          Browse resources:
        </h2>
        <Browser rows={rows} categories={navCategories} facetNames={getFacetNames()} />
      </section>
    </Shell>
  );
}
