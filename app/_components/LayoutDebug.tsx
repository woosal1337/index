"use client";

import { useEffect } from "react";

export default function LayoutDebug() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    const on = new URLSearchParams(window.location.search).get("debug") === "layout";
    if (!on) return;

    const style = document.createElement("style");
    style.textContent = `
      .dbg-vw   { outline: 2px solid #ff2d55 !important; outline-offset: -2px; }
      .dbg-ovf  { outline: 2px solid #ff9500 !important; outline-offset: -2px; }
      .dbg-clip { outline: 1px dashed #0a84ff !important; }
      .dbg-tap  { outline: 1px solid #bf5af2 !important; }
      #dbg-hud {
        position: fixed; left: 8px; bottom: 8px; z-index: 99999;
        font: 12px/1.4 ui-monospace, monospace; color: #fff;
        background: rgba(0,0,0,.86); padding: 8px 10px; border-radius: 8px;
        pointer-events: none; white-space: pre;
      }
    `;
    document.head.appendChild(style);

    const run = () => {
      for (const el of document.querySelectorAll(".dbg-vw,.dbg-ovf,.dbg-clip,.dbg-tap")) {
        el.classList.remove("dbg-vw", "dbg-ovf", "dbg-clip", "dbg-tap");
      }
      const vw = document.documentElement.clientWidth;
      let vwCount = 0, ovfCount = 0, clipCount = 0, tapCount = 0;

      const inScroller = (el: HTMLElement) => {
        let p = el.parentElement;
        while (p && p !== document.body) {
          const o = getComputedStyle(p).overflowX;
          if (o === "auto" || o === "scroll") return true;
          p = p.parentElement;
        }
        return false;
      };

      for (const el of Array.from(document.body.querySelectorAll<HTMLElement>("*"))) {
        const cs = getComputedStyle(el);
        if (cs.display === "none" || cs.visibility === "hidden") continue;
        const r = el.getBoundingClientRect();
        if (r.width === 0 && r.height === 0) continue;

        if ((r.right > vw + 1 || r.left < -1) && !inScroller(el)) {
          el.classList.add("dbg-vw");
          vwCount++;
        }

        if (
          el.scrollWidth > el.clientWidth + 1 &&
          cs.overflowX !== "auto" &&
          cs.overflowX !== "scroll"
        ) {
          el.classList.add("dbg-ovf");
          ovfCount++;
        }

        if (
          el.children.length === 0 &&
          (el.textContent || "").trim().length > 0 &&
          (el.scrollHeight > el.clientHeight + 1 || el.scrollWidth > el.clientWidth + 1)
        ) {
          el.classList.add("dbg-clip");
          clipCount++;
        }

        if (
          (el.tagName === "BUTTON" || el.tagName === "A") &&
          (r.width < 24 || r.height < 24)
        ) {
          el.classList.add("dbg-tap");
          tapCount++;
        }
      }

      const pageOverflow = document.documentElement.scrollWidth - vw;
      let hud = document.getElementById("dbg-hud");
      if (!hud) {
        hud = document.createElement("div");
        hud.id = "dbg-hud";
        document.body.appendChild(hud);
      }
      hud.textContent =
        `vw ${vw}px  page ${document.documentElement.scrollWidth}px` +
        (pageOverflow > 0 ? `  H-SCROLL +${pageOverflow}px` : "  no h-scroll") +
        `\noff-viewport ${vwCount}  overflow ${ovfCount}  clipped ${clipCount}  small-tap ${tapCount}`;

      document.title =
        `[${vw} ovf:${pageOverflow > 0 ? pageOverflow : 0} vw:${vwCount} o:${ovfCount} c:${clipCount} t:${tapCount}] ` +
        document.title.replace(/^\[[^\]]*\]\s*/, "");
    };

    const t = setTimeout(run, 400);
    window.addEventListener("resize", run);
    return () => {
      clearTimeout(t);
      window.removeEventListener("resize", run);
    };
  }, []);

  return null;
}
