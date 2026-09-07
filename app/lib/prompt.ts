import type { Resource } from "./types";

export function buildPrompt(r: Resource): string {
  const f = (k: string) => {
    const v = r.facets?.[k];
    return Array.isArray(v) ? v.join(", ") : v || "";
  };
  const lines = [
    `Use the following design resource in my project:`,
    ``,
    `**${r.name}** — ${r.tagline || r.description}`,
    `URL: ${r.url}`,
    `Kind: ${r.kinds.join(", ")}`,
  ];
  if (r.install) lines.push(`Install: ${r.install}`);
  if (r.pkg) lines.push(`Package: ${r.pkg}`);
  if (r.docsUrl) lines.push(`Docs: ${r.docsUrl}`);
  if (r.repoUrl) lines.push(`Repo: ${r.repoUrl}`);
  if (r.registryUrl) lines.push(`Registry: ${r.registryUrl}`);
  if (f("framework")) lines.push(`Framework: ${f("framework")}`);
  if (f("styling")) lines.push(`Styling: ${f("styling")}`);
  if (f("license")) lines.push(`License: ${f("license")}`);
  if (f("pricing")) lines.push(`Pricing: ${f("pricing")}${r.pricingDetail ? ` (${r.pricingDetail})` : ""}`);
  if (r.components.length) lines.push(`Provides components: ${r.components.join(", ")}`);
  if (r.surfaces.length) lines.push(`Useful for surfaces: ${r.surfaces.join(", ")}`);
  if (r.agentGuidance) lines.push(``, `Guidance: ${r.agentGuidance}`);
  lines.push(
    ``,
    `Before writing UI, read DESIGN.md in the repo root and match its tokens.`,
    `Do not introduce a new button, card, or radius style that DESIGN.md does not define.`
  );
  return lines.join("\n");
}
