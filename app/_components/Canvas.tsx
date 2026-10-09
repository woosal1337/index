"use client";

import { useCallback, useEffect, useLayoutEffect, useReducer, useRef, useState } from "react";
import { m } from "motion/react";
import ResourceCard, { type CardItem } from "./ResourceCard";
import { MinusIcon, PlusIcon, ResetIcon } from "./icons";

const CELL_W = 396;
const CELL_H = 364;
const MIN = 0.3;
const MAX = 2.2;
const START = 0.8;
const MARGIN = 320;
const DRAG_THRESHOLD = 4;

type Transform = { x: number; y: number; s: number };
type Point = { x: number; y: number };

function mod(n: number, m: number): number {
  return ((n % m) + m) % m;
}

export default function Canvas({ items, categoryNames = {} }: { items: CardItem[]; categoryNames?: Record<string, string> }) {
  const stageRef = useRef<HTMLDivElement>(null);
  const planeRef = useRef<HTMLDivElement>(null);
  const t = useRef<Transform>({ x: 0, y: 0, s: START });
  const frame = useRef(0);
  const pointers = useRef(new Map<number, Point>());
  const pinch = useRef<{ d: number; cx: number; cy: number } | null>(null);
  const origin = useRef<Point | null>(null);
  const moved = useRef(false);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [panning, setPanning] = useState(false);
  const [, bump] = useReducer((n: number) => n + 1, 0);

  const cols = Math.max(1, Math.ceil(Math.sqrt((Math.max(items.length, 1) * CELL_H) / CELL_W)));
  const rowCount = Math.max(1, Math.ceil(items.length / cols));

  const paint = useCallback(() => {
    const el = planeRef.current;
    const { x, y, s } = t.current;
    if (el) el.style.transform = `translate(${x}px, ${y}px) scale(${s})`;
    if (!frame.current) {
      frame.current = requestAnimationFrame(() => {
        frame.current = 0;
        bump();
      });
    }
  }, []);

  const center = useCallback(
    (w: number, h: number) => {
      t.current = { x: w / 2, y: h / 2, s: START };
      paint();
    },
    [paint]
  );

  useLayoutEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setSize({ w: rect.width, h: rect.height });
    center(rect.width, rect.height);
    const ro = new ResizeObserver(() => {
      const r = el.getBoundingClientRect();
      setSize({ w: r.width, h: r.height });
    });
    ro.observe(el);
    return () => {
      ro.disconnect();
      if (frame.current) cancelAnimationFrame(frame.current);
      frame.current = 0;
    };
  }, [center]);

  const zoomAt = useCallback(
    (px: number, py: number, factor: number) => {
      const { x, y, s } = t.current;
      const s2 = Math.min(MAX, Math.max(MIN, s * factor));
      const k = s2 / s;
      t.current = { x: px - (px - x) * k, y: py - (py - y) * k, s: s2 };
      paint();
    },
    [paint]
  );

  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      if (e.ctrlKey || e.metaKey) {
        zoomAt(e.clientX - rect.left, e.clientY - rect.top, Math.exp(-e.deltaY * 0.0022));
      } else {
        t.current.x -= e.deltaX;
        t.current.y -= e.deltaY;
        paint();
      }
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [zoomAt, paint]);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 1) {
      origin.current = { x: e.clientX, y: e.clientY };
      moved.current = false;
    }
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      pinch.current = { d: Math.hypot(a.x - b.x, a.y - b.y), cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2 };
      for (const id of pointers.current.keys()) stageRef.current?.setPointerCapture(id);
    }
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const prev = pointers.current.get(e.pointerId);
    if (!prev) return;
    const cur = { x: e.clientX, y: e.clientY };
    pointers.current.set(e.pointerId, cur);
    const stage = stageRef.current;
    if (!stage) return;
    const rect = stage.getBoundingClientRect();

    if (pointers.current.size === 2 && pinch.current) {
      const [a, b] = [...pointers.current.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      const cx = (a.x + b.x) / 2;
      const cy = (a.y + b.y) / 2;
      zoomAt(cx - rect.left, cy - rect.top, d / pinch.current.d);
      t.current.x += cx - pinch.current.cx;
      t.current.y += cy - pinch.current.cy;
      pinch.current = { d, cx, cy };
      moved.current = true;
      if (!panning) setPanning(true);
      paint();
      return;
    }

    if (origin.current && !moved.current) {
      if (Math.hypot(cur.x - origin.current.x, cur.y - origin.current.y) > DRAG_THRESHOLD) {
        moved.current = true;
        setPanning(true);
        stage.setPointerCapture(e.pointerId);
      }
    }
    if (!moved.current) return;
    t.current.x += cur.x - prev.x;
    t.current.y += cur.y - prev.y;
    paint();
  };

  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
    if (pointers.current.size === 0) {
      origin.current = null;
      setPanning(false);
    }
  };

  const onClickCapture = (e: React.MouseEvent<HTMLDivElement>) => {
    if (moved.current) {
      e.preventDefault();
      e.stopPropagation();
      moved.current = false;
    }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const step = 80;
    if (e.key === "ArrowLeft") t.current.x += step;
    else if (e.key === "ArrowRight") t.current.x -= step;
    else if (e.key === "ArrowUp") t.current.y += step;
    else if (e.key === "ArrowDown") t.current.y -= step;
    else if (e.key === "+" || e.key === "=") return zoomAt(size.w / 2, size.h / 2, 1.2);
    else if (e.key === "-") return zoomAt(size.w / 2, size.h / 2, 0.8);
    else if (e.key === "0") return center(size.w, size.h);
    else return;
    e.preventDefault();
    paint();
  };

  const { x, y, s } = t.current;
  const visible: { key: string; i: number; left: number; top: number }[] = [];
  if (size.w > 0 && items.length > 0) {
    const left = -x / s - MARGIN;
    const top = -y / s - MARGIN;
    const right = (size.w - x) / s + MARGIN;
    const bottom = (size.h - y) / s + MARGIN;
    const r0 = Math.floor(top / CELL_H + rowCount / 2);
    const r1 = Math.ceil(bottom / CELL_H + rowCount / 2);
    for (let r = r0; r <= r1; r++) {
      const off = mod(r, 2) ? CELL_W / 2 : 0;
      const c0 = Math.floor((left - off) / CELL_W + cols / 2);
      const c1 = Math.ceil((right - off) / CELL_W + cols / 2);
      for (let c = c0; c <= c1; c++) {
        const i = mod(mod(r, rowCount) * cols + mod(c, cols), items.length);
        visible.push({ key: `${r}:${c}`, i, left: (c - cols / 2) * CELL_W + off, top: (r - rowCount / 2) * CELL_H });
      }
    }
  }

  return (
    <div
      ref={stageRef}
      className={`canvas-stage${panning ? " is-panning" : ""}`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onClickCapture={onClickCapture}
      onKeyDown={onKeyDown}
      tabIndex={0}
      role="region"
      aria-label="Canvas of resources. Drag to pan, scroll to move, and hold Command while you scroll to zoom. The board repeats in every direction."
    >
      <div ref={planeRef} className="canvas-plane">
        {visible.map(({ key, i, left, top }) => {
          const r = items[i];
          return (
            <div key={key} className="canvas-item" style={{ left, top }}>
              <m.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.25, ease: [0.2, 0.8, 0.2, 1] }}
              >
                <ResourceCard item={r} categoryName={categoryNames[r.category]} />
              </m.div>
            </div>
          );
        })}
      </div>

      {items.length === 0 && <p className="canvas-empty">Nothing matches these filters.</p>}

      <p className="canvas-hint" aria-hidden>
        Drag to pan · Scroll to move · ⌘ + scroll to zoom · The board repeats
      </p>

      <div className="canvas-hud" role="group" aria-label="Canvas controls">
        <button type="button" className="btn-icon" onClick={() => zoomAt(size.w / 2, size.h / 2, 0.8)} aria-label="Zoom out">
          <MinusIcon />
        </button>
        <span className="canvas-zoom" aria-live="polite">
          {Math.round(s * 100)}%
        </span>
        <button type="button" className="btn-icon" onClick={() => zoomAt(size.w / 2, size.h / 2, 1.25)} aria-label="Zoom in">
          <PlusIcon />
        </button>
        <button type="button" className="btn-icon" onClick={() => center(size.w, size.h)} aria-label="Reset the view">
          <ResetIcon />
        </button>
      </div>
    </div>
  );
}
