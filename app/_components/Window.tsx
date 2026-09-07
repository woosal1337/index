"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  title: string;
  children: React.ReactNode;

  id?: string;

  status?: React.ReactNode;

  closeHref?: string;

  onClose?: () => void;
  className?: string;
};

const CLAMP = 24;

export default function Window({
  title,
  children,
  id,
  status,
  closeHref,
  onClose,
  className = "",
}: Props) {
  const key = `di-win-${id ?? title}`;
  const ref = useRef<HTMLDivElement>(null);

  const posRef = useRef({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const router = useRouter();

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(key);
      if (!raw) return;
      const p = JSON.parse(raw);
      if (typeof p?.x !== "number" || typeof p?.y !== "number") return;
      posRef.current = p;
      if (ref.current) ref.current.style.transform = `translate(${p.x}px, ${p.y}px)`;
    } catch {

    }
  }, [key]);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if ((e.target as HTMLElement).closest("[data-no-drag]")) return;
      if (e.button !== 0) return;
      const el = ref.current;
      if (!el) return;
      e.preventDefault();
      document.body.classList.add("is-dragging-window");

      const start = { x: e.clientX, y: e.clientY };
      const base = { ...posRef.current };
      let next = { ...base };
      let frame = 0;

      setDragging(true);
      try {
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      } catch {

      }

      const rect = el.getBoundingClientRect();
      const originX = rect.left - base.x;
      const originY = rect.top - base.y;
      const minX = -originX - rect.width + CLAMP * 4;
      const maxX = window.innerWidth - originX - CLAMP;
      const minY = -originY;
      const maxY = window.innerHeight - originY - CLAMP;

      const paint = () => {
        frame = 0;
        el.style.transform = `translate(${next.x}px, ${next.y}px)`;
      };

      const move = (ev: PointerEvent) => {
        next = {
          x: Math.min(Math.max(base.x + (ev.clientX - start.x), minX), maxX),
          y: Math.min(Math.max(base.y + (ev.clientY - start.y), minY), maxY),
        };

        if (!frame) frame = requestAnimationFrame(paint);
      };

      const up = () => {
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
        window.removeEventListener("pointercancel", up);
        if (frame) cancelAnimationFrame(frame);
        el.style.transform = `translate(${next.x}px, ${next.y}px)`;
        posRef.current = next;
        document.body.classList.remove("is-dragging-window");
        setDragging(false);
        try {
          sessionStorage.setItem(key, JSON.stringify(next));
        } catch {

        }
      };

      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
      window.addEventListener("pointercancel", up);
    },
    [key]
  );

  const reset = useCallback(() => {
    posRef.current = { x: 0, y: 0 };
    if (ref.current) ref.current.style.transform = "";
    try {
      sessionStorage.removeItem(key);
    } catch {

    }
  }, [key]);

  return (
    <div
      ref={ref}
      className={`window ${dragging ? "is-dragging" : ""} ${className}`}
    >
      <div
        className="window-bar"
        onPointerDown={onPointerDown}
        onDoubleClick={reset}
      >
        {onClose || closeHref ? (
          <button
            type="button"
            data-no-drag
            className="window-close"
            aria-label={`Close ${title}`}
            onClick={() => (onClose ? onClose() : router.push(closeHref!))}
          >
            <span aria-hidden>&#215;</span>
          </button>
        ) : (
          <span className="window-close is-disabled" aria-hidden />
        )}
        <span className="title-bar-text">{title}</span>
      </div>

      <div className="window-body">{children}</div>

      {status ? <div className="window-status">{status}</div> : null}
    </div>
  );
}
