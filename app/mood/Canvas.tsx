"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { mountTiles, type Tiles } from "./tiles";
import {
  MAX_ZOOM,
  MIN_ZOOM,
  type Camera,
  type Deck,
  type Plane,
  frameItem,
  tierFor,
  visible,
} from "./lib/plane";

const RECALC = 64;

const FRICTION = 0.94;
const STOP = 0.015;

const CLICK_SLOP = 5;

const FLY_MS = 620;

const LOAD_MAX = 2600;
const COARSE = 700;
const FADE_MAX = 400;

const REBASE = 32768;

export type CanvasHandle = {
  flyTo: (item: number) => void;
  home: () => void;
};

type Props = {
  deck: Deck;
  plane: Plane;

  match: Set<number> | null;
  onOpen: (item: number, rect: DOMRect) => void;
  onFirstInput: () => void;
};

export default forwardRef<CanvasHandle, Props>(function Canvas(
  { deck, plane, match, onOpen, onFirstInput },
  ref
) {
  const viewRef = useRef<HTMLDivElement>(null);
  const layerRef = useRef<HTMLDivElement>(null);
  const tiles = useRef<Tiles | null>(null);

  const cam = useRef<Camera>({ x: 0, y: 0, z: 0.75 });
  const size = useRef({ w: 0, h: 0 });
  const vel = useRef({ x: 0, y: 0 });
  const dirty = useRef(true);
  const origin = useRef({ x: 0, y: 0 });
  const tierRef = useRef<0 | 1 | 2>(1);
  const fly = useRef<{ from: Camera; to: Camera; t0: number } | null>(null);
  const touched = useRef(false);

  const drag = useRef({ active: false, moved: 0, lastX: 0, lastY: 0, captured: false });
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ dist: number; cx: number; cy: number } | null>(null);

  const opener = useRef(onOpen);
  const [live, setLive] = useState(true);
  const [meter, setMeter] = useState<Meter | null>(null);
  const metering = useRef(false);

  useEffect(() => {
    opener.current = onOpen;
  }, [onOpen]);

  useEffect(() => {
    const root = layerRef.current;
    if (!root) return;
    const pool = mountTiles(root, deck, (item, el) => {
      if (drag.current.moved > CLICK_SLOP) return;
      opener.current(item, el.getBoundingClientRect());
    });
    tiles.current = pool;
    return () => {
      pool.destroy();
      tiles.current = null;
    };
  }, [deck]);

  const markTouched = useCallback(() => {
    if (touched.current) return;
    touched.current = true;
    onFirstInput();
  }, [onFirstInput]);

  const clampZoom = (z: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z));

  const zoomAt = useCallback((nz: number, px: number, py: number) => {
    const c = cam.current;
    const z = clampZoom(nz);
    if (z === c.z) return;
    const wx = c.x + px / c.z;
    const wy = c.y + py / c.z;
    c.x = wx - px / z;
    c.y = wy - py / z;
    c.z = z;
    dirty.current = true;
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      flyTo(item: number) {
        const { w, h } = size.current;
        const to = frameItem(plane, cam.current, item, w, h, Math.max(cam.current.z, 0.9));
        fly.current = { from: { ...cam.current }, to, t0: performance.now() };
        vel.current.x = 0;
        vel.current.y = 0;
        dirty.current = true;
      },
      home() {
        fly.current = {
          from: { ...cam.current },
          to: { x: 0, y: 0, z: 0.75 },
          t0: performance.now(),
        };
        vel.current.x = 0;
        vel.current.y = 0;
        dirty.current = true;
      },
    }),
    [plane]
  );

  useEffect(() => {
    const pool = tiles.current;
    const layer = layerRef.current;
    if (!pool || !layer) return;

    pool.reset();

    let raf = 0;
    let clock = 0;
    let sx = cam.current.x;
    let sy = cam.current.y;
    let speed = 0;
    let force = true;
    let fill = false;
    let calcX = 0;
    let calcY = 0;
    let calcZ = cam.current.z;
    let dpr = window.devicePixelRatio || 1;
    let beat = 0;
    const frames: number[] = [];

    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);

      const c = cam.current;
      const raw = clock ? now - clock : 16;
      const dt = clock ? Math.max(1, Math.min(80, raw)) : 16;
      clock = now;

      let moved = dirty.current;
      dirty.current = false;

      if (fly.current) {
        const { from, to, t0 } = fly.current;
        const p = Math.min(1, (now - t0) / FLY_MS);
        const e = 1 - Math.pow(1 - p, 3);
        c.x = from.x + (to.x - from.x) * e;
        c.y = from.y + (to.y - from.y) * e;
        c.z = from.z + (to.z - from.z) * e;
        if (p >= 1) fly.current = null;
        moved = true;
      } else if (!drag.current.active) {
        const v = vel.current;
        if (Math.abs(v.x) > STOP || Math.abs(v.y) > STOP) {
          c.x += v.x;
          c.y += v.y;
          v.x *= FRICTION;
          v.y *= FRICTION;
          moved = true;
        }
      }

      if (metering.current) {
        if (moved && frames.length < 900) frames.push(raw);
        if (now - beat > 500) {
          beat = now;
          setMeter(read(frames, tiles.current, c.z, speed));
          frames.length = 0;
        }
      }

      if (moved) {
        const dx = (c.x - sx) * c.z;
        const dy = (c.y - sy) * c.z;
        sx = c.x;
        sy = c.y;
        speed = speed * 0.6 + ((Math.sqrt(dx * dx + dy * dy) / dt) * 1000) * 0.4;
      } else if (speed > 0) {
        speed = 0;
        sx = c.x;
        sy = c.y;
      } else if (!force && !fill) {
        return;
      }

      const { w, h } = size.current;
      if (!w || !h) return;

      const tier = tierFor(plane.unit * c.z * dpr, tierRef.current);
      const serve = speed >= LOAD_MAX ? -1 : speed > COARSE ? 0 : tier;

      const drifted =
        Math.abs(c.x - calcX) * c.z > RECALC ||
        Math.abs(c.y - calcY) * c.z > RECALC ||
        !(c.z / calcZ > 0.97 && c.z / calcZ < 1.03);

      if (force || drifted || tier !== tierRef.current || (fill && serve === tier)) {
        const o = origin.current;
        if (Math.abs(c.x - o.x) > REBASE || Math.abs(c.y - o.y) > REBASE) {
          o.x = Math.round(c.x / REBASE) * REBASE;
          o.y = Math.round(c.y / REBASE) * REBASE;
          pool.rebase(o.x, o.y);
          moved = true;
        }

        tierRef.current = tier;
        pool.setFade(speed < FADE_MAX);
        pool.sync(visible(plane, c, w, h), serve);

        fill = serve < tier;
        force = false;
        calcX = c.x;
        calcY = c.y;
        calcZ = c.z;
      }

      if (moved) {
        const o = origin.current;
        const tx = Math.round(-(c.x - o.x) * c.z * dpr) / dpr;
        const ty = Math.round(-(c.y - o.y) * c.z * dpr) / dpr;
        layer.style.transform = `translate3d(${tx}px, ${ty}px, 0) scale(${c.z})`;
      }
    };

    const onResize = () => {
      const el = viewRef.current;
      if (!el) return;
      size.current = { w: el.clientWidth, h: el.clientHeight };
      dpr = window.devicePixelRatio || 1;
      dirty.current = true;
      force = true;
    };

    onResize();
    raf = requestAnimationFrame(tick);
    window.addEventListener("resize", onResize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
    };
  }, [plane]);

  useEffect(() => {
    tiles.current?.setMatch(match);
  }, [match]);

  useEffect(() => {
    tiles.current?.setPlays(live);
  }, [live]);

  useEffect(() => {
    const el = viewRef.current;
    if (!el) return;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      markTouched();
      fly.current = null;

      if (e.ctrlKey || e.metaKey) {
        zoomAt(cam.current.z * Math.exp(-e.deltaY * 0.01), e.clientX, e.clientY);
        return;
      }
      const c = cam.current;
      c.x += e.deltaX / c.z;
      c.y += e.deltaY / c.z;
      vel.current.x = 0;
      vel.current.y = 0;
      dirty.current = true;
    };

    const pair = () => {
      let a: { x: number; y: number } | null = null;
      let b: { x: number; y: number } | null = null;
      for (const p of pointers.current.values()) {
        if (!a) a = p;
        else {
          b = p;
          break;
        }
      }
      return a && b ? [a, b] : null;
    };

    const onDown = (e: PointerEvent) => {
      markTouched();
      fly.current = null;
      pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

      const two = pointers.current.size === 2 ? pair() : null;
      if (two) {
        const [a, b] = two;
        pinch.current = {
          dist: Math.hypot(a.x - b.x, a.y - b.y),
          cx: (a.x + b.x) / 2,
          cy: (a.y + b.y) / 2,
        };
        drag.current.active = false;
        return;
      }

      drag.current = {
        active: true,
        moved: 0,
        lastX: e.clientX,
        lastY: e.clientY,
        captured: false,
      };
      vel.current.x = 0;
      vel.current.y = 0;
    };

    const onMove = (e: PointerEvent) => {
      const p = pointers.current.get(e.pointerId);
      if (!p) return;
      p.x = e.clientX;
      p.y = e.clientY;

      if (pinch.current && pointers.current.size >= 2) {
        const two = pair();
        if (!two) return;
        const [a, b] = two;
        const dist = Math.hypot(a.x - b.x, a.y - b.y);
        const cx = (a.x + b.x) / 2;
        const cy = (a.y + b.y) / 2;
        const c = cam.current;

        c.x -= (cx - pinch.current.cx) / c.z;
        c.y -= (cy - pinch.current.cy) / c.z;
        dirty.current = true;

        if (pinch.current.dist > 0) zoomAt((c.z * dist) / pinch.current.dist, cx, cy);
        pinch.current = { dist, cx, cy };
        return;
      }

      const d = drag.current;
      if (!d.active) return;
      const dx = e.clientX - d.lastX;
      const dy = e.clientY - d.lastY;
      d.lastX = e.clientX;
      d.lastY = e.clientY;
      d.moved += Math.abs(dx) + Math.abs(dy);

      if (!d.captured && d.moved > CLICK_SLOP) {
        d.captured = true;
        el.setPointerCapture(e.pointerId);
        setLive(false);
      }

      const c = cam.current;
      c.x -= dx / c.z;
      c.y -= dy / c.z;

      vel.current.x = -dx / c.z;
      vel.current.y = -dy / c.z;
      dirty.current = true;
    };

    const onUp = (e: PointerEvent) => {
      pointers.current.delete(e.pointerId);
      if (pointers.current.size < 2) pinch.current = null;

      if (drag.current.captured) {
        if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
        drag.current.captured = false;
      }
      if (pointers.current.size === 0) {
        drag.current.active = false;
        setLive(true);
      }
    };

    el.addEventListener("wheel", onWheel, { passive: false });
    el.addEventListener("pointerdown", onDown, { passive: true });
    el.addEventListener("pointermove", onMove, { passive: true });
    el.addEventListener("pointerup", onUp, { passive: true });
    el.addEventListener("pointercancel", onUp, { passive: true });
    return () => {
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("pointerdown", onDown);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerup", onUp);
      el.removeEventListener("pointercancel", onUp);
    };
  }, [zoomAt, markTouched]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      const c = cam.current;
      const step = 220 / c.z;
      const { w, h } = size.current;
      let hit = true;
      switch (e.key) {
        case "ArrowLeft": c.x -= step; break;
        case "ArrowRight": c.x += step; break;
        case "ArrowUp": c.y -= step; break;
        case "ArrowDown": c.y += step; break;
        case "PageUp": c.y -= h / c.z; break;
        case "PageDown": c.y += h / c.z; break;
        case "=":
        case "+": zoomAt(c.z * 1.25, w / 2, h / 2); break;
        case "-":
        case "_": zoomAt(c.z / 1.25, w / 2, h / 2); break;
        case "f":
        case "F":
          metering.current = !metering.current;
          if (!metering.current) setMeter(null);
          break;
        default: hit = false;
      }
      if (!hit) return;
      e.preventDefault();
      markTouched();
      fly.current = null;
      dirty.current = true;
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [zoomAt, markTouched]);

  return (
    <div
      ref={viewRef}
      className="fixed inset-0"
      style={{
        touchAction: "none",

        cursor: live ? "grab" : "grabbing",
        userSelect: "none",
        WebkitUserSelect: "none",

        overflow: "hidden",
        contain: "strict",
      }}
    >
      <div ref={layerRef} className="plane" />
      {meter && <Meterbox m={meter} />}
    </div>
  );
});

type Meter = {
  p50: number;
  p95: number;
  worst: number;
  tiles: number;
  imgs: number;
  mb: number;
  zoom: number;
  speed: number;
};

function read(frames: number[], pool: Tiles | null, z: number, speed: number): Meter {
  const a = frames.slice().sort((x, y) => x - y);
  const at = (q: number) => (a.length ? a[Math.min(a.length - 1, Math.floor(a.length * q))] : 0);
  const s = pool?.stats() ?? { tiles: 0, imgs: 0, mb: 0 };
  return {
    p50: at(0.5),
    p95: at(0.95),
    worst: a.length ? a[a.length - 1] : 0,
    tiles: s.tiles,
    imgs: s.imgs,
    mb: s.mb,
    zoom: z,
    speed,
  };
}

function Meterbox({ m }: { m: Meter }) {
  const head = m.p50 > 0 ? `${Math.round(1000 / m.p50)} fps  p50 ${m.p50.toFixed(1)}ms` : "idle";
  return (
    <div
      className="mono tnum"
      style={{
        position: "fixed",
        right: 12,
        bottom: 12,
        zIndex: 60,
        padding: "8px 10px",
        borderRadius: 8,
        background: "rgb(0 0 0 / 0.62)",
        color: "rgb(255 255 255 / 0.86)",
        fontSize: 10.5,
        lineHeight: 1.55,
        whiteSpace: "pre",
        pointerEvents: "none",
      }}
    >
      {`${head}\np95 ${m.p95.toFixed(1)}  worst ${m.worst.toFixed(1)}\n${m.tiles} tiles  ${m.imgs} imgs  ${m.mb.toFixed(0)} MB\nzoom ${m.zoom.toFixed(2)}  ${Math.round(m.speed)} px/s`}
    </div>
  );
}
