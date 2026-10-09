import ResourceCard, { type CardItem } from "./ResourceCard";

export default function CardGrid({
  items,
  categoryNames = {},
  className = "",
}: {
  items: CardItem[];
  categoryNames?: Record<string, string>;
  className?: string;
}) {
  return (
    <ul className={`section-grid ${className}`.trim()}>
      {items.map((r) => (
        <li key={r.slug}>
          <ResourceCard item={r} categoryName={categoryNames[r.category]} />
        </li>
      ))}
    </ul>
  );
}
