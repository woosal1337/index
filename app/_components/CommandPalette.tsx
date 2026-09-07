"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { labelize } from "../lib/text";

type Item = {
  s: string;
  n: string;
  t: string;
  c: string;
  tr: string;
  d: string;
  h: string;
};

const OPEN = "di:open-palette";
export function openPalette() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(OPEN));
}

let cached: Item[] | null = null;
let pending: Promise<Item[]> | null = null;
function loadIndex(): Promise<Item[]> {
  if (cached) return Promise.resolve(cached);
  if (!pending) {
    pending = fetch("/api/search.json")
      .then((r) => (r.ok ? r.json() : []))
      .then((j: Item[]) => {
        cached = Array.isArray(j) ? j : [];
        return cached;
      })
      .catch(() => {
        cached = [];
        return cached;
      });
  }
  return pending;
}

export default function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Item[] | null>(cached);
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === "Escape") setOpen(false);
      if (e.key === "/" && !open) {
        const t = e.target as HTMLElement;
        if (t.tagName !== "INPUT" && t.tagName !== "TEXTAREA" && !t.isContentEditable) {
          e.preventDefault();
          setOpen(true);
        }
      }
    };
    const onOpen = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener(OPEN, onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener(OPEN, onOpen);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const trigger = document.activeElement;
    const dialog = dialogRef.current;
    dialog?.showModal();
    setQ("");
    setActive(0);
    loadIndex().then(setItems);
    const frame = requestAnimationFrame(() => inputRef.current?.focus());
    return () => {
      cancelAnimationFrame(frame);
      dialog?.close();
      if (trigger instanceof HTMLElement && trigger.isConnected) trigger.focus();
    };
  }, [open]);

  const results = useMemo(() => {
    const list = items ?? [];
    const needle = q.trim().toLowerCase();
    if (!needle) return list.slice(0, 12);
    const words = needle.split(/\s+/).filter(Boolean);
    const scored: { it: Item; s: number }[] = [];
    for (const it of list) {
      const n = it.n.toLowerCase();
      let s = -1;
      if (n === needle) s = 1000;
      else if (n.startsWith(needle)) s = 500;
      else if (n.includes(needle)) s = 300;
      else if (it.d.includes(needle)) s = 200;
      else if ((it.t || "").toLowerCase().includes(needle)) s = 100;
      else if (it.c.includes(needle)) s = 60;
      else if ((it.h || "").includes(needle)) s = 40;

      else if (words.length > 1 && words.every((w) => (it.h || "").includes(w))) s = 20;
      if (s >= 0) scored.push({ it, s });
    }
    return scored.sort((a, b) => b.s - a.s).slice(0, 20).map((x) => x.it);
  }, [q, items]);

  useEffect(() => setActive(0), [q]);

  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-i="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active]);

  const go = (slug: string) => {
    setOpen(false);
    router.push(`/r/${slug}`);
  };

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <dialog
      ref={dialogRef}
      className="fixed inset-0 z-[100] m-0 flex h-dvh max-h-none w-screen max-w-none items-start justify-center overscroll-contain border-0 bg-[var(--scrim)] p-4 pt-[14vh] text-fg backdrop-blur-[4px] backdrop:bg-transparent"
      onClick={() => setOpen(false)}
      onCancel={(e) => { e.preventDefault(); setOpen(false); }}
      aria-label="Search resources"
    >
      <div
        className="overlay-surface w-full max-w-[600px] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 border-b border-line px-4 transition-colors focus-within:border-line-hard">
          <label htmlFor="cmdk-search" className="sr-only">Search resources</label>
          <input
            id="cmdk-search"
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setActive((i) => Math.max(0, Math.min(i + 1, results.length - 1)));
              }
              if (e.key === "ArrowUp") {
                e.preventDefault();
                setActive((i) => Math.max(i - 1, 0));
              }
              if (e.key === "Enter" && results[active]) {
                e.preventDefault();
                go(results[active].s);
              }
            }}
            placeholder="Search resources, components, domains…"
            className="h-12 min-w-0 flex-1 bg-transparent text-[16px] placeholder:text-fg-4"
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={open}
            aria-controls="cmdk-list"
            aria-activedescendant={results[active] ? `cmdk-${active}` : undefined}
          />
          <button type="button" onClick={() => setOpen(false)} aria-label="Close search (Escape)" className="min-h-10 min-w-10">
            <kbd>esc</kbd>
          </button>
        </div>

        <div id="cmdk-list" ref={listRef} role="listbox" aria-label="Search results" className="scroll-area max-h-[52vh] overflow-y-auto overscroll-contain py-1.5">
          {items === null ? (
            <p className="px-4 py-6 text-[13px] text-fg-4">Loading the index…</p>
          ) : results.length === 0 ? (
            <p className="px-4 py-6 text-[13px] text-fg-4">No matches.</p>
          ) : (
            results.map((it, i) => (
              <button
                type="button"
                key={it.s}
                id={`cmdk-${i}`}
                data-i={i}
                role="option"
                tabIndex={-1}
                aria-selected={i === active}
                onMouseEnter={() => setActive(i)}
                onClick={() => go(it.s)}
                style={{ "--dot": `var(--cat-${it.c}, var(--fg))` } as CSSProperties}
                className={`row w-full px-4 text-left ${i === active ? "bg-surface-2" : ""}`}
              >
                <span className="dot" aria-hidden />
                <span className="main text-[14px]">
                  {it.n}
                  {it.t && <span className="desc"> · {it.t}</span>}
                </span>
                <span className="leader" aria-hidden />
                <span className="meta" title={labelize(it.c)}>
                  {it.tr === "S" || it.tr === "A" ? <b>{it.tr}</b> : it.tr}
                </span>
              </button>
            ))
          )}
        </div>
      </div>
    </dialog>,
    document.body
  );
}
