import type { Metadata } from "next";
import type { Stats } from "./types";

export const SITE_TITLE = "Index: a design corpus your agent can read";

export function siteOrigin(value = process.env.NEXT_PUBLIC_SITE_URL): string {
  const url = new URL(value?.trim() || "https://index.chele.bi");
  if (!["https:", "http:"].includes(url.protocol) || url.username || url.password
    || url.pathname !== "/" || url.search || url.hash) {
    throw new Error("NEXT_PUBLIC_SITE_URL must be an HTTP or HTTPS origin without credentials, a path, or a query.");
  }
  return url.origin;
}

export function siteUrl(path: string): string {
  return `${siteOrigin()}${path === "/" ? "/" : `${path.replace(/\/$/, "")}/`}`;
}

export function catalogDescription(stats: Pick<Stats, "resources" | "vocabComponents" | "vocabSurfaces">): string {
  return `${stats.resources.toLocaleString("en-US")} design resources, tagged against ${stats.vocabComponents.toLocaleString("en-US")} components and ${stats.vocabSurfaces.toLocaleString("en-US")} app surfaces. Find libraries, templates, and references for your next project.`;
}

export function pageMetadata(path: string, title: string, description?: string): Metadata {
  const url = siteUrl(path);
  const socialTitle = path === "/" ? title : `${title} · Index`;
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { type: "website", siteName: "Index", title: socialTitle, description, url },
    twitter: { card: "summary", title: socialTitle, description },
  };
}
