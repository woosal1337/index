"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Canvas, { type CanvasHandle } from "./Canvas";
import Nav from "./Nav";
import Search from "./Search";
import Tools from "./Tools";
import Viewer from "./Viewer";
import { OA_EVENTS, track } from "./lib/analytics";
import { MODES, buildPlane, type Deck, type Mode } from "./lib/plane";

const SHAPE: Record<Mode, { unit: number; gap: number }> = {
  infinity: { unit: 260, gap: 6 },
  grid: { unit: 220, gap: 10 },
};

const MODE_KEY = "mood.view";

type Raw = {
  counts: Deck["counts"];
  boards: { a: string; n: string; t: string; x: string; u: string; d: string; l: number; b: number; i: number[] }[];
  items: [string, number, number, number, 0 | 1 | 2][];
};

export default function Mood() {
  const [deck, setDeck] = useState<Deck | null>(null);
  const [failed, setFailed] = useState(false);
  const [view, setView] = useState<{ item: number; rect: DOMRect } | null>(null);
  const [searching, setSearching] = useState(false);
  const [match, setMatch] = useState<Set<number> | null>(null);
  const [hint, setHint] = useState(true);
  const [mode, setMode] = useState<Mode>("infinity");
  const [railOpen, setRailOpen] = useState(false);

  const canvas = useRef<CanvasHandle>(null);

  useEffect(() => {
    let alive = true;
    fetch("data/mood.json")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((raw: Raw) => alive && setDeck(decode(raw)))
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(MODE_KEY);
      if (saved && (MODES as string[]).includes(saved)) setMode(saved as Mode);
    } catch {
    }
  }, []);

  const plane = useMemo(
    () => (deck ? buildPlane(deck.items, SHAPE[mode].unit, SHAPE[mode].gap, mode) : null),
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

      if (e.key === "/" || ((e.metaKey || e.ctrlKey) && e.key === "k")) {
        e.preventDefault();
        setSearching(true);
        track(OA_EVENTS.searchOpen, { key: e.key === "/" ? "slash" : "mod-k" });
      } else if (e.key === "Escape" && searching) {
        e.preventDefault();
        closeSearch();
      } else if (e.key === "t" || e.key === "T") {
        toggleTheme();
      } else if (e.key === "v" || e.key === "V") {
        cycle();
      } else if (e.key === "0" || e.key === "h") {
        canvas.current?.home();
        track(OA_EVENTS.planeHome, { key: e.key });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [view, searching, closeSearch, cycle]);

  const onOpen = useCallback(
    (item: number, rect: DOMRect) => {
      setView({ item, rect });
      setHint(false);
      if (deck) track(OA_EVENTS.imageOpen, describe(deck, item));
    },
    [deck]
  );

  // Reads `view` rather than taking the updater form: the event has to be sent
  // outside the updater, because React may call an updater twice and would
  // count the step twice with it.
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
      <main style={centred}>
        <p style={{ fontSize: 13, color: "var(--fg-3)" }}>
          The board data did not load. Run <code className="mono">npm run data</code> and reload.
        </p>
      </main>
    );
  }

  if (!deck || !plane) return <main style={centred} aria-busy="true" />;

  return (
    <main>
      <Canvas
        ref={canvas}
        deck={deck}
        plane={plane}
        match={match}
        onOpen={onOpen}
        onFirstInput={dismissHint}
      />

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

      <Nav
        counts={deck.counts}
        mode={mode}
        onMode={pickMode}
        onSearch={() => {
          setSearching(true);
          track(OA_EVENTS.searchOpen, { key: "nav" });
        }}
        rest={hint && !view && !searching}
        railOpen={railOpen}
      />

      <Tools onOpen={setRailOpen} />

      <Hint show={hint && !view && !searching} counts={deck.counts} mode={mode} />
    </main>
  );
}

function Hint({ show, counts, mode }: { show: boolean; counts: Deck["counts"]; mode: Mode }) {
  return (
    <div
      aria-hidden={!show}
      className="mono"
      style={{
        position: "fixed",
        left: 0,
        right: 0,
        bottom: 22,
        display: "flex",
        justifyContent: "center",
        pointerEvents: "none",
        opacity: show ? 1 : 0,
        transition: "opacity 700ms var(--ease-standard)",
      }}
    >
      <p
        style={{
          margin: 0,
          padding: "7px 14px",
          borderRadius: 999,
          fontSize: 10.5,
          letterSpacing: "0.02em",
          color: "rgb(255 255 255 / 0.3)",
          background: "rgb(0 0 0 / 0.5)",
          backdropFilter: "blur(10px)",
          WebkitBackdropFilter: "blur(10px)",
        }}
      >
        <span style={{ color: "rgb(255 255 255 / 0.9)" }}>
          <span className="tnum">{counts.items.toLocaleString()}</span> images ·{" "}
          <span className="tnum">{counts.videos}</span> videos.
        </span>{" "}
        Drag to move · pinch or ⌘scroll to zoom · <kbd>/</kbd> to search ·{" "}
        <kbd>v</kbd> for {mode === "grid" ? "infinity" : "grid"}
      </p>
    </div>
  );
}

function toggleTheme() {
  const root = document.documentElement;
  const now = root.dataset.theme;
  const dark = now !== "light";
  const next = dark ? "light" : "dark";
  root.dataset.theme = next;
  track(OA_EVENTS.themeToggle, { theme: next });
  try {
    localStorage.setItem("mood.theme", next);
  } catch {
  }
}

/**
 * The properties every image event carries.
 *
 * The id, the author and the kind — never the board text. The text is a whole
 * post and would blow past the tracker's 256-character property cap, and the
 * question these events answer is "which images and whose work get opened".
 */
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
    })),
  };
}

const centred: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  display: "grid",
  placeItems: "center",
  padding: 24,
  textAlign: "center",
};
