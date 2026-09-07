"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";

export type OpenWindow = {
  id: string;
  href: string;
  title: string;
  html: string;
  z: number;

  trimmed: boolean;

  offset: number;
};

type Ctx = {
  windows: OpenWindow[];
  open: (href: string, title: string) => void;
  close: (id: string) => void;
  raise: (id: string) => void;

  routeOpen: boolean;
  hideRoute: () => void;
  showRoute: () => void;
  closeAll: () => void;
  top: number;
};

export type Snapshot = { title: string; html: string; trimmed: boolean };

const NODE_BUDGET = 1200;
const MEM = new Map<string, Snapshot>();
const KEY = (href: string) => `di-win:${norm(href)}`;

export function norm(href: string) {
  if (!href.startsWith("/")) return href;
  return href === "/" ? "/" : `/${href.replace(/^\/+|\/+$/g, "")}/`;
}

export const PRELOAD = [
  { href: "/", label: "Browse" },
  { href: "/categories/", label: "Categories" },
  { href: "/components/", label: "Components" },
  { href: "/surfaces/", label: "Surfaces" },
  { href: "/templates/", label: "Templates" },
  { href: "/agents/", label: "Agents" },
];

export function cached(href: string): Snapshot | null {
  const k = norm(href);
  const hit = MEM.get(k);
  if (hit) return hit;
  try {
    const raw = sessionStorage.getItem(KEY(k));
    if (raw) {
      const snap = JSON.parse(raw) as Snapshot;
      MEM.set(k, snap);
      return snap;
    }
  } catch {

  }
  return null;
}

export async function warm(href: string): Promise<boolean> {
  const k = norm(href);
  if (cached(k)) return true;
  try {
    const res = await fetch(k, { headers: { Accept: "text/html" } });
    if (!res.ok) return false;
    const text = await res.text();

    const markup = text.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "");
    if (markup.length > 4_000_000) return false;

    const doc = new DOMParser().parseFromString(markup, "text/html");
    const body = doc.querySelector(".window-body");
    if (!body) return false;
    body.querySelectorAll(".menubar, .dock, .palette-root, .boot").forEach((n) => n.remove());

    let trimmed = false;
    if (body.querySelectorAll("*").length > NODE_BUDGET) {
      trimmed = true;
      const all = Array.from(body.querySelectorAll("*"));

      for (let i = all.length - 1; i >= 0 && body.querySelectorAll("*").length > NODE_BUDGET; i--) {
        const n = all[i];
        if (!n.isConnected || !n.parentElement || n.parentElement === body) continue;
        if (n.parentElement.children.length > 1) n.remove();
      }
      while (body.querySelectorAll("*").length > NODE_BUDGET && body.lastElementChild) {
        body.lastElementChild.remove();
      }
    }

    body.querySelectorAll("img").forEach((img) => {
      img.setAttribute("loading", "lazy");
      img.setAttribute("decoding", "async");
    });
    const snap: Snapshot = {
      title: doc.querySelector(".title-bar-text")?.textContent?.trim() || k,
      html: body.innerHTML,
      trimmed,
    };
    MEM.set(k, snap);
    try {
      sessionStorage.setItem(KEY(k), JSON.stringify(snap));
    } catch {

    }
    return true;
  } catch {
    return false;
  }
}

const WindowCtx = createContext<Ctx | null>(null);

export function useWindows() {
  const c = useContext(WindowCtx);
  if (!c) throw new Error("useWindows must be used inside WindowManager");
  return c;
}

export default function WindowManager({ children }: { children: React.ReactNode }) {
  const [windows, setWindows] = useState<OpenWindow[]>([]);
  const [routeOpen, setRouteOpen] = useState(true);
  const zRef = useRef(50);
  const openCount = useRef(0);

  const openHrefs = useRef(new Set<string>());

  const close = useCallback((id: string) => {
    setWindows((w) => {
      const gone = w.find((x) => x.id === id);
      if (gone) openHrefs.current.delete(gone.href);
      return w.filter((x) => x.id !== id);
    });
  }, []);

  const raise = useCallback((id: string) => {
    zRef.current += 1;
    const el = document.querySelector<HTMLElement>(`[data-window-id="${CSS.escape(id)}"]`);
    if (el) el.style.zIndex = String(zRef.current);
  }, []);

  const open = useCallback(
    async (href: string, title: string) => {
      const key = norm(href);

      if (openHrefs.current.has(key)) {
        const existing = windows.find((w) => w.href === key);
        if (existing) raise(existing.id);
        return;
      }
      openHrefs.current.add(key);

      let snap = cached(key);
      if (!snap) {
        await warm(key);
        snap = cached(key);
      }

      zRef.current += 1;
      openCount.current += 1;
      setWindows((w) => [
        ...w,
        {
          id: `${key}-${openCount.current}`,
          href: key,
          title: snap?.title ?? title,
          html:
            snap?.html ??
            `<p class="prose">This window could not be read. <a href="${key}">Open ${title} as a page</a>.</p>`,
          trimmed: snap?.trimmed ?? false,
          z: zRef.current,
          offset: openCount.current,
        },
      ]);
    },
    [windows, raise]
  );

  const hideRoute = useCallback(() => setRouteOpen(false), []);
  const showRoute = useCallback(() => setRouteOpen(true), []);

  const closeAll = useCallback(() => {
    setWindows([]);
    setRouteOpen(false);
    openCount.current = 0;
    openHrefs.current.clear();
  }, []);

  const value = useMemo(
    () => ({ windows, open, close, raise, routeOpen, hideRoute, showRoute, closeAll, top: zRef.current }),
    [windows, open, close, raise, routeOpen, hideRoute, showRoute, closeAll]
  );

  return <WindowCtx.Provider value={value}>{children}</WindowCtx.Provider>;
}
