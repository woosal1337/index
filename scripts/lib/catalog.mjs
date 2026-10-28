import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export function loadTaxonomy(root) {
  const read = (f) => JSON.parse(readFileSync(join(root, f), "utf8"));
  const categories = read("taxonomy/categories.json");
  return {
    facets: read("taxonomy/facets.json").facets,
    components: read("taxonomy/components.json").groups.flatMap((g) => g.components),
    surfaces: read("taxonomy/surfaces.json").groups.flatMap((g) => g.surfaces),
    kinds: categories.kinds,
    styles: read("taxonomy/styles.json").styles,
    categories: categories.categories,
  };
}

export function loadCatalog(root) {
  const read = (f) => JSON.parse(readFileSync(join(root, f), "utf8"));
  return {
    resources: read("data/dist/resources.json"),
    items: existsSync(join(root, "data/dist/items.json")) ? read("data/dist/items.json") : [],
    taxonomy: loadTaxonomy(root),
  };
}
