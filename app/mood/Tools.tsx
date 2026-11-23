"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { OA_EVENTS, eventProps, linkHost, track } from "./lib/analytics";
import tools from "../data/tools.json";

type Tool = { slug: string; name: string; host: string; url: string; note: string; icon: string };

const KEY = "mood.tools.open";

export default function Tools({ onOpen }: { onOpen?: (open: boolean) => void }) {
  const list = tools as Tool[];
  const [open, setOpen] = useState(false);
  const [ready, setReady] = useState(false);
  const body = useRef<HTMLDivElement>(null);
  const [h, setH] = useState(0);

  useLayoutEffect(() => {
    try {
      setOpen(localStorage.getItem(KEY) !== "0");
    } catch {
      setOpen(true);
    }

    requestAnimationFrame(() => setReady(true));
  }, []);

  useLayoutEffect(() => {
    const el = body.current;
    if (!el) return;
    const measure = () => setH(el.scrollHeight);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [list.length]);

  useEffect(() => {
    if (!ready) return;
    try { localStorage.setItem(KEY, open ? "1" : "0"); } catch {  }
  }, [open, ready]);

  useEffect(() => {
    onOpen?.(open);
  }, [open, onOpen]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !document.querySelector('[role="dialog"]')) setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (!list.length) return null;

  return (
    <div
      className="rail glass-surface"
      data-open={open || undefined}
      data-ready={ready || undefined}
      style={{ ["--rail-h" as string]: `${h}px` }}
    >
      <button
        className="rail-tab"
        onClick={() => {
          // Outside the updater on purpose: React may call an updater twice,
          // and an event sent from in there would be counted twice with it.
          track(OA_EVENTS.toolsToggle, { state: open ? "closed" : "open", from: "tab" });
          setOpen(!open);
        }}
        aria-expanded={open}
        aria-label={open ? "Close MVP" : `Open MVP (${list.length})`}
        title={open ? "Close" : "MVP"}
      >
        <span className="rail-stack" aria-hidden>
          {list.slice(0, 4).map((t) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={t.slug} src={t.icon} alt="" />
          ))}
        </span>
      </button>

      <div className="rail-body" ref={body}>
        <div className="rail-head">
          <span className="eyebrow">mvp</span>
          <span className="tnum rail-count">{list.length}</span>
          <button
            className="rail-x"
            onClick={() => {
              track(OA_EVENTS.toolsToggle, { state: "closed", from: "x" });
              setOpen(false);
            }}
            aria-label="Close MVP"
          >
            <svg width="9" height="9" viewBox="0 0 9 9" aria-hidden>
              <path d="M1 1l7 7M8 1l-7 7" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <ul className="rail-list scroll-area">
          {list.map((t, i) => (
            <li key={t.slug} style={{ ["--i" as string]: i }}>
              <a
                href={t.url}
                target="_blank"
                rel="noreferrer noopener"
                title={t.note || t.host}
                {...eventProps(OA_EVENTS.toolOpen, { tool: t.slug, host: linkHost(t.url) })}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={t.icon} alt="" width={26} height={26} loading="lazy" />
                <span className="rail-text">
                  <b>{t.name}</b>
                  <em>{t.host}</em>
                </span>
                <svg className="rail-go" width="11" height="11" viewBox="0 0 11 11" aria-hidden>
                  <path d="M2.5 8.5L8.5 2.5M4 2.5h4.5V7" stroke="currentColor" strokeWidth="1.3"
                        strokeLinecap="round" strokeLinejoin="round" fill="none" />
                </svg>
              </a>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
