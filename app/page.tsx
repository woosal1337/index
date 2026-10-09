import Shell from "./_components/Shell";
import Browser from "./_components/Browser";
import { getCategories, getFacetNames, getResources, getStats } from "./lib/data";
import { toRow } from "./lib/rows";
import { catalogDescription, pageMetadata, SITE_TITLE, siteUrl } from "./lib/site";

export function generateMetadata() {
  return { ...pageMetadata("/", SITE_TITLE, catalogDescription(getStats())), title: { absolute: SITE_TITLE } };
}

export default function Home() {
  const resources = getResources();
  const categories = getCategories();

  const rows = resources.map(toRow);
  const present = new Set(resources.map((r) => r.category));
  const navCategories = categories
    .filter((c) => present.has(c.slug))
    .map((c) => ({ slug: c.slug, name: c.name, description: c.description }));

  const website = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "Index",
    alternateName: SITE_TITLE,
    url: siteUrl("/"),
    description: catalogDescription(getStats()),
    inLanguage: "en",
  };

  return (
    <Shell>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(website).replace(/</g, "\\u003c") }} />
      <h1 className="sr-only">Index, a design corpus</h1>
      <Browser rows={rows} categories={navCategories} facetNames={getFacetNames()} />
    </Shell>
  );
}
