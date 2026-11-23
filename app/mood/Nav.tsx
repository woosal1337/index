"use client";

import { useEffect, useState } from "react";
import { OA_EVENTS, track } from "./lib/analytics";
import { type Deck, type Mode } from "./lib/plane";

const EDGE = 72;

type Props = {
  counts: Deck["counts"];
  mode: Mode;
  onMode: (next: Mode) => void;
  onSearch: () => void;
  rest: boolean;
  railOpen: boolean;
};

export default function Nav({ counts, mode, onMode, onSearch, rest, railOpen }: Props) {
  const [near, setNear] = useState(false);

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const hit = e.clientY < EDGE;
      setNear((was) => (was === hit ? was : hit));
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, []);

  return (
    <nav
      className="nav glass-surface"
      data-show={rest || near || undefined}
      style={{ ["--nav-left" as string]: railOpen ? "272px" : "64px" }}
    >
      <span className="nav-mark">mood.</span>

      <span className="nav-strap">
        <span className="nav-lead">Two ways to look.</span> Grid for scanning.
        Infinity for losing yourself in it.
      </span>

      <span className="nav-right">
        <span className="nav-seg" role="group" aria-label="View">
          <button
            data-on={mode === "infinity" || undefined}
            onClick={() => onMode("infinity")}
            aria-pressed={mode === "infinity"}
          >
            Infinity
          </button>
          <button
            data-on={mode === "grid" || undefined}
            onClick={() => onMode("grid")}
            aria-pressed={mode === "grid"}
          >
            Grid
          </button>
        </span>

        <button className="nav-link" onClick={onSearch}>
          Search
        </button>

        <span className="nav-count tnum mono">{counts.items.toLocaleString()}</span>

        <a
          className="nav-pill"
          href="https://x.com/woosal1337"
          target="_blank"
          rel="noreferrer"
          onClick={() => track(OA_EVENTS.boardSource, { where: "nav" })}
        >
          @woosal1337
        </a>
      </span>
    </nav>
  );
}
