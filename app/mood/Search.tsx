"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { OA_EVENTS, track } from "./lib/analytics";
import { type Deck, thumbOf } from "./lib/plane";

type Props = {
  deck: Deck;
  onMatch: (m: Set<number> | null) => void;
  onGo: (item: number) => void;
  onClose: () => void;
};

export default function Search({ deck, onMatch, onGo, onClose }: Props) {
  const [q, setQ] = useState("");
  const [cursor, setCursor] = useState(0);
  const input = useRef<HTMLInputElement>(null);

  const haystack = useMemo(
    () =>
      deck.boards.map((b) =>
        `${b.author} ${b.authorName} ${b.topic} ${b.text}`.toLowerCase()
      ),
    [deck]
  );

  const hits = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return null;
    const out: number[] = [];
    for (let b = 0; b < haystack.length; b++) {
      if (haystack[b].includes(needle)) out.push(...deck.boards[b].items);
    }
    return out;
  }, [q, haystack, deck]);

  useEffect(() => {
    onMatch(hits ? new Set(hits) : null);
  }, [hits, onMatch]);

  /*
   * One event per settled query, not one per keystroke.
   *
   * The 600 ms wait is what makes the report readable: without it "refik"
   * arrives as five separate searches, four of them prefixes nobody meant to
   * type, and the miss rate reads far worse than it is.
   */
  useEffect(() => {
    const needle = q.trim();
    if (needle === "") return;
    const t = setTimeout(
      () => track(OA_EVENTS.searchRun, { query: needle.toLowerCase(), hits: hits?.length ?? 0 }),
      600
    );
    return () => clearTimeout(t);
  }, [q, hits]);

  useEffect(() => {
    input.current?.focus();
  }, []);

  useEffect(() => setCursor(0), [q]);

  const go = (i: number) => {
    track(OA_EVENTS.searchGo, { query: q.trim().toLowerCase(), id: deck.items[i].id });
    onGo(i);
    setCursor(hits ? hits.indexOf(i) : 0);
  };

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 40,
        display: "flex",
        justifyContent: "center",
        padding: "14vh 16px 0",
        pointerEvents: "none",
      }}
    >
      <div
        className="glass-surface"
        style={{ width: "min(560px, 100%)", overflow: "hidden", pointerEvents: "auto", borderRadius: 16 }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px" }}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="var(--fg-4)" strokeWidth="1.5">
            <circle cx="6" cy="6" r="4.25" />
            <path d="M9.2 9.2 L12.5 12.5" strokeLinecap="round" />
          </svg>
          <input
            ref={input}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") { e.preventDefault(); onClose(); }
              if (!hits?.length) return;
              if (e.key === "Enter") { e.preventDefault(); go(hits[cursor % hits.length]); }
              if (e.key === "ArrowDown") {
                e.preventDefault();
                const n = (cursor + 1) % hits.length;
                setCursor(n);
                onGo(hits[n]);
              }
              if (e.key === "ArrowUp") {
                e.preventDefault();
                const n = (cursor - 1 + hits.length) % hits.length;
                setCursor(n);
                onGo(hits[n]);
              }
            }}
            placeholder="Designer, topic, anything in the post…"
            aria-label="Search the plane"
            style={{
              flex: 1,
              minWidth: 0,
              border: "none",
              outline: "none",
              background: "transparent",
              color: "var(--fg)",
              fontSize: 14,
              fontFamily: "inherit",
            }}
          />
          {hits && (
            <span className="mono tnum" style={{ fontSize: 11, color: "var(--fg-4)", flexShrink: 0 }}>
              {hits.length}
            </span>
          )}
        </div>

        {hits && hits.length > 0 && (
          <div
            style={{
              display: "flex",
              gap: 5,
              padding: "0 14px 12px",
              overflowX: "auto",
              scrollbarWidth: "none",
            }}
          >
            {hits.slice(0, 28).map((i, k) => (
              <button
                key={i}
                onClick={() => go(i)}
                aria-label={`Go to result ${k + 1}`}
                style={{
                  flexShrink: 0,
                  width: 52,
                  height: 38,
                  padding: 0,
                  border: "none",
                  borderRadius: 3,
                  cursor: "pointer",
                  background: `center/cover url(${thumbOf(deck.items[i].id)})`,
                  opacity: k === cursor ? 1 : 0.45,
                  outline: k === cursor ? "1px solid var(--fg-3)" : "none",
                  outlineOffset: 1,
                  transition: "opacity var(--dur-move) var(--ease-standard)",
                }}
              />
            ))}
          </div>
        )}

        {hits && hits.length === 0 && (
          <p style={{ margin: 0, padding: "0 14px 13px", fontSize: 12, color: "var(--fg-4)" }}>
            Nothing here matches that.
          </p>
        )}
      </div>
    </div>
  );
}
