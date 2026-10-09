"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { labelize } from "../lib/text";
import type { Tier } from "../lib/types";
import { OA_EVENTS, track } from "../lib/analytics";
import { catStyle, TierBadge } from "./primitives";
import { SearchIcon } from "./icons";

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

export default function CommandPalette({ categoryNames = {} }: { categoryNames?: Record<string, string> }) {
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
    track(OA_EVENTS.searchOpen);
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
    track(OA_EVENTS.searchSelect, { resource: slug });
    setOpen(false);
    router.push(`/r/${slug}`);
  };

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <dialog
      ref={dialogRef}
      className="palette"
      onClick={() => setOpen(false)}
      onCancel={(e) => {
        e.preventDefault();
        setOpen(false);
      }}
      aria-label="Search resources"
    >
      <div className="overlay-surface palette-box" onClick={(e) => e.stopPropagation()}>
        <div className="palette-input-row">
          <SearchIcon />
          <label htmlFor="cmdk-search" className="sr-only">
            Search resources
          </label>
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
            placeholder="Search resources, components, or domains"
            className="palette-input"
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={open}
            aria-controls="cmdk-list"
            aria-activedescendant={results[active] ? `cmdk-${active}` : undefined}
          />
          <button type="button" onClick={() => setOpen(false)} aria-label="Close search" className="btn-icon">
            <kbd>esc</kbd>
          </button>
        </div>

        <div
          id="cmdk-list"
          ref={listRef}
          role="listbox"
          aria-label="Search results"
          className="palette-list scroll-area"
        >
          {items === null ? (
            <p className="palette-empty">Loading the index…</p>
          ) : results.length === 0 ? (
            <p className="palette-empty">No matches.</p>
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
                style={catStyle(it.c)}
                className="command-row row"
              >
                <span className="dot" aria-hidden />
                <span className="main">
                  {it.n}
                  {it.t && <span className="desc"> · {it.t}</span>}
                </span>
                <span className="cat">{categoryNames[it.c] ?? labelize(it.c)}</span>
                <TierBadge tier={it.tr as Tier} />
              </button>
            ))
          )}
        </div>

        <div className="palette-foot">
          <span>
            <kbd>↑</kbd> <kbd>↓</kbd> to move
          </span>
          <span>
            <kbd>↵</kbd> to open
          </span>
          <span>
            <kbd>esc</kbd> to close
          </span>
        </div>
      </div>
    </dialog>,
    document.body
  );
}
