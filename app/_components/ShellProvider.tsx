"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { OA_EVENTS, track } from "../lib/analytics";

export type View = "grid" | "canvas";

const VIEW_KEY = "di-view";

type Ctx = {
  view: View;
  setView: (next: View) => void;
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
};

const ShellCtx = createContext<Ctx | null>(null);

export function useShell(): Ctx {
  const ctx = useContext(ShellCtx);
  if (!ctx) throw new Error("useShell must be used inside ShellProvider");
  return ctx;
}

export default function ShellProvider({ children }: { children: React.ReactNode }) {
  const [view, setViewState] = useState<View>("grid");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const current = useRef<View>("grid");

  useEffect(() => {
    try {
      if (localStorage.getItem(VIEW_KEY) === "canvas") {
        current.current = "canvas";
        setViewState("canvas");
      }
    } catch {
      return;
    }
  }, []);

  const setView = useCallback((next: View) => {
    if (next !== current.current) track(OA_EVENTS.viewSwitch, { view: next });
    current.current = next;
    setViewState(next);
    try {
      if (next === "canvas") localStorage.setItem(VIEW_KEY, "canvas");
      else localStorage.removeItem(VIEW_KEY);
    } catch {
      return;
    }
  }, []);

  const value = useMemo(
    () => ({ view, setView, sidebarOpen, setSidebarOpen }),
    [view, setView, sidebarOpen]
  );

  return <ShellCtx.Provider value={value}>{children}</ShellCtx.Provider>;
}
