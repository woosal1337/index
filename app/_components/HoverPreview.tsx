"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { labelize } from "../lib/text";

const W = 288;

const GAP = 14;
const EDGE = 10;

const DELAY = 130;

type Data = {
  name: string;
  tagline: string;
  img: string | null;
  tags: string[];
  more: number;
  facts: string[];
};

type Placed = Data & { x: number; y: number };

function readRow(row: HTMLElement): { name: string; tagline: string } {
  const main = row.querySelector(".main");
  const desc = main?.querySelector(".desc");
  const name = main ? (main.firstChild?.textContent ?? "").trim() : "";
  const tagline = (desc?.textContent ?? "").replace(/^\s*·\s*/, "").trim();
  return { name, tagline };
}

function parse(row: HTMLElement): Data | null {
  const packed = row.dataset.preview;
  if (!packed) return null;
  const [img, tags, more, facts] = packed.split("|");
  const { name, tagline } = readRow(row);
  return {
    name,
    tagline,
    img: img || null,
    tags: tags ? tags.split(",").filter(Boolean) : [],
    more: Number(more) || 0,
    facts: facts ? facts.split(",").filter(Boolean) : [],
  };
}

export default function HoverPreview() {
  const [placed, setPlaced] = useState<Placed | null>(null);

  const [ready, setReady] = useState(false);
  const cardRef = useRef<HTMLDivElement | null>(null);
  const rowRef = useRef<HTMLElement | null>(null);
  const timer = useRef<number | null>(null);
  const blocked = useRef<string | null>(null);
  const seen = useRef<Set<string>>(new Set());

  const close = useCallback(() => {
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = null;
    rowRef.current = null;
    setReady(false);
    setPlaced(null);
  }, []);

  const place = useCallback((row: HTMLElement, data: Data) => {
    const r = row.getBoundingClientRect();
    const right = r.right + GAP;
    const x = right + W + EDGE <= window.innerWidth ? right : Math.max(EDGE, r.left - GAP - W);
    setReady(false);
    setPlaced({ ...data, x, y: Math.round(r.top) });
  }, []);

  useEffect(() => {

    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;

    const open = (row: HTMLElement, wait: number) => {
      const data = parse(row);
      if (!data) return;
      rowRef.current = row;

      if (data.img && !seen.current.has(data.img)) {
        seen.current.add(data.img);
        const pre = new Image();
        pre.src = data.img;
      }
      if (timer.current) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => place(row, data), wait);
    };

    const rowOf = (t: EventTarget | null) =>
      t instanceof Element ? (t.closest("a.row[data-preview]") as HTMLElement | null) : null;

    const keyOf = (row: HTMLElement | null) => row?.getAttribute("href") ?? null;

    const onOver = (e: PointerEvent) => {
      const row = rowOf(e.target);
      if (!row) {
        if (rowRef.current) close();
        return;
      }
      if (keyOf(row) && keyOf(row) === blocked.current) return;
      if (row === rowRef.current) return;
      open(row, DELAY);
    };
    const onOut = (e: PointerEvent) => {
      const row = rowOf(e.target);
      if (row && row === rowOf(e.relatedTarget)) return;
      if (row && keyOf(row) === blocked.current) blocked.current = null;
      if (row) close();
    };
    const onDown = (e: PointerEvent) => {
      blocked.current = keyOf(rowOf(e.target));
      close();
    };
    const onMove = (e: PointerEvent) => {
      if (!blocked.current) return;
      if (keyOf(rowOf(e.target)) !== blocked.current) blocked.current = null;
    };

    const onFocusIn = (e: FocusEvent) => {
      const row = rowOf(e.target);
      if (row) open(row, 0);
      else if (rowRef.current) close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };

    document.addEventListener("pointerover", onOver);
    document.addEventListener("pointerout", onOut);
    document.addEventListener("pointerdown", onDown, true);
    document.addEventListener("pointermove", onMove, { passive: true });
    document.addEventListener("focusin", onFocusIn);
    document.addEventListener("keydown", onKey);

    document.addEventListener("scroll", close, { capture: true, passive: true });
    window.addEventListener("resize", close);
    window.addEventListener("blur", close);
    return () => {
      document.removeEventListener("pointerover", onOver);
      document.removeEventListener("pointerout", onOut);
      document.removeEventListener("pointerdown", onDown, true);
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
      window.removeEventListener("blur", close);
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, [close, place]);

  useEffect(() => {
    const el = cardRef.current;
    if (!el || !placed || ready) return;
    const max = window.innerHeight - el.offsetHeight - EDGE;
    const y = Math.max(EDGE, Math.min(placed.y, max));
    if (y !== placed.y) setPlaced((p) => (p ? { ...p, y } : p));
    else setReady(true);
  }, [placed, ready]);

  if (!placed) return null;

  return (
    <div
      ref={cardRef}
      className="preview overlay-surface"
      data-ready={ready ? "1" : undefined}
      style={{ left: placed.x, top: placed.y, width: W }}
      role="presentation"
      aria-hidden
    >
      {placed.img && (

        <img src={placed.img} alt="" decoding="async" className="preview-shot" />
      )}
      <div className="preview-body">
        <p className="preview-name">{placed.name}</p>
        {placed.tagline && <p className="preview-tagline">{placed.tagline}</p>}
        {placed.tags.length > 0 && (
          <p className="preview-tags">
            {placed.tags.map(labelize).join(" · ")}
            {placed.more > 0 && (
              <>
                {" +"}
                <span className="tnum">{placed.more.toLocaleString()}</span> more
              </>
            )}
          </p>
        )}
        {placed.facts.length > 0 && <p className="preview-facts">{placed.facts.map(labelize).join(" · ")}</p>}
      </div>
    </div>
  );
}
