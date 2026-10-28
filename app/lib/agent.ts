export const SEARCH_ORIGIN = "https://index-mcp.chele.bi";

export const ABOUT = "Index is a reviewed catalog of design resources: component libraries, shadcn registries, templates, fonts, icons, motion, inspiration galleries, studios, and design tools for agents.";

export const SEARCH_RULES = [
  "Read the project stack first (package.json, the Tailwind config) and pass it as filters.",
  'Ask for one need per search. Describe the need, for example "date range picker with presets", instead of a guessed product name.',
  'Use component or surface when the need is a UI part or a page type. For a look, put a style in the query, for example "brutalist portfolio" or "dark glow homepage".',
  'Treat match "weak" or "none" as a real answer. Widen the filters, or call component_guide and build the part yourself.',
  "Call fetch on your pick and check its license before you install it.",
];
