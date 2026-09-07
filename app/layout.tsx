import type { Metadata } from "next";
import "./globals.css";
import LayoutDebug from "./_components/LayoutDebug";
import Analytics from "./_components/Analytics";
import { getStats } from "./lib/data";
import { catalogDescription, SITE_TITLE, siteOrigin } from "./lib/site";

export function generateMetadata(): Metadata {
  return {
    metadataBase: new URL(siteOrigin()),
    title: { default: SITE_TITLE, template: "%s · Index" },
    description: catalogDescription(getStats()),
  };
}

const themeScript = `(function(){try{if(localStorage.getItem("di-theme")==="light"){document.documentElement.setAttribute("data-theme","light")}}catch(e){}})()`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <meta name="theme-color" content="#09090b" />
        <link rel="alternate" type="application/json" href="/api/resources.json" />
      </head>
      <body>
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:bg-fg focus:px-4 focus:py-2 focus:text-page"
        >
          Skip to content
        </a>
        {children}
        <LayoutDebug />
        <Analytics />
      </body>
    </html>
  );
}
