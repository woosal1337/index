import Link from "next/link";
import Shell from "../_components/Shell";
import { Empty, PageHead, TierBadge } from "../_components/primitives";
import { Reveal } from "../_components/motion";
import { ArrowUpRightIcon, TemplateIcon } from "../_components/icons";
import { getResources, getStats } from "../lib/data";
import { monogram } from "../lib/text";
import { pageMetadata } from "../lib/site";

export function generateMetadata() {
  return pageMetadata("/templates", "Templates",
    `${getStats().templates.toLocaleString("en-US")} templates from design galleries and starter kits. Browse references and visit each source.`);
}

const PER_SOURCE = 10;

export default function TemplatesPage() {
  const resources = getResources();
  const withTemplates = resources
    .filter((r) => r.templates.length > 0)
    .sort((a, b) => b.templates.length - a.templates.length);

  const total = withTemplates.reduce((s, r) => s + r.templates.length, 0);
  const shots = withTemplates.reduce((s, r) => s + r.templates.filter((t) => t.shot).length, 0);

  return (
    <Shell wide>
      <PageHead
        icon={<TemplateIcon />}
        title="Templates"
        meta={`${total.toLocaleString()} templates · ${withTemplates.length} sources · ${shots.toLocaleString()} previews`}
        intro="One template is often the seed of a whole project. Index opens each gallery and lists what is inside, with a real screenshot of the template page."
      />

      {withTemplates.length === 0 ? (
        <Empty>No templates indexed yet.</Empty>
      ) : (
        <div className="grid gap-4">
          {withTemplates.map((r) => {
            const purposes = new Set(r.templates.map((t) => (t.purpose || "").trim()));
            const sharedPurpose = purposes.size === 1 && r.templates.length > 3 ? [...purposes][0] : null;

            return (
              <Reveal key={r.id} className="section">
                <div className="source-head">
                  <TierBadge tier={r.tier} />
                  <Link href={`/r/${r.slug}`}>{r.name}</Link>
                  <span className="domain">{r.domain}</span>
                  <span className="line" aria-hidden />
                  <span className="meta">
                    {r.templates.length}
                    {r.templateCount && r.templateCount > r.templates.length ? ` of ${r.templateCount}` : ""} templates
                  </span>
                </div>

                {sharedPurpose && (
                  <p className="mb-3 px-1 text-[13px] text-fg-3">
                    All {r.templates.length}: {sharedPurpose}
                  </p>
                )}

                <ul className="tpl-grid">
                  {r.templates.slice(0, PER_SOURCE).map((t, i) => (
                    <li key={`${i}-${t.url}`}>
                      <a href={t.url} target="_blank" rel="noreferrer noopener" className="tpl">
                        <span className="frame-media">
                          {t.shot ? (
                            <img src={t.shot} alt="" loading="lazy" decoding="async" width={t.w ?? undefined} height={t.h ?? undefined} />
                          ) : (
                            <span className="frame-mono" aria-hidden>
                              {monogram(t.name)}
                            </span>
                          )}
                        </span>
                        <span className="tpl-name">
                          <span>{t.name}</span>
                          <ArrowUpRightIcon />
                        </span>
                        {!sharedPurpose && t.purpose && <span className="tpl-purpose">{t.purpose}</span>}
                      </a>
                    </li>
                  ))}
                </ul>

                {r.templates.length > PER_SOURCE && (
                  <p className="mt-3 px-1 text-[13px] text-fg-3">
                    Showing {PER_SOURCE} of <span className="numeric">{r.templates.length.toLocaleString()}</span>.{" "}
                    <Link href={`/r/${r.slug}`} className="link">
                      See all of them on the record
                    </Link>
                  </p>
                )}
              </Reveal>
            );
          })}
        </div>
      )}
    </Shell>
  );
}
