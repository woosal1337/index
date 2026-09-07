"use client";

import { useCallback } from "react";
import { useWindows } from "./WindowManager";
import Window from "./Window";

export default function WindowLayer() {
  const { windows, close, raise, open } = useWindows();

  const onClick = useCallback(
    (e: React.MouseEvent) => {
      const a = (e.target as HTMLElement).closest("a");
      if (!a) return;
      const href = a.getAttribute("href") || "";

      if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
      if (a.target === "_blank") return;

      if (!href.startsWith("/") || href.startsWith("//")) return;
      if (a.hasAttribute("download")) return;

      if (/\.(json|txt|xml|webp|png|svg)$/i.test(href)) return;

      e.preventDefault();
      open(href, a.textContent?.trim().slice(0, 40) || href);
    },
    [open]
  );

  if (!windows.length) return null;

  return (
    <div className="window-layer">
      {windows.map((w) => (
        <div
          key={w.id}
          data-window-id={w.id}
          className="window-float"
          style={{
            zIndex: w.z,
            top: `${72 + w.offset * 28}px`,
            left: `min(${8 + w.offset * 28}px, calc(100vw - 340px))`,
          }}
          onPointerDownCapture={() => raise(w.id)}
          onClick={onClick}
        >
          <Window
            title={w.title}
            id={w.id}
            onClose={() => close(w.id)}
            status={
              <>
                <span>{w.href}</span>
                <span>
                  {w.trimmed ? (
                    <>
                      Part of the page ·{" "}
                      <a href={w.href} className="underline underline-offset-2">
                        Open it whole
                      </a>
                    </>
                  ) : (
                    "Snapshot"
                  )}
                </span>
              </>
            }
          >

            <div dangerouslySetInnerHTML={{ __html: w.html }} />
          </Window>
        </div>
      ))}
    </div>
  );
}
