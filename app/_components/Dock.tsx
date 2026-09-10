"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useWindows } from "./WindowManager";

const ICONS: Record<string, React.ReactNode> = {
  browse: (
    <>
      <rect x="1" y="2" width="14" height="3" />
      <rect x="1" y="6.5" width="14" height="3" />
      <rect x="1" y="11" width="14" height="3" />
    </>
  ),
  categories: (
    <>
      <rect x="1" y="1" width="6" height="6" />
      <rect x="9" y="1" width="6" height="6" />
      <rect x="1" y="9" width="6" height="6" />
      <rect x="9" y="9" width="6" height="6" />
    </>
  ),
  components: (
    <>
      <rect x="1" y="1" width="14" height="14" />
      <rect x="4" y="4" width="8" height="4" />
      <rect x="4" y="10" width="4" height="2" />
    </>
  ),
  surfaces: (
    <>
      <rect x="1" y="2" width="14" height="12" />
      <rect x="1" y="2" width="14" height="3" />
      <rect x="3" y="7" width="5" height="5" />
    </>
  ),
  templates: (
    <>
      <rect x="1" y="1" width="14" height="10" />
      <rect x="3" y="3" width="10" height="6" />
      <rect x="4" y="13" width="8" height="2" />
    </>
  ),
  learn: (
    <>
      <path d="M1 2h5c1.1 0 2 .9 2 2v10c-.5-.8-1.2-1.2-2.2-1.2H1V2Z" />
      <path d="M15 2h-5c-1.1 0-2 .9-2 2v10c.5-.8 1.2-1.2 2.2-1.2H15V2Z" />
    </>
  ),
  agents: (
    <>
      <rect x="2" y="3" width="12" height="9" />
      <rect x="5" y="6" width="2" height="2" />
      <rect x="9" y="6" width="2" height="2" />
      <rect x="7" y="12" width="2" height="3" />
    </>
  ),
};

const TILES = [
  { href: "/", label: "Browse", icon: "browse" },
  { href: "/categories", label: "Categories", icon: "categories" },
  { href: "/learn", label: "Learn", icon: "learn" },
  { href: "/components", label: "Components", icon: "components" },
  { href: "/surfaces", label: "Surfaces", icon: "surfaces" },
  { href: "/templates", label: "Templates", icon: "templates" },
  { href: "/agents", label: "Agents", icon: "agents" },
];

export default function Dock() {
  const pathname = usePathname();
  const { open } = useWindows();
  return (
    <nav className="dock" aria-label="Applications">
      <ul className="dock-tiles">
        {TILES.map((t) => {
          const active = t.href === "/" ? pathname === "/" : pathname.startsWith(t.href);
          return (
            <li key={t.href}>
              <Link
                href={t.href}
                className={`dock-tile${active ? " is-active" : ""}`}
                aria-current={active ? "page" : undefined}
                onClick={(e) => {

                  if (e.metaKey || e.ctrlKey || e.shiftKey) return;
                  e.preventDefault();
                  e.stopPropagation();
                  open(t.href, t.label);
                }}
              >
                <svg viewBox="0 0 16 16" aria-hidden className="dock-icon">
                  {ICONS[t.icon]}
                </svg>
                <span className="dock-label">{t.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
