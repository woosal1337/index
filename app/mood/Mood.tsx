"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Canvas, { type CanvasHandle } from "./Canvas";
import { LayersIcon, ResetIcon, SearchIcon } from "../_components/icons";
import Search from "./Search";
import Tools from "./Tools";
import Viewer from "./Viewer";
import { OA_EVENTS, track } from "./lib/analytics";
import { MODES, buildPlane, type Deck, type Mode } from "./lib/plane";
import "./mood.css";

const SHAPE: Record<Mode, { unit: number; gap: number }> = {
  infinity: { unit: 260, gap: 6 },
  grid: { unit: 220, gap: 10 },
};

const MODE_KEY = "mood.view";

export type Raw = {
  counts: Deck["counts"];
  boards: { a: string; n: string; t: string; x: string; u: string; d: string; l: number; b: number; i: number[]; h?: string; s?: string }[];
  items: [string, number, number, number, 0 | 1 | 2][];
};

export default function Mood({
  src = "data/mood.json",
  only = null,
  rail = false,
  switcher = null,
}: {
  src?: string;
  only?: Set<string> | null;
  rail?: boolean;
  switcher?: React.ReactNode;
}) {
  const [full, setFull] = useState<Deck | null>(null);
  const deck = useMemo(() => (full && only ? subset(full, only) : full), [full, only]);
  const [failed, setFailed] = useState(false);
  const [view, setView] = useState<{ item: number; rect: DOMRect } | null>(null);
  const [searching, setSearching] = useState(false);
  const [match, setMatch] = useState<Set<number> | null>(null);
  const [hint, setHint] = useState(true);
  const [mode, setMode] = useState<Mode>("infinity");

  const canvas = useRef<CanvasHandle>(null);
  const stage = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let alive = true;
    fetch(src)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((raw: Raw) => alive && setFull(decode(raw)))
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, [src]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(MODE_KEY);
      if (saved && (MODES as string[]).includes(saved)) setMode(saved as Mode);
    } catch {
    }
  }, []);

  const plane = useMemo(
    () => (deck?.items.length ? buildPlane(deck.items, SHAPE[mode].unit, SHAPE[mode].gap, mode) : null),
    [deck, mode]
  );

  const pickMode = useCallback((next: Mode) => {
    setMode((now) => {
      if (now === next) return now;
      try {
        localStorage.setItem(MODE_KEY, next);
      } catch {
      }
      track(OA_EVENTS.viewSwitch, { view: next });
      return next;
    });
  }, []);

  const cycle = useCallback(() => {
    setMode((now) => {
      const next = MODES[(MODES.indexOf(now) + 1) % MODES.length];
      try {
        localStorage.setItem(MODE_KEY, next);
      } catch {
      }
      track(OA_EVENTS.viewSwitch, { view: next });
      return next;
    });
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setHint(false), 7000);
    return () => clearTimeout(t);
  }, []);

  const closeSearch = useCallback(() => {
    setSearching(false);
    setMatch(null);
  }, []);

  const dismissHint = useCallback(() => setHint(false), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      if (view) return;

      if (e.key === "/") {
        e.preventDefault();
        setSearching(true);
        track(OA_EVENTS.searchOpen, { key: "slash" });
      } else if (e.key === "Escape" && searching) {
        e.preventDefault();
        closeSearch();
      } else if (e.key === "v" || e.key === "V") {
        cycle();
      } else if (e.key === "0" || e.key === "h") {
        canvas.current?.home();
        track(OA_EVENTS.planeHome, { key: e.key });
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [view, searching, closeSearch, cycle]);

  useEffect(() => {
    document.documentElement.setAttribute("data-view", "canvas");
    return () => document.documentElement.removeAttribute("data-view");
  }, []);

  const onOpen = useCallback(
    (item: number, rect: DOMRect) => {
      const href = deck?.boards[deck.items[item].board]?.href;
      if (href) {
        if (deck) track(OA_EVENTS.imageOpen, describe(deck, item));
        window.open(href, "_blank", "noopener");
        return;
      }
      const at = stage.current?.getBoundingClientRect();
      setView({ item, rect: new DOMRect(rect.x - (at?.left ?? 0), rect.y - (at?.top ?? 0), rect.width, rect.height) });
      setHint(false);
      if (deck) track(OA_EVENTS.imageOpen, describe(deck, item));
    },
    [deck]
  );

  const step = useCallback(
    (d: number) => {
      if (!deck || !view) return;
      const n = deck.items.length;
      const item = (view.item + d + n) % n;
      track(OA_EVENTS.imageStep, {
        direction: d > 0 ? "next" : "previous",
        ...describe(deck, item),
      });
      setView({ ...view, item });
    },
    [deck, view]
  );

  const pick = useCallback(
    (item: number) => {
      if (deck) track(OA_EVENTS.imagePick, describe(deck, item));
      setView((v) => (v ? { ...v, item } : v));
    },
    [deck]
  );

  const flyTo = useCallback((item: number) => canvas.current?.flyTo(item), []);

  if (failed) {
    return (
      <div className="canvas-stage mood">
        <p className="canvas-empty">The board data did not load. Reload the page.</p>
      </div>
    );
  }

  if (deck && !deck.items.length) {
    return (
      <div className="canvas-stage mood">
        <p className="canvas-empty">Nothing matches these filters.</p>
      </div>
    );
  }

  if (!deck || !plane) return <div className="canvas-stage mood" aria-busy="true" />;

  const openSearch = () => {
    setSearching(true);
    track(OA_EVENTS.searchOpen, { key: "hud" });
  };

  return (
    <div ref={stage} className="canvas-stage mood">
      <Canvas
        ref={canvas}
        deck={deck}
        plane={plane}
        match={match}
        onOpen={onOpen}
        onFirstInput={dismissHint}
      />

      {rail && <Tools />}

      {hint && !view && !searching && (
        <p className="canvas-hint" aria-hidden>
          Drag to move · ⌘ scroll to zoom · <kbd>/</kbd> to search · <kbd>v</kbd> to change the layout
        </p>
      )}

      <div className="canvas-hud" role="group" aria-label="Canvas controls">
        {switcher}
        <button
          type="button"
          className="btn-icon"
          aria-pressed={mode === "grid"}
          aria-label={mode === "grid" ? "Use the mosaic layout" : "Use the square layout"}
          title={mode === "grid" ? "Mosaic layout (v)" : "Square layout (v)"}
          onClick={() => pickMode(mode === "grid" ? "infinity" : "grid")}
        >
          <LayersIcon />
        </button>
        <button type="button" className="btn-icon" onClick={openSearch} aria-label="Search the images" title="Search (/)">
          <SearchIcon />
        </button>
        <button
          type="button"
          className="btn-icon"
          onClick={() => {
            canvas.current?.home();
            track(OA_EVENTS.planeHome, { key: "hud" });
          }}
          aria-label="Reset the view"
          title="Reset the view (0)"
        >
          <ResetIcon />
        </button>
      </div>

      {searching && (
        <Search deck={deck} onMatch={setMatch} onGo={flyTo} onClose={closeSearch} />
      )}

      {view && (
        <Viewer
          deck={deck}
          item={view.item}
          from={{
            left: view.rect.left,
            top: view.rect.top,
            width: view.rect.width,
            height: view.rect.height,
          }}
          onClose={() => setView(null)}
          onStep={step}
          onPick={pick}
        />
      )}
    </div>
  );
}

function describe(deck: Deck, item: number) {
  const media = deck.items[item];
  const board = deck.boards[media.board];
  return {
    id: media.id,
    author: board?.author ?? "",
    kind: KIND[media.kind],
  };
}

const KIND = ["image", "video", "poster"] as const;

function decode(raw: Raw): Deck {
  return {
    counts: raw.counts,
    items: raw.items.map(([id, w, h, board, kind]) => ({ id, w, h, board, kind })),
    boards: raw.boards.map((b) => ({
      author: b.a,
      authorName: b.n,
      topic: b.t,
      text: b.x,
      url: b.u,
      postedAt: b.d,
      likes: b.l,
      bookmarks: b.b,
      items: b.i,
      href: b.h,
      slug: b.s,
    })),
  };
}

function subset(deck: Deck, only: Set<string>): Deck {
  const items: Deck["items"] = [];
  const boards: Deck["boards"] = [];
  for (const b of deck.boards) {
    if (!b.slug || !only.has(b.slug)) continue;
    const at = boards.length;
    const mine = b.items.map((i) => {
      items.push({ ...deck.items[i], board: at });
      return items.length - 1;
    });
    boards.push({ ...b, items: mine });
  }
  return { counts: { ...deck.counts, items: items.length, boards: boards.length }, items, boards };
}
