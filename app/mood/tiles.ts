import { type Deck, type Tile, fullOf, thumbOf, tinyOf, videoOf } from "./lib/plane";

const SRC = [tinyOf, thumbOf, fullOf];
const FADE_MS = 280;
const KEEP = 128;

type Node = {
  el: HTMLDivElement;
  gen: number;
  item: number;
  id: string;
  kind: 0 | 1 | 2;
  wx: number;
  wy: number;
  want: number;
  top: number;
  layers: (HTMLImageElement | null)[];
  mark: HTMLSpanElement | null;
  video: HTMLVideoElement | null;
};

export type Tiles = ReturnType<typeof mountTiles>;

export function mountTiles(
  root: HTMLElement,
  deck: Deck,
  open: (item: number, el: HTMLElement) => void
) {
  const live = new Map<string, Node>();
  const spare: Node[] = [];
  const owner = new WeakMap<Element, Node>();
  const seen = new Set<string>();

  let match: Set<number> | null = null;
  let plays = true;
  let fade = true;
  let hot: Node | null = null;
  let ox = 0;
  let oy = 0;

  function build(): Node {
    const el = document.createElement("div");
    el.className = "tile";
    el.setAttribute("role", "button");
    el.tabIndex = -1;
    const n: Node = {
      el,
      gen: 0,
      item: -1,
      id: "",
      kind: 0,
      wx: 0,
      wy: 0,
      want: -1,
      top: -1,
      layers: [null, null, null],
      mark: null,
      video: null,
    };
    owner.set(el, n);
    return n;
  }

  function dim(n: Node) {
    if (match !== null && !match.has(n.item)) n.el.dataset.dim = "";
    else delete n.el.dataset.dim;
  }

  function badge(n: Node) {
    if (n.kind === 0) {
      if (n.mark) n.mark.hidden = true;
      return;
    }
    if (!n.mark) {
      n.mark = document.createElement("span");
      n.mark.className = "play";
      n.mark.setAttribute("aria-hidden", "true");
      n.el.appendChild(n.mark);
    }
    n.mark.hidden = n.video !== null;
  }

  function place(n: Node, t: Tile) {
    const it = deck.items[t.item];
    n.gen++;
    n.item = t.item;
    n.id = it.id;
    n.kind = it.kind;
    n.wx = t.x;
    n.wy = t.y;
    n.want = -1;
    n.top = -1;

    const s = n.el.style;
    s.left = `${t.x - ox}px`;
    s.top = `${t.y - oy}px`;
    s.width = `${t.w}px`;
    s.height = `${t.h}px`;
    n.el.setAttribute("aria-label", it.id);

    dim(n);
    badge(n);
    root.appendChild(n.el);
  }

  function sweep(n: Node, k: number, gen: number) {
    setTimeout(() => {
      if (n.gen !== gen || n.top !== k) return;
      for (let j = 0; j < k; j++) drop(n, j);
    }, FADE_MS);
  }

  function drop(n: Node, k: number) {
    const img = n.layers[k];
    if (!img) return;
    img.onload = null;
    img.onerror = null;
    img.removeAttribute("src");
    img.remove();
    n.layers[k] = null;
  }

  function layer(n: Node, k: number) {
    const img = document.createElement("img");
    img.decoding = "async";
    img.draggable = false;
    img.alt = "";
    img.setAttribute("fetchpriority", k === 2 ? "low" : k === 0 ? "high" : "auto");
    if (!fade) img.dataset.snap = "";

    const gen = n.gen;
    img.onload = () => {
      if (n.gen !== gen) return;
      img.dataset.loaded = "";
      if (k <= n.top) return;
      n.top = k;
      if (k > 0) sweep(n, k, gen);
    };
    img.onerror = () => {
      if (n.gen === gen) drop(n, k);
    };

    n.layers[k] = img;
    n.el.appendChild(img);
    img.src = SRC[k](n.id);
  }

  function dress(n: Node, serve: number) {
    if (serve < 0) return;
    if (serve > n.want) n.want = serve;
    for (let k = 0; k <= n.want; k++) {
      if (n.layers[k] || k < n.top) continue;
      layer(n, k);
    }
  }

  function start(n: Node) {
    if (n.kind !== 1 || n.video) return;
    const v = document.createElement("video");
    v.muted = true;
    v.loop = true;
    v.autoplay = true;
    v.playsInline = true;
    v.poster = thumbOf(n.id);
    v.dataset.loaded = "";
    n.video = v;
    n.el.appendChild(v);
    v.src = videoOf(n.id);
    void v.play().catch(() => {});
    if (n.mark) n.mark.hidden = true;
  }

  function stop(n: Node) {
    if (!n.video) return;
    n.video.pause();
    n.video.removeAttribute("src");
    n.video.load();
    n.video.remove();
    n.video = null;
    if (n.mark) n.mark.hidden = false;
  }

  function leave() {
    if (!hot) return;
    stop(hot);
    hot = null;
  }

  function release(n: Node) {
    n.gen++;
    if (n === hot) leave();
    for (let k = 0; k < 3; k++) drop(n, k);
    n.el.remove();
    if (spare.length < KEEP) spare.push(n);
  }

  function tileOf(target: EventTarget | null): Node | null {
    const el = target instanceof Element ? target.closest(".tile") : null;
    return el ? owner.get(el) ?? null : null;
  }

  const onOver = (e: PointerEvent) => {
    const n = tileOf(e.target);
    if (!n || n === hot) return;
    leave();
    hot = n;
    if (plays) start(n);
  };

  const onOut = (e: PointerEvent) => {
    if (!hot) return;
    const to = e.relatedTarget;
    if (to instanceof Element && hot.el.contains(to)) return;
    leave();
  };

  const onClick = (e: MouseEvent) => {
    const n = tileOf(e.target);
    if (n) open(n.item, n.el);
  };

  root.addEventListener("pointerover", onOver);
  root.addEventListener("pointerout", onOut);
  root.addEventListener("click", onClick);

  return {
    sync(list: Tile[], serve: number) {
      seen.clear();
      for (const t of list) {
        let n = live.get(t.key);
        if (!n) {
          n = spare.pop() ?? build();
          place(n, t);
          live.set(t.key, n);
        }
        dress(n, serve);
        seen.add(t.key);
      }
      for (const [key, n] of live) {
        if (seen.has(key)) continue;
        release(n);
        live.delete(key);
      }
    },

    reset() {
      for (const n of live.values()) release(n);
      live.clear();
      seen.clear();
    },

    rebase(x: number, y: number) {
      ox = x;
      oy = y;
      for (const n of live.values()) {
        n.el.style.left = `${n.wx - ox}px`;
        n.el.style.top = `${n.wy - oy}px`;
      }
    },

    setMatch(m: Set<number> | null) {
      match = m;
      for (const n of live.values()) dim(n);
    },

    setFade(on: boolean) {
      fade = on;
    },

    stats() {
      let imgs = 0;
      let px = 0;
      for (const n of live.values()) {
        for (const img of n.layers) {
          if (!img) continue;
          imgs++;
          px += img.naturalWidth * img.naturalHeight;
        }
      }
      return { tiles: live.size, imgs, mb: (px * 4) / 1048576 };
    },

    setPlays(on: boolean) {
      plays = on;
      if (!on) {
        if (hot) stop(hot);
      } else if (hot) start(hot);
    },

    destroy() {
      root.removeEventListener("pointerover", onOver);
      root.removeEventListener("pointerout", onOut);
      root.removeEventListener("click", onClick);
      leave();
      for (const n of live.values()) release(n);
      live.clear();
      spare.length = 0;
    },
  };
}
