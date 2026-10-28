import CardGrid from "./CardGrid";
import { PageHead, Tag } from "./primitives";
import { Reveal } from "./motion";
import type { CardItem } from "./ResourceCard";
import type { RankedGroup } from "../lib/ranked";
import type { Resource } from "../lib/types";

const toCard = (r: Resource): CardItem => ({
  slug: r.slug,
  name: r.name,
  tagline: r.tagline,
  category: r.category,
  tier: r.tier,
  kinds: r.kinds,
  componentCount: r.componentCount,
  hasImage: r.hasImage,
  imageKey: r.imageKey,
});

export default function RankedSection({
  title,
  icon,
  intro,
  unit,
  groups,
  categoryNames,
}: {
  title: string;
  icon: React.ReactNode;
  intro: React.ReactNode;
  unit: { one: string; many: string };
  groups: RankedGroup[];
  categoryNames: Record<string, string>;
}) {
  const items = groups.flatMap((g) => g.items);
  const top = items.filter((r) => r.tier === "S" || r.tier === "A").length;
  const label = (n: number) => `${n.toLocaleString()} ${n === 1 ? unit.one : unit.many}`;

  return (
    <>
      <PageHead icon={icon} title={title} meta={`${label(items.length)} · ${top} top ${top === 1 ? "pick" : "picks"}`} intro={intro}>
        {groups.length > 1 &&
          groups.map((g) => (
            <Tag key={g.slug} n={g.items.length} title={g.description} muted>
              {g.name}
            </Tag>
          ))}
      </PageHead>

      <div className="grid gap-6">
        {groups.map((g) => (
          <Reveal key={g.slug}>
            <section aria-labelledby={`group-${g.slug}`}>
              <div className="section-title">
                <span id={`group-${g.slug}`}>{g.name}</span>
                <span className="meta">{label(g.items.length)}</span>
              </div>
              <div className="section">
                <CardGrid items={g.items.map(toCard)} categoryNames={categoryNames} />
              </div>
            </section>
          </Reveal>
        ))}
      </div>
    </>
  );
}
