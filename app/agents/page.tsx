import Shell from "../_components/Shell";
import { PageHead, SectionHead } from "../_components/primitives";
import { getResources, getStats } from "../lib/data";
import { pageMetadata } from "../lib/site";

export const metadata = pageMetadata("/agents", "For agents",
  "Read the design catalog through static JSON endpoints, llms.txt, and a documented record schema.");

const clip = (value: string, max: number) =>
  value.length > max ? `${value.slice(0, max).trimEnd()}…` : value;

export default function AgentsPage() {
  const stats = getStats();
  const resource = getResources().find((r) => r.slug === "kibo-ui");
  const sample = resource && {
    id: resource.id,
    slug: resource.slug,
    url: resource.url,
    domain: resource.domain,
    name: resource.name,
    tagline: resource.tagline,
    description: clip(resource.description, 96),
    category: resource.category,
    subcategory: resource.subcategory,
    kinds: resource.kinds,
    facets: resource.facets,
    components: resource.components.slice(0, 4),
    componentCount: resource.componentCount,
    surfaces: resource.surfaces.slice(0, 4),
    templates: resource.templates.slice(0, 1),
    templateCount: resource.templateCount,
    install: resource.install,
    pkg: resource.pkg,
    docsUrl: resource.docsUrl,
    repoUrl: resource.repoUrl,
    registryUrl: resource.registryUrl,
    github: resource.github,
    pricingDetail: resource.pricingDetail && clip(resource.pricingDetail, 96),
    counts: resource.counts,
    agentGuidance: clip(resource.agentGuidance, 96),
    whyItMatters: clip(resource.whyItMatters, 96),
    tier: resource.tier,
    notableFor: resource.notableFor.slice(0, 3),
    httpStatus: resource.httpStatus,
    verifiedAt: resource.verifiedAt,
    evidence: clip(resource.evidence, 96),
    imageKey: resource.imageKey,
    ogImage: resource.ogImage,
    favicon: resource.favicon,
    savedAt: resource.savedAt,
    source: resource.source,
    hasImage: resource.hasImage,
  };
  const fields = sample ? Object.keys(sample).length : 0;

  const endpoints: [string, string][] = [
    ["/api/resources.json", `every resource record (${stats.resources})`],
    ["/api/search.json", "compact search index: slug, name, tagline, category, tier, domain"],
    ["/api/indexes.json", "component → resources, surface → resources, facet counts"],
    ["/api/taxonomy.json", "categories, kinds, facets, components, surfaces"],
    ["/api/stats.json", "corpus counts and build date"],
    ["/api/showcase.json", `site references and screenshot metadata (${stats.showcaseSites ?? 0})`],
    ["/api/showcase-indexes.json", "typeface and color indexes across the showcase"],
    ["/llms.txt", "the corpus described for a model"],
    ["/sitemap.xml", "every page"],
  ];

  return (
    <Shell title="For agents">
      <PageHead
        title={
          <>
            For agents
          </>
        }
        intro={
          <>
            Read the catalog through static JSON endpoints, a sitemap, and <code>llms.txt</code>.
            {" "}The website and the API use the same resource records.
          </>
        }
        meta="Static JSON · no API key"
      />

      <div className="space-y-12">
        <section>
          <SectionHead label="Endpoints" meta={`${endpoints.length}`} />
          <ul className="rows">
            {endpoints.map(([path, desc]) => (
              <li key={path}>
                <a href={path} className="row">
                  <span className="main font-mono text-[13px] font-medium">{path}</span>
                  <span className="leader" aria-hidden />
                  <span className="shrink-0 text-[13px] text-fg-4">{desc}</span>
                </a>
              </li>
            ))}
          </ul>
        </section>

        <section>
          <SectionHead label="Ask it a real question" />
          <p className="mb-3 text-[15px] text-fg-3">The reverse indexes answer the questions an agent actually has.</p>
          <pre className="code">{`INDEX_URL=http://localhost:3000

curl -fsS "$INDEX_URL/api/indexes.json" | jq '.byComponent["kanban-board"]'

curl -fsS "$INDEX_URL/api/indexes.json" | jq '.bySurface.paywall'

curl -fsS "$INDEX_URL/api/resources.json" | jq '[.[]
  | select(.facets.license[]? == "mit")
  | select(.facets.framework[]? == "react")]
  | sort_by(.tier) | .[].name'`}</pre>
        </section>

        <section>
          <SectionHead label="Record shape" meta={`${fields} fields`} />
          <p className="mb-3 text-[15px] text-fg-3">
            Every record in <code>/api/resources.json</code> carries these fields. Long text and long
            arrays are shortened here. Arrays are never null, and an unknown value is <code>null</code>.
          </p>
          <pre className="code">{JSON.stringify(sample, null, 2)}</pre>
        </section>
      </div>
    </Shell>
  );
}
