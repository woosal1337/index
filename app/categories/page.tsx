import Link from "next/link";
import Shell from "../_components/Shell";
import { catStyle, PageHead } from "../_components/primitives";
import { Reveal } from "../_components/motion";
import { TagIcon } from "../_components/icons";
import { getCategories, getIndexes, getResources } from "../lib/data";
import { byTierThenName } from "../lib/rows";
import { monogram } from "../lib/text";
import { ogImageUrl } from "../lib/media";
import { pageMetadata } from "../lib/site";

export function generateMetadata() {
  return pageMetadata("/categories", "Categories",
    `${getCategories().length} design resource categories. Browse subcategories and resource counts.`);
}

export default function CategoriesPage() {
  const resources = getResources();
  const categories = getCategories();
  const { categoryCounts } = getIndexes();

  const rows = categories
    .map((c) => {
      const n = categoryCounts[c.slug] ?? 0;
      const shots = resources
        .filter((r) => r.category === c.slug && r.hasImage)
        .sort(byTierThenName)
        .slice(0, 3)
        .map((r) => ({ key: r.imageKey, name: r.name }));
      return { ...c, n, shots };
    })
    .filter((c) => c.n > 0)
    .sort((a, b) => b.n - a.n);

  return (
    <Shell>
      <PageHead
        icon={<TagIcon />}
        title="Categories"
        meta={`${rows.length} categories · ${resources.length.toLocaleString()} resources`}
        intro="Each category keeps one design axis separate. Open a category to filter its resources, or switch to the canvas to explore all of them."
      />

      <ul className="cat-cards">
        {rows.map((c, i) => (
          <li key={c.slug}>
            <Reveal className="h-full" delay={Math.min(i, 8) * 0.03}>
              <Link href={`/categories/${c.slug}`} className="cat-card" style={catStyle(c.slug)}>
                <span className="fan" aria-hidden>
                  {[0, 1, 2].map((k) => {
                    const shot = c.shots[k];
                    return (
                      <span key={k} className="fan-card">
                        {shot ? (
                          <img src={ogImageUrl(shot.key)} alt="" loading="lazy" decoding="async" />
                        ) : (
                          <span className="frame-mono">{monogram(c.name)}</span>
                        )}
                      </span>
                    );
                  })}
                </span>
                <span className="cat-name">
                  <span className="dot" aria-hidden />
                  {c.name}
                </span>
                <span className="cat-count">
                  {c.n.toLocaleString()} {c.n === 1 ? "resource" : "resources"}
                </span>
                <span className="cat-desc">{c.description}</span>
              </Link>
            </Reveal>
          </li>
        ))}
      </ul>
    </Shell>
  );
}
