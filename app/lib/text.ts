const UPPER = new Set([
  "ai", "ui", "ux", "api", "css", "svg", "mcp", "cli", "seo", "rtl", "3d",
  "mit", "bsd", "isc", "ofl", "cc0", "agpl", "gpl", "lgpl", "mpl", "npm", "cdn", "json", "saas", "llm",
]);

export function labelize(slug: string): string {
  return slug
    .split(/[-_]/)
    .filter(Boolean)
    .map((w) => (UPPER.has(w.toLowerCase()) ? w.toUpperCase() : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(" ");
}

export function tierLabel(t: string): string {
  return { S: "Best in class", A: "Strong", B: "Useful", C: "Weak" }[t] ?? t;
}
