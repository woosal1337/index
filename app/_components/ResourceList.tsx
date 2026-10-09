import Link from "next/link";
import { previewOf, type RowLite } from "../lib/rows";
import { labelize } from "../lib/text";
import { catStyle, TierBadge } from "./primitives";

const F = "|";
const L = ",";

export default function ResourceList({
  rows,
  className = "",
  emptyText = "Nothing matches.",
  categoryNames = {},
}: {
  rows: RowLite[];
  className?: string;
  emptyText?: string;
  categoryNames?: Record<string, string>;
}) {
  if (!rows.length) {
    return <p className={`py-10 text-center text-[14px] text-fg-3 ${className}`}>{emptyText}</p>;
  }
  return (
    <ul className={`rows ${className}`.trim()}>
      {rows.map((r) => {
        const p = previewOf(r);
        const packed = p
          ? [p.img ?? "", p.tags.join(L), String(p.more), p.facts.join(L)].join(F)
          : undefined;
        return (
          <li key={r.slug} style={catStyle(r.category)}>
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
              <span className="cat">{categoryNames[r.category] ?? labelize(r.category)}</span>
              <TierBadge tier={r.tier} />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
