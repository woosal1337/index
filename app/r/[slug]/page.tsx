import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import Shell from "../../_components/Shell";
import CardGrid from "../../_components/CardGrid";
import CopyPrompt from "../../_components/CopyPrompt";
import { Enter } from "../../_components/motion";
import { Breadcrumb, Btn, catStyle, PLink, Tag, TierBadge } from "../../_components/primitives";
import { ArrowUpRightIcon, StarIcon } from "../../_components/icons";
import {
  getCategories,
  getCategoryNames,
  getFacetLabels,
  getFacetNames,
  getResources,
  labelize,
  tierLabel,
} from "../../lib/data";
import { monogram } from "../../lib/text";
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

const QUICK_FACETS = ["license", "pricing", "framework"];

function first(v: string[] | string | undefined): string | null {
  const vals = Array.isArray(v) ? v : v ? [v] : [];
  const x = vals[0];
  if (!x || x === "unknown" || x === "not-applicable" || x === "none") return null;
  return x;
}

export default async function ResourcePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const all = getResources();
  const r = all.find((x) => x.slug === slug);
  if (!r) notFound();

  const cat = getCategories().find((c) => c.slug === r.category);
  const sub = cat?.subcategories.find((s) => s.slug === r.subcategory);
  const categoryNames = getCategoryNames();

  const related = all
    .filter((x) => x.slug !== r.slug && x.category === r.category)
    .sort(byTierThenName)
    .slice(0, 8);

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

  const quick = QUICK_FACETS.map((f) => {
    const x = first(r.facets?.[f]);
    return x ? { key: f, label: facetNames[f]?.[x] ?? labelize(x) } : null;
  }).filter(Boolean) as { key: string; label: string }[];

  const coverage = [
    { n: r.componentCount ?? r.components.length, label: "components", href: "#components" },
    { n: r.surfaces.length, label: "surfaces", href: "#surfaces" },
    { n: r.templateCount ?? r.templates.length, label: "templates", href: "#templates" },
  ].filter((c) => c.n > 0);

  const badge =
    r.tier === "S" ? { label: "Best in class", glass: false } : r.tier === "A" ? { label: "Strong pick", glass: true } : null;

  return (
    <Shell>
      <Breadcrumb
        trail={[
          { href: "/", label: "Browse" },
          { href: `/categories/${r.category}`, label: cat?.name ?? r.category },
        ]}
        current={r.name}
      />

      <Enter>
        <div className="detail-frame">
          <div className="detail-panel">
            {badge && (
              <span className={`frame-badge${badge.glass ? " is-glass" : ""}`} title={`Quality tier ${r.tier}: ${tierLabel(r.tier)}`}>
                <StarIcon />
                {badge.label}
              </span>
            )}
            <Link href={`/categories/${r.category}`} className="detail-pill" style={catStyle(r.category)}>
              <span className="dot" aria-hidden />
              {cat?.name ?? r.category}
              {sub && (
                <>
                  <span aria-hidden>·</span>
                  <b>{sub.name}</b>
                </>
              )}
            </Link>
            <div className="detail-media">
              {r.hasImage ? (
                <img src={`/og/${r.imageKey}.webp`} alt="" decoding="async" width={1200} height={630} />
              ) : (
                <span className="frame-mono" aria-hidden>
                  {monogram(r.name)}
                </span>
              )}
            </div>
          </div>
          <svg className="spin-badge" viewBox="0 0 120 120" aria-hidden>
            <defs>
              <path id="spin-path" d="M60,60 m-44,0 a44,44 0 1,1 88,0 a44,44 0 1,1 -88,0" />
            </defs>
            <text>
              <textPath href="#spin-path">INDEX · INDEX · INDEX ·</textPath>
            </text>
          </svg>
        </div>
      </Enter>

      <div className="detail-grid">
        <div className="grid gap-5">
          <Enter delay={0.05}>
            <div className="flex flex-wrap gap-1.5">
              <Tag href={`/categories/${r.category}`} dot={r.category}>
                {cat?.name ?? r.category}
              </Tag>
              {r.kinds.map((k) => (
                <Tag key={k} muted>
                  {labelize(k)}
                </Tag>
              ))}
              {quick.map((q) => (
                <Tag key={q.key} muted>
                  {q.label}
                </Tag>
              ))}
            </div>
            <h1 className="detail-title mt-4">{r.name}</h1>
            {r.tagline && <p className="detail-desc">{r.tagline}</p>}
            <div className="detail-actions">
              <Btn href={r.url} external solid>
                Visit resource
                <ArrowUpRightIcon />
              </Btn>
              {r.docsUrl && (
                <Btn href={r.docsUrl} external>
                  Docs
                </Btn>
              )}
              {r.repoUrl && (
                <Btn href={r.repoUrl} external>
                  Repository
                </Btn>
              )}
              {r.registryUrl && (
                <Btn href={r.registryUrl} external>
                  Registry
                </Btn>
              )}
            </div>
          </Enter>

          {(r.description || r.install) && (
            <section className="section">
              <div className="section-title">
                About
                <span className="meta">{r.domain}</span>
              </div>
              {r.description && (
                <div className="prose px-1">
                  <p>{r.description}</p>
                </div>
              )}
              {r.install && (
                <div className="mt-4 px-1">
                  <div className="label mb-2">Install</div>
                  <code className="code">{r.install}</code>
                </div>
              )}
            </section>
          )}

          {(r.agentGuidance || r.whyItMatters) && (
            <section className="section">
              <div className="section-title">For an agent</div>
              <div className="px-1">
                {r.agentGuidance && <p className="prose">{r.agentGuidance}</p>}
                {r.whyItMatters && (
                  <p className="prose mt-3 text-fg-3">
                    <span className="font-medium text-fg">Why it is here. </span>
                    {r.whyItMatters}
                  </p>
                )}
                <div className="mt-4">
                  <CopyPrompt resource={r} />
                </div>
              </div>
            </section>
          )}

          {r.components.length > 0 && (
            <section id="components" className="section scroll-mt-6">
              <div className="section-title">
                Components it ships
                <span className="meta">{r.componentCount ? `${r.componentCount.toLocaleString()} total` : `${r.components.length}`}</span>
              </div>
              <div className="flex flex-wrap gap-1.5 px-1">
                {r.components.map((c) => (
                  <Tag key={c} href={`/components/${c}`}>
                    {labelize(c)}
                  </Tag>
                ))}
              </div>
            </section>
          )}

          {r.surfaces.length > 0 && (
            <section id="surfaces" className="section scroll-mt-6">
              <div className="section-title">
                Helps you build
                <span className="meta">{r.surfaces.length}</span>
              </div>
              <div className="flex flex-wrap gap-1.5 px-1">
                {r.surfaces.map((s) => (
                  <Tag key={s} href={`/surfaces/${s}`}>
                    {labelize(s)}
                  </Tag>
                ))}
              </div>
            </section>
          )}

          {r.templates.length > 0 && (
            <section id="templates" className="section scroll-mt-6">
              <div className="section-title">
                Templates
                <span className="meta">
                  {r.templateCount && r.templateCount > r.templates.length
                    ? `${r.templates.length} of ${r.templateCount}`
                    : `${r.templates.length}`}
                </span>
              </div>
              <ul className="rows">
                {r.templates.map((t, i) => (
                  <li key={`${i}-${t.url}`}>
                    <a href={t.url} target="_blank" rel="noreferrer noopener" className="row" title={t.purpose || t.name}>
                      <span className="main">
                        {t.name}
                        {t.purpose && <span className="desc"> · {t.purpose}</span>}
                      </span>
                      <ArrowUpRightIcon className="text-fg-4" />
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {r.notableFor.length > 0 && (
            <section className="section">
              <div className="section-title">Notable for</div>
              <ul className="bullets px-1">
                {r.notableFor.map((n, i) => (
                  <li key={i}>{n}</li>
                ))}
              </ul>
            </section>
          )}

          {r.article && (
            <section className="section">
              <div className="section-title">
                Source summary, @{r.article.author}
                {r.article.metrics.views ? <span className="meta">{r.article.metrics.views.toLocaleString()} views</span> : null}
              </div>
              <div className="px-1">
                {r.article.takeaways.length > 0 && (
                  <ul className="bullets mb-4">
                    {r.article.takeaways.map((t, i) => (
                      <li key={i}>{t}</li>
                    ))}
                  </ul>
                )}
                <PLink href={r.url} external>
                  Visit the original source
                </PLink>
              </div>
            </section>
          )}

          <section className="section">
            <div className="section-title">Provenance</div>
            <p className="prose px-1 text-[13px] text-fg-3">
              {r.verifiedAt && <>Verified {r.verifiedAt}. </>}
              {r.httpStatus && <>HTTP {r.httpStatus}. </>}
              {r.evidence}
            </p>
          </section>
        </div>

        <aside className="detail-aside" aria-label="Facts">
          <div className="panel">
            <p className="panel-title">At a glance</p>
            <dl className="facts">
              <div>
                <dt>Quality</dt>
                <dd className="flex items-center gap-2">
                  <TierBadge tier={r.tier} />
                  {tierLabel(r.tier)}
                </dd>
              </div>
              <div>
                <dt>Category</dt>
                <dd>
                  <Link href={`/categories/${r.category}`}>{cat?.name ?? r.category}</Link>
                  {sub && <span className="text-fg-3"> · {sub.name}</span>}
                </dd>
              </div>
              {r.kinds.length > 0 && (
                <div>
                  <dt>Kind</dt>
                  <dd>{r.kinds.map(labelize).join(", ")}</dd>
                </div>
              )}
              <div>
                <dt>Website</dt>
                <dd>
                  <a href={r.url} target="_blank" rel="noreferrer noopener">
                    {r.domain}
                  </a>
                </dd>
              </div>
              {facts.map((f) => (
                <div key={f.label}>
                  <dt>{f.label}</dt>
                  <dd>{f.value}</dd>
                </div>
              ))}
            </dl>
          </div>

          {coverage.length > 0 && (
            <div className="panel">
              <p className="panel-title">Coverage</p>
              <ul className="coverage">
                {coverage.map((c) => (
                  <li key={c.label}>
                    <a href={c.href}>
                      <b>{c.n.toLocaleString()}</b>
                      <span>{c.label}</span>
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </aside>
      </div>

      {related.length > 0 && (
        <section aria-labelledby="related-title">
          <div className="section-title">
            <span id="related-title">Related resources</span>
            <span className="meta">{cat?.name ?? r.category}</span>
          </div>
          <div className="section">
            <CardGrid items={related} categoryNames={categoryNames} />
          </div>
        </section>
      )}
    </Shell>
  );
}
