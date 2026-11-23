"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { AnimatePresence, m } from "motion/react";
import { openPalette } from "./CommandPalette";
import { useShell, type View } from "./ShellProvider";
import ThemeSelect from "./ThemeSelect";
import {
  AgentIcon,
  BookIcon,
  DashboardIcon,
  ExpandIcon,
  GithubIcon,
  GridDotsIcon,
  ImageIcon,
  LayersIcon,
  LogoIcon,
  PortfolioIcon,
  PuzzleIcon,
  SearchIcon,
  StudioIcon,
  TagIcon,
  TemplateIcon,
} from "./icons";

const NAV = [
  { href: "/", label: "Browse", Icon: DashboardIcon },
  { href: "/categories", label: "Categories", Icon: TagIcon },
  { href: "/components", label: "Components", Icon: PuzzleIcon },
  { href: "/surfaces", label: "Surfaces", Icon: LayersIcon },
  { href: "/templates", label: "Templates", Icon: TemplateIcon },
  { href: "/studios", label: "Studios", Icon: StudioIcon },
  { href: "/portfolios", label: "Portfolios", Icon: PortfolioIcon },
  { href: "/mood", label: "Mood", Icon: ImageIcon },
  { href: "/learn", label: "Learn", Icon: BookIcon },
  { href: "/agents", label: "Agents", Icon: AgentIcon },
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/" || pathname.startsWith("/r/");
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function ViewToggle({ view, onChange, lg = false }: { view: View; onChange: (next: View) => void; lg?: boolean }) {
  const canvas = view === "canvas";
  const label = canvas ? "Switch to the grid view" : "Switch to the canvas view";
  return (
    <button
      type="button"
      className={`view-toggle${lg ? " lg" : ""}`}
      role="switch"
      aria-checked={canvas}
      aria-label={label}
      title={label}
      onClick={() => onChange(canvas ? "grid" : "canvas")}
    >
      <span className="view-toggle-knob" style={{ transform: canvas ? "translateX(100%)" : "translateX(0)" }} aria-hidden />
      <span className="view-toggle-icons" aria-hidden>
        <GridDotsIcon className={canvas ? "" : "is-on"} />
        <ExpandIcon className={canvas ? "is-on" : ""} />
      </span>
    </button>
  );
}

export function Brand() {
  return (
    <Link href="/" className="sb-brand" aria-label="Index, home">
      <span className="sb-logo">
        <LogoIcon />
      </span>
      <span className="sb-brand-text">
        <span className="sb-brand-name">Index</span>
        <span className="sb-brand-sub">Design corpus</span>
      </span>
    </Link>
  );
}

export default function AppSidebar({ count, updated }: { count: number; updated: string }) {
  const pathname = usePathname() ?? "/";
  const { sidebarOpen, setSidebarOpen } = useShell();

  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname, setSidebarOpen]);

  useEffect(() => {
    if (!sidebarOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSidebarOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sidebarOpen, setSidebarOpen]);

  return (
    <>
      <AnimatePresence>
        {sidebarOpen && (
          <m.div
            key="scrim"
            className="scrim"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => setSidebarOpen(false)}
            aria-hidden
          />
        )}
      </AnimatePresence>

      <aside className={`app-sidebar${sidebarOpen ? " is-open" : ""}`} aria-label="Sidebar">
        <Brand />

        <button type="button" className="sb-search" onClick={openPalette} aria-label="Search resources">
          <SearchIcon />
          <span>Search resources</span>
          <kbd>⌘K</kbd>
        </button>

        <p className="sb-label">Navigation</p>
        <nav className="sb-nav" aria-label="Main">
          {NAV.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <div key={item.href} className="sb-item-wrap">
                <Link
                  href={item.href}
                  className={`sb-item${active ? " is-active" : ""}`}
                  aria-current={active ? "page" : undefined}
                >
                  {active && (
                    <m.span
                      layoutId="sb-pill"
                      className="sb-pill"
                      transition={{ type: "spring", stiffness: 520, damping: 42 }}
                      aria-hidden
                    />
                  )}
                  <item.Icon />
                  <span>{item.label}</span>
                </Link>
              </div>
            );
          })}
        </nav>

        <div className="sb-footer">
          <ThemeSelect />
          <a className="sb-item" href="https://github.com/woosal1337/index" target="_blank" rel="noreferrer noopener">
            <GithubIcon />
            <span>GitHub</span>
          </a>
          <p className="sb-meta">
            <span className="mono">{count.toLocaleString()}</span> resources · updated {updated}
          </p>
        </div>
      </aside>
    </>
  );
}
