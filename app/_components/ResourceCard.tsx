"use client";

import Link from "next/link";
import { m } from "motion/react";
import type { Tier } from "../lib/types";
import { labelize, monogram, tierLabel } from "../lib/text";
import { catStyle } from "./primitives";
import { ComponentIcon, StarIcon } from "./icons";

export type CardItem = {
  slug: string;
  name: string;
  tagline: string;
  category: string;
  tier: Tier;
  kinds?: string[];
  componentCount?: number | null;
  components?: string[];
  img?: string | null;
  hasImage?: boolean;
  imageKey?: string;
};

export function cardImage(r: CardItem): string | null {
  return r.img ?? (r.hasImage && r.imageKey ? `/og/${r.imageKey}.webp` : null);
}

export default function ResourceCard({ item, categoryName }: { item: CardItem; categoryName?: string }) {
  const img = cardImage(item);
  const count = item.componentCount ?? item.components?.length ?? 0;
  const kinds = (item.kinds ?? []).slice(0, 2);
  const badge =
    item.tier === "S" ? { label: "Best in class", glass: false } : item.tier === "A" ? { label: "Strong pick", glass: true } : null;

  return (
    <m.div
      className="card-motion"
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.985 }}
      transition={{ type: "spring", stiffness: 420, damping: 30, mass: 0.7 }}
    >
      <Link href={`/r/${item.slug}`} className="card-link" draggable={false}>
        <span className="frame">
          <span className="frame-panel">
            <span className="frame-media">
              {badge && (
                <span
                  className={`frame-badge${badge.glass ? " is-glass" : ""}`}
                  title={`Quality tier ${item.tier}: ${tierLabel(item.tier)}`}
                >
                  <StarIcon />
                  {badge.label}
                </span>
              )}
              {img ? (
                <img src={img} alt="" loading="lazy" decoding="async" draggable={false} />
              ) : (
                <span className="frame-mono" aria-hidden>
                  {monogram(item.name)}
                </span>
              )}
            </span>
            <span className="frame-body">
              <span className="frame-title-row">
                <span className="frame-title">{item.name}</span>
                {count > 0 && (
                  <span className="frame-count" title={`${count.toLocaleString()} components`}>
                    <ComponentIcon />
                    {count.toLocaleString()}
                  </span>
                )}
              </span>
              <span className="frame-desc">{item.tagline}</span>
              <span className="frame-tags">
                <span className="tag" style={catStyle(item.category)}>
                  <span className="dot" aria-hidden />
                  {categoryName ?? labelize(item.category)}
                </span>
                {kinds.map((k) => (
                  <span key={k} className="tag muted">
                    {labelize(k)}
                  </span>
                ))}
              </span>
            </span>
          </span>
        </span>
      </Link>
    </m.div>
  );
}
