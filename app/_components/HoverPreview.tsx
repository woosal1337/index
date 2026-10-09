"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { labelize } from "../lib/text";

const W = 300;
const GAP = 18;
const EDGE = 12;
const DELAY = 120;
const FALLBACK_HEIGHT = 280;

type Data = {
  name: string;
  tagline: string;
  img: string | null;
  tags: string[];
  more: number;
  facts: string[];
};

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

function positionFor(pointer: { x: number; y: number }, height: number): { x: number; y: number } {
  let x = pointer.x + GAP;
  if (x + W + EDGE > window.innerWidth) x = pointer.x - GAP - W;
  if (x < EDGE) x = EDGE;
  let y = pointer.y + GAP;
  if (y + height + EDGE > window.innerHeight) y = pointer.y - GAP - height;
  if (y < EDGE) y = EDGE;
  return { x, y };
}

export default function HoverPreview() {
  const [data, setData] = useState<Data | null>(null);
  const [ready, setReady] = useState(false);
  const cardRef = useRef<HTMLDivElement | null>(null);
  const rowRef = useRef<HTMLElement | null>(null);
  const timer = useRef<number | null>(null);
  const raf = useRef(0);
  const blocked = useRef<string | null>(null);
  const seen = useRef<Set<string>>(new Set());
  const pointer = useRef({ x: 0, y: 0 });

  const apply = useCallback(() => {
    const el = cardRef.current;
    if (!el) return;
    const { x, y } = positionFor(pointer.current, el.offsetHeight || FALLBACK_HEIGHT);
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
  }, []);

  const close = useCallback(() => {
    if (timer.current) window.clearTimeout(timer.current);
    if (raf.current) cancelAnimationFrame(raf.current);
    timer.current = null;
    raf.current = 0;
    rowRef.current = null;
    setReady(false);
    setData(null);
  }, []);

  useEffect(() => {
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;

    const rowOf = (t: EventTarget | null) =>
      t instanceof Element ? (t.closest("a.row[data-preview]") as HTMLElement | null) : null;
    const keyOf = (row: HTMLElement | null) => row?.getAttribute("href") ?? null;

    const open = (row: HTMLElement, wait: number) => {
      const next = parse(row);
      if (!next) return;
      rowRef.current = row;
      if (next.img && !seen.current.has(next.img)) {
        seen.current.add(next.img);
        const pre = new Image();
        pre.src = next.img;
      }
      if (timer.current) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => {
        setReady(false);
        setData(next);
      }, wait);
    };

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
      pointer.current = { x: e.clientX, y: e.clientY };
      if (blocked.current && keyOf(rowOf(e.target)) !== blocked.current) blocked.current = null;
      if (!rowRef.current || raf.current) return;
      raf.current = requestAnimationFrame(() => {
        raf.current = 0;
        apply();
      });
    };
    const onFocusIn = (e: FocusEvent) => {
      const row = rowOf(e.target);
      if (row) {
        const r = row.getBoundingClientRect();
        pointer.current = { x: Math.min(r.left + 80, r.right - 40), y: r.top + r.height / 2 };
        open(row, 0);
      } else if (rowRef.current) close();
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
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [apply, close]);

  useLayoutEffect(() => {
    if (!data || ready) return;
    apply();
    setReady(true);
  }, [data, ready, apply]);

  if (!data) return null;

  return (
    <div
      ref={cardRef}
      className="preview overlay-surface"
      data-ready={ready ? "1" : undefined}
      style={{ width: W, left: 0, top: 0 }}
      role="presentation"
      aria-hidden
    >
      {data.img && <img src={data.img} alt="" decoding="async" className="preview-shot" />}
      <div className="preview-body">
        <p className="preview-name">{data.name}</p>
        {data.tagline && <p className="preview-tagline">{data.tagline}</p>}
        {data.tags.length > 0 && (
          <p className="preview-tags">
            {data.tags.map(labelize).join(" · ")}
            {data.more > 0 && (
              <>
                {" +"}
                <span className="tnum">{data.more.toLocaleString()}</span> more
              </>
            )}
          </p>
        )}
        {data.facts.length > 0 && <p className="preview-facts">{data.facts.map(labelize).join(" · ")}</p>}
      </div>
    </div>
  );
}
