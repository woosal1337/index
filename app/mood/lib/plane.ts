export type Item = {
  id: string;
  w: number;
  h: number;
  board: number;

  kind: 0 | 1 | 2;
};

export type Board = {
  author: string;
  authorName: string;
  topic: string;
  text: string;
  url: string;
  postedAt: string;
  likes: number;
  bookmarks: number;
  items: number[];
};

export type Deck = {
  items: Item[];
  boards: Board[];
  counts: { items: number; boards: number; authors: number; videos: number };
};

export type Mode = "infinity" | "grid";

export const MODES: Mode[] = ["infinity", "grid"];

type Placed = {
  item: number;

  x: number;
  w: number;
};

type Row = {
  placed: Placed[];

  rights: number[];

  width: number;

  y: number;
  h: number;

  phase: number;
};

export type Plane = {
  mode: Mode;
  rows: Row[];

  bottoms: number[];

  gap: number;

  width: number;

  height: number;

  unit: number;

  place: { row: number; x: number; w: number }[];
};

export type Camera = {
  x: number;
  y: number;

  z: number;
};

export type Tile = {
  key: string;
  item: number;
  x: number;
  y: number;
  w: number;
  h: number;
};

export const MIN_ZOOM = 0.34;
export const MAX_ZOOM = 4;

export const OVERSCAN = 300;

/** Tiles have a constant size in world units, so the overscan must be capped in
 *  world units too. Left as pure screen pixels it divides by the zoom, and at
 *  the minimum zoom that margin grows to 880 world units around a 5,714-wide
 *  viewport — most of the mounted set off screen. */
const MAX_PAD = 560;

const MAX_TILES = 760;

const RATIO = 16 / 9;

export function buildPlane(items: Item[], unit: number, gap: number, mode: Mode = "infinity"): Plane {
  const rnd = mulberry32(0x9e3779b9);

  const order = items.map((_, i) => i);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }

  const rows = mode === "grid" ? gridRows(items, order, unit, gap) : justifiedRows(items, order, unit, gap);

  const width = rows.length ? rows[0].width : unit;

  let height = 0;
  const bottoms: number[] = [];
  for (const row of rows) {
    row.y = height;
    height += row.h + gap;
    bottoms.push(row.y + row.h);
    row.phase = mode === "grid" ? 0 : rnd() * width;
  }

  const place: Plane["place"] = new Array(items.length);
  for (let r = 0; r < rows.length; r++) {
    for (const p of rows[r].placed) place[p.item] = { row: r, x: p.x, w: p.w };
  }

  return { mode, rows, bottoms, gap, width, height: Math.max(1, height), unit, place };
}

function justifiedRows(items: Item[], order: number[], unit: number, gap: number): Row[] {
  const aspect = items.map((it) => Math.max(0.15, Math.min(6, it.w / it.h)));

  let run = 0;
  for (const i of order) run += unit * aspect[i] + gap;

  const width = Math.max(unit * 3, Math.round(Math.sqrt(RATIO * run * (unit + gap))));

  const rows: Row[] = [];
  let cur: number[] = [];
  let sum = 0;

  for (const i of order) {
    cur.push(i);
    sum += aspect[i];
    if ((width - gap * (cur.length - 1)) / sum <= unit) {
      rows.push(justify(cur, aspect, width, gap));
      cur = [];
      sum = 0;
    }
  }

  if (cur.length) {
    if (rows.length) {
      const last = rows.pop() as Row;
      const merged = last.placed.map((p) => p.item).concat(cur);
      rows.push(justify(merged, aspect, width, gap));
    } else {
      rows.push(justify(cur, aspect, width, gap));
    }
  }

  return rows;
}

function justify(group: number[], aspect: number[], width: number, gap: number): Row {
  const k = group.length;
  let sum = 0;
  for (const i of group) sum += aspect[i];

  const hf = (width - gap * (k - 1)) / sum;
  const h = Math.max(40, Math.round(hf));

  const placed: Placed[] = [];
  const rights: number[] = [];

  let acc = 0;
  let x = 0;

  for (let j = 0; j < k; j++) {
    acc += hf * aspect[group[j]];
    const right = j === k - 1 ? width : Math.round(acc + gap * j);
    const w = Math.max(1, right - x);
    placed.push({ item: group[j], x, w });
    rights.push(x + w);
    x = right + gap;
  }

  return { placed, rights, width, y: 0, h, phase: 0 };
}

function gridRows(items: Item[], order: number[], unit: number, gap: number): Row[] {
  const pitch = unit + gap;
  const k = Math.max(3, Math.round(Math.sqrt(RATIO * order.length)));
  const width = k * pitch;

  const rows: Row[] = [];

  for (let s = 0; s < order.length; s += k) {
    const group = order.slice(s, s + k);
    const placed: Placed[] = [];
    const rights: number[] = [];

    for (let j = 0; j < group.length; j++) {
      const x = j * pitch;
      placed.push({ item: group[j], x, w: unit });
      rights.push(x + unit);
    }

    rows.push({ placed, rights, width, y: 0, h: unit, phase: 0 });
  }

  return rows;
}

export function visible(plane: Plane, cam: Camera, vw: number, vh: number): Tile[] {
  const { rows, bottoms, height } = plane;
  const pad = Math.min(OVERSCAN / cam.z, MAX_PAD);

  const x0 = cam.x - pad;
  const x1 = cam.x + vw / cam.z + pad;
  const y0 = cam.y - pad;
  const y1 = cam.y + vh / cam.z + pad;

  const out: Tile[] = [];
  if (!rows.length) return out;

  const m0 = Math.floor(y0 / height);
  const m1 = Math.floor(y1 / height);

  for (let m = m0; m <= m1 && out.length < MAX_TILES; m++) {
    const base = m * height;
    const ly0 = y0 - base;
    const ly1 = y1 - base;

    let r = lowerBound(bottoms, ly0);

    for (; r < rows.length && out.length < MAX_TILES; r++) {
      const row = rows[r];
      if (row.y >= ly1) break;

      const y = base + row.y;
      const w = row.width;

      const s0 = Math.floor((x0 - row.phase) / w);
      const s1 = Math.floor((x1 - row.phase) / w);

      for (let s = s0; s <= s1 && out.length < MAX_TILES; s++) {
        const bx = row.phase + s * w;
        const lx0 = x0 - bx;
        const lx1 = x1 - bx;

        let k = lowerBound(row.rights, lx0);

        for (; k < row.placed.length; k++) {
          const p = row.placed[k];
          if (p.x >= lx1) break;
          out.push({
            key: `${s}.${m}.${p.item}`,
            item: p.item,
            x: bx + p.x,
            y,
            w: p.w,
            h: row.h,
          });
          if (out.length >= MAX_TILES) break;
        }
      }
    }
  }

  return out;
}

export function frameItem(
  plane: Plane,
  cam: Camera,
  item: number,
  vw: number,
  vh: number,
  z = cam.z
): Camera {
  const p = plane.place[item];
  if (!p) return cam;
  const row = plane.rows[p.row];

  const cx = cam.x + vw / cam.z / 2;
  const cy = cam.y + vh / cam.z / 2;

  const s = Math.round((cx - row.phase - p.x - p.w / 2) / row.width);
  const m = Math.round((cy - row.y - row.h / 2) / plane.height);

  const wx = row.phase + s * row.width + p.x + p.w / 2;
  const wy = m * plane.height + row.y + row.h / 2;

  return { x: wx - vw / z / 2, y: wy - vh / z / 2, z };
}

function lowerBound(arr: number[], v: number): number {
  let lo = 0;
  let hi = arr.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (arr[mid] > v) hi = mid;
    else lo = mid + 1;
  }
  return lo;
}

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const BASE = (process.env.NEXT_PUBLIC_MEDIA_BASE ?? "").replace(/\/+$/, "");

export const tinyOf = (id: string) => `${BASE}/media/${id}-tiny.webp`; 
export const thumbOf = (id: string) => `${BASE}/media/${id}-thumb.webp`; 
export const fullOf = (id: string) => `${BASE}/media/${id}-full.webp`; 
export const videoOf = (id: string) => `${BASE}/media/video/${id}.mp4`;

export function tierFor(devicePx: number, now: 0 | 1 | 2): 0 | 1 | 2 {
  const up1 = 250, down1 = 200;
  const up2 = 760, down2 = 620;
  if (now === 0) return devicePx > up1 ? (devicePx > up2 ? 2 : 1) : 0;
  if (now === 1) return devicePx > up2 ? 2 : devicePx < down1 ? 0 : 1;
  return devicePx < down1 ? 0 : devicePx < down2 ? 1 : 2;
}
