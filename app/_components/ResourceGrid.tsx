import Link from "next/link";
import type { CSSProperties } from "react";
import { previewOf, type RowLite } from "../lib/rows";
import { labelize, tierLabel } from "../lib/text";

function monogram(s: string) {
  return (s || "??").replace(/[^A-Za-z0-9]/g, "").slice(0, 2).toUpperCase() || "··";
}

export default function ResourceGrid({
  rows,
  className = "",
  emptyText = "Nothing matches.",
}: {
  rows: RowLite[];
  className?: string;
  emptyText?: string;
}) {
  if (!rows.length) {
    return <p className={`py-8 text-[15px] text-fg-3 ${className}`}>{emptyText}</p>;
  }
  return (
    <ul className={`cards ${className}`}>
      {rows.map((r) => {
        const p = previewOf(r);
        const tags = p?.tags.slice(0, 3).map(labelize) ?? [];
        return (
          <li key={r.slug} style={{ "--dot": `var(--cat-${r.category}, var(--fg))` } as CSSProperties}>
            <Link href={`/r/${r.slug}`} className="card" title={r.tagline}>
              <span className="card-frame">
                <span className="card-mono" aria-hidden>
                  {monogram(r.name)}
                </span>
                {p?.img && (

                  <img src={p.img} alt="" loading="lazy" decoding="async" className="card-shot" />
                )}
              </span>
              <span className="card-head">
                <span className="dot" aria-hidden />
                <span className="card-name">{r.name}</span>
                <span className="card-tier" title={`Quality tier ${r.tier}: ${tierLabel(r.tier)}`}>
                  {r.tier === "S" || r.tier === "A" ? <b>{r.tier}</b> : r.tier}
                </span>
              </span>
              {r.tagline && <span className="card-tagline">{r.tagline}</span>}
              {tags.length > 0 && (
                <span className="card-tags">
                  {tags.join(" · ")}
                  {p && p.more > 0 && p.tags.length > tags.length && (
                    <>
                      {" +"}
                      <span className="tnum">{(p.more + p.tags.length - tags.length).toLocaleString()}</span>
                    </>
                  )}
                </span>
              )}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
