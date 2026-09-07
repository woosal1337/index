import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Shell from "../../_components/Shell";
import ResourceList from "../../_components/ResourceList";
import CopyPrompt from "../../_components/CopyPrompt";
import { Breadcrumb, PLink, SectionHead, Tag } from "../../_components/primitives";
import { getCategories, getFacetLabels, getFacetNames, getResources, labelize, tierLabel } from "../../lib/data";
import { byTierThenName } from "../../lib/rows";
import { pageMetadata } from "../../lib/site";

export function generateStaticParams() {
  return getResources().map((r) => ({ slug: r.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const r = getResources().find((x) => x.slug === slug);
  if (!r) return { title: "Not found" };
  return pageMetadata(`/r/${slug}`, r.name, r.tagline || r.description);
}

const FACET_ORDER = [
  "license", "pricing", "framework", "styling", "distribution",
  "platform", "content_type", "agent_readiness", "accessibility", "maturity",
];

export default async function ResourcePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const all = getResources();
  const r = all.find((x) => x.slug === slug);
  if (!r) notFound();

  const cat = getCategories().find((c) => c.slug === r.category);

  const related = all
    .filter((x) => x.slug !== r.slug && x.category === r.category)
    .sort(byTierThenName)
    .slice(0, 6);

  const facetNames = getFacetNames();
  const facetLabels = getFacetLabels();
  const facts: { label: string; value: string }[] = [];
  for (const f of FACET_ORDER) {
    const v = r.facets?.[f];
    const vals = Array.isArray(v) ? v : v ? [v] : [];
    if (!vals.length) continue;
    facts.push({
      label: facetLabels[f] ?? labelize(f),
      value: vals.map((x) => facetNames[f]?.[x] ?? labelize(x)).join(", "),
    });
  }
  if (r.pricingDetail) facts.push({ label: "Pricing detail", value: r.pricingDetail });
  if (typeof r.github?.stars === "number") facts.push({ label: "GitHub stars", value: r.github.stars.toLocaleString() });
  if (r.pkg) facts.push({ label: "Package", value: r.pkg });

  return (
    <Shell
      title={r.name}
      status={
        <>
          <span>{r.domain}</span>
          <span>Tier {r.tier}</span>
        </>
      }
    >
      <Breadcrumb
        trail={[
          { href: "/", label: "Browse" },
          { href: `/categories/${r.category}`, label: cat?.name ?? r.category },
        ]}
        current={r.name}
      />

      <header>
        <h1 className="title">{r.name}</h1>
        {r.tagline && <p className="mt-2 max-w-[60ch] text-[16px] leading-normal text-fg-3">{r.tagline}</p>}

        <p className="label mt-4 flex flex-wrap items-center gap-x-3 gap-y-1">
          <span>
            Tier <span className="text-fg-2">{r.tier}</span> · {tierLabel(r.tier)}
          </span>
          {r.kinds.map((k) => (
            <span key={k}>
              <span aria-hidden className="mr-3">·</span>
              {labelize(k)}
            </span>
          ))}
          <span>
            <span aria-hidden className="mr-3">·</span>
            {r.domain}
          </span>
        </p>

        <div className="mt-5 flex flex-wrap gap-2">
          <PLink href={r.url} external strong>{`Visit ${r.domain} ↗`}</PLink>
          {r.docsUrl && <PLink href={r.docsUrl} external>Docs</PLink>}
          {r.repoUrl && <PLink href={r.repoUrl} external>Repository</PLink>}
          {r.registryUrl && <PLink href={r.registryUrl} external>Registry</PLink>}
        </div>
      </header>

      {r.hasImage && (
        <figure className="mt-8">

          <img
            src={`/og/${r.imageKey}.webp`}
            alt=""
            loading="lazy"
            decoding="async"
            width={1200}
            height={630}
            className="block w-full border border-line bg-surface"
          />
          <figcaption className="label mt-2">Preview image from {r.domain}</figcaption>
        </figure>
      )}

      {r.description && (
        <div className="prose mt-8 text-[16px]">
          <p>{r.description}</p>
        </div>
      )}

      {r.install && (
        <div className="mt-6">
          <div className="label mb-2">Install</div>
          <code className="code">{r.install}</code>
        </div>
      )}

      <div className="mt-8 space-y-12">
        {(r.agentGuidance || r.whyItMatters) && (
          <section>
            <SectionHead label="For an agent" />
            {r.agentGuidance && <p className="prose text-[15px]">{r.agentGuidance}</p>}
            {r.whyItMatters && (
              <p className="prose mt-3 text-[15px] text-fg-3">
                <span className="text-fg">Why it is here. </span>
                {r.whyItMatters}
              </p>
            )}
            <div className="mt-5">
              <CopyPrompt resource={r} />
            </div>
          </section>
        )}

        {facts.length > 0 && (
          <section>
            <SectionHead label="Facts" />
            <dl className="rows">
              {facts.map((f) => (
                <div key={f.label} className="row static">
                  <dt className="shrink-0 text-[14px] text-fg-3">{f.label}</dt>
                  <span className="leader" aria-hidden />
                  <dd className="max-w-[60%] truncate text-[14px] text-fg" title={f.value}>
                    {f.value}
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        )}

        {r.components.length > 0 && (
          <section>
            <SectionHead
              label="Components it ships"
              meta={r.componentCount ? `${r.componentCount.toLocaleString()} total` : `${r.components.length}`}
            />
            <div className="flex flex-wrap gap-1.5">
              {r.components.map((c) => (
                <Tag key={c} href={`/components/${c}`}>{labelize(c)}</Tag>
              ))}
            </div>
          </section>
        )}

        {r.surfaces.length > 0 && (
          <section>
            <SectionHead label="Helps you build" meta={`${r.surfaces.length}`} />
            <div className="flex flex-wrap gap-1.5">
              {r.surfaces.map((s) => (
                <Tag key={s} href={`/surfaces/${s}`}>{labelize(s)}</Tag>
              ))}
            </div>
          </section>
        )}

        {r.templates.length > 0 && (
          <section>
            <SectionHead
              label="Templates"
              meta={
                r.templateCount && r.templateCount > r.templates.length
                  ? `${r.templates.length} of ${r.templateCount}`
                  : `${r.templates.length}`
              }
            />
            <ul className="rows">
              {r.templates.map((t) => (
                <li key={t.url + t.name}>
                  <a href={t.url} target="_blank" rel="noreferrer noopener" className="row" title={t.purpose || t.name}>
                    <span className="main text-[15px]">
                      {t.name}
                      {t.purpose && <span className="desc"> · {t.purpose}</span>}
                    </span>
                    <span className="leader" aria-hidden />
                    <span className="meta">↗</span>
                  </a>
                </li>
              ))}
            </ul>
          </section>
        )}

        {r.notableFor.length > 0 && (
          <section>
            <SectionHead label="Notable for" />
            <ul className="space-y-1.5 text-[15px] text-fg-2">
              {r.notableFor.map((n, i) => (
                <li key={i} className="flex gap-3">
                  <span aria-hidden className="mt-[10px] h-1 w-1 shrink-0 rounded-full bg-fg-4" />
                  <span>{n}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {r.article && (
          <section>
            <SectionHead
              label={`Source summary, @${r.article.author}`}
              meta={r.article.metrics.views ? `${r.article.metrics.views.toLocaleString()} views` : undefined}
            />
            {r.article.takeaways.length > 0 && (
              <ul className="mb-5 space-y-1.5 text-[15px] text-fg-2">
                {r.article.takeaways.map((t, i) => (
                  <li key={i} className="flex gap-3">
                    <span aria-hidden className="mt-[10px] h-1 w-1 shrink-0 rounded-full bg-fg-4" />
                    <span>{t}</span>
                  </li>
                ))}
              </ul>
            )}
            <PLink href={r.url} external>Visit the original source</PLink>
          </section>
        )}

        <section>
          <SectionHead label="Provenance" />
          <p className="prose text-[13px] text-fg-4">
            {r.verifiedAt && <>Verified {r.verifiedAt}. </>}
            {r.httpStatus && <>HTTP {r.httpStatus}. </>}
            {r.evidence}
          </p>
        </section>

        {related.length > 0 && (
          <section>
            <SectionHead label={`Also in ${cat?.name ?? r.category}`} meta={`${related.length}`} />
            <ResourceList rows={related} />
          </section>
        )}
      </div>
    </Shell>
  );
}
