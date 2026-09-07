"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { openPalette } from "./CommandPalette";
import { useWindows } from "./WindowManager";
import ThemeToggle from "./ThemeToggle";

export default function MenuBar({ count }: { count: number }) {
  const [now, setNow] = useState<Date | null>(null);
  const { windows, routeOpen, closeAll } = useWindows();
  const openCount = windows.length + (routeOpen ? 1 : 0);

  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const date = now
    ? now
        .toLocaleDateString("en-GB", { weekday: "short", day: "2-digit", month: "short", year: "numeric" })
        .toUpperCase()
    : "";
  const time = now
    ? now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })
    : "";

  return (
    <div className="menubar">
      <Link href="/" className="menubar-mark" aria-label="Index, home">
        <span className="wordmark">Index</span>
      </Link>

      <span className="menubar-chip">
        <span className="numeric">{count.toLocaleString()}</span> resources
      </span>

      <button type="button" className="menubar-chip is-button" onClick={openPalette}>
        Search
        <kbd className="menubar-kbd">⌘K</kbd>
      </button>

      {openCount > 0 ? (
        <button
          type="button"
          className="menubar-chip is-button"
          onClick={closeAll}
          title="Close every window and leave the desktop"
        >
          Close all
          <span className="numeric">{openCount}</span>
        </button>
      ) : null}

      <span className="menubar-spacer" />

      <span className="menubar-chip is-right numeric">{date}</span>
      <span className="menubar-chip is-right numeric">{time}</span>
      <span className="menubar-chip is-right">
        <ThemeToggle />
      </span>
    </div>
  );
}
