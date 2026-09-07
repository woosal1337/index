import Link from "next/link";
import type { CSSProperties } from "react";
import { previewOf, type RowLite } from "../lib/rows";
import { tierLabel } from "../lib/text";

const F = "|";
const L = ",";

export default function ResourceList({
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
    <ul className={`rows ${className}`}>
      {rows.map((r) => {
        const p = previewOf(r);

        const packed = p
          ? [p.img ?? "", p.tags.join(L), String(p.more), p.facts.join(L)].join(F)
          : undefined;
        return (
          <li key={r.slug} style={{ "--dot": `var(--cat-${r.category}, var(--fg))` } as CSSProperties}>
            <Link
              href={`/r/${r.slug}`}
              className="row"
              title={packed ? undefined : r.tagline}
              data-preview={packed}
            >
              <span className="dot" aria-hidden />
              <span className="main">
                {r.name}
                {r.tagline && <span className="desc"> · {r.tagline}</span>}
              </span>
              <span className="leader" aria-hidden />
              <span className="meta" title={`Quality tier ${r.tier}: ${tierLabel(r.tier)}`}>
                {r.tier === "S" || r.tier === "A" ? <b>{r.tier}</b> : r.tier}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
