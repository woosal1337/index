import Link from "next/link";
import Shell from "../_components/Shell";
import { Empty, PageHead, TierMark } from "../_components/primitives";
import { getResources, getStats } from "../lib/data";
import { pageMetadata } from "../lib/site";

export function generateMetadata() {
  return pageMetadata("/templates", "Templates",
    `${getStats().templates.toLocaleString("en-US")} templates from design galleries and starter kits. Browse references and visit each source.`);
}

function monogram(s: string) {
  return (s || "??").replace(/[^A-Za-z0-9]/g, "").slice(0, 2).toUpperCase() || "··";
}

const PER_SOURCE = 10;

export default function TemplatesPage() {
  const resources = getResources();
  const withTemplates = resources
    .filter((r) => r.templates.length > 0)
    .sort((a, b) => b.templates.length - a.templates.length);

  const total = withTemplates.reduce((s, r) => s + r.templates.length, 0);
  const shots = withTemplates.reduce((s, r) => s + r.templates.filter((t) => t.shot).length, 0);
  const claimed = withTemplates.reduce((s, r) => s + (r.templateCount ?? r.templates.length), 0);

  return (
    <Shell title="Templates" wide>
      <PageHead
        title={
          <>
            Templates
          </>
        }
        intro={
          <>
            Directories stop at the gallery. A single template is often the seed of an entire project, so we
            opened the galleries and indexed what is inside them: <span className="tnum">{total.toLocaleString()}</span>{" "}
            individual templates across {withTemplates.length} sources
            {claimed > total ? (
              <>
                {" "}
                (those sources advertise <span className="tnum">{claimed.toLocaleString()}</span> in total)
              </>
            ) : null}
            .
          </>
        }
        meta={
          <>
            <span className="tnum">{shots.toLocaleString()}</span> previews captured, each one a real screenshot of
            the template page
          </>
        }
      />

      {withTemplates.length === 0 ? (
        <Empty>No templates indexed yet.</Empty>
      ) : (
        <div className="space-y-12">
          {withTemplates.map((r) => {
            const purposes = new Set(r.templates.map((t) => (t.purpose || "").trim()));
            const sharedPurpose = purposes.size === 1 && r.templates.length > 3 ? [...purposes][0] : null;

            return (
              <section key={r.id}>

                <div className="row static border-b border-line pb-2">
                  <TierMark tier={r.tier} />
                  <Link href={`/r/${r.slug}`} className="main text-[15px] hover:underline">
                    {r.name}
                    <span className="desc"> · {r.domain}</span>
                  </Link>
                  <span className="leader" aria-hidden />
                  <span className="meta">
                    {r.templates.length}
                    {r.templateCount && r.templateCount > r.templates.length ? ` of ${r.templateCount}` : ""} templates
                  </span>
                </div>

                {sharedPurpose && <p className="mt-2 max-w-[70ch] text-[13px] text-fg-4">All {r.templates.length}: {sharedPurpose}</p>}

                <ul className="mt-4 grid grid-cols-2 gap-x-3 gap-y-5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                  {r.templates.slice(0, PER_SOURCE).map((t) => (
                    <li key={t.url + t.name}>
                      <a
                        href={t.url}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="group block [contain-intrinsic-size:auto_200px] [content-visibility:auto]"
                      >
                        <div className="relative aspect-[1200/750] overflow-hidden border border-line bg-surface transition-colors group-hover:border-line-strong">
                          <span className="absolute inset-0 flex items-center justify-center font-mono text-xl font-medium text-fg-4/50">
                            {monogram(t.name)}
                          </span>
                          {t.shot ? (

                            <img
                              src={t.shot}
                              alt=""
                              loading="lazy"
                              decoding="async"
                              width={t.w ?? undefined}
                              height={t.h ?? undefined}
                              className="relative h-full w-full object-cover object-top"
                            />
                          ) : null}
                        </div>
                        <div className="mt-1.5 flex items-start gap-1.5">
                          <span className="line-clamp-1 flex-1 text-[13px] text-fg-2 transition-colors group-hover:text-fg">
                            {t.name}
                          </span>
                          <span className="label mt-px opacity-0 transition-opacity group-hover:opacity-100">↗</span>
                        </div>
                        {!sharedPurpose && t.purpose && (
                          <span className="mt-0.5 line-clamp-1 block text-[12px] text-fg-4">{t.purpose}</span>
                        )}
                      </a>
                    </li>
                  ))}
                </ul>

                {r.templates.length > PER_SOURCE && (
                  <p className="mt-3 text-[13px] text-fg-3">
                    Showing {PER_SOURCE} of{" "}
                    <span className="numeric">{r.templates.length.toLocaleString()}</span>.{" "}
                    <Link href={`/r/${r.slug}`} className="underline underline-offset-2 hover:bg-accent">
                      See them all on the record
                    </Link>
                    .
                  </p>
                )}
              </section>
            );
          })}
        </div>
      )}
    </Shell>
  );
}
