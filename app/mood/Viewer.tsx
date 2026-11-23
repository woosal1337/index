"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { OA_EVENTS, eventProps, linkHost, track } from "./lib/analytics";
import { type Deck, fullOf, thumbOf, videoOf } from "./lib/plane";

const MORPH_MS = 420;

type Rect = { left: number; top: number; width: number; height: number };

type Props = {
  deck: Deck;
  item: number;

  from: Rect;
  onClose: () => void;
  onStep: (delta: number) => void;
  onPick: (item: number) => void;
};

export default function Viewer({ deck, item, from, onClose, onStep, onPick }: Props) {
  const media = deck.items[item];
  const board = deck.boards[media.board];

  const [box, setBox] = useState<Rect>(from);
  const [open, setOpen] = useState(false);
  const [settled, setSettled] = useState(false);
  const [fullReady, setFullReady] = useState(false);
  const [fade, setFade] = useState(false);
  const closing = useRef(false);
  const opened = useRef(item);

  useLayoutEffect(() => {
    let second = 0;
    const first = requestAnimationFrame(() => {
      second = requestAnimationFrame(() => {
        setBox(fit(media.w, media.h));
        setOpen(true);
      });
    });
    const t = setTimeout(() => setSettled(true), MORPH_MS);
    return () => {
      cancelAnimationFrame(first);
      cancelAnimationFrame(second);
      clearTimeout(t);
    };

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const prevItem = useRef(item);
  useEffect(() => {
    if (prevItem.current === item) return;
    prevItem.current = item;
    setBox(fit(media.w, media.h));
    setFullReady(false);
  }, [item, media.w, media.h]);

  useEffect(() => {
    const onResize = () => open && setBox(fit(media.w, media.h));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [open, media.w, media.h]);

  const close = () => {
    if (closing.current) return;
    closing.current = true;
    setOpen(false);
    setSettled(false);

    if (item === opened.current) setBox(from);
    else setFade(true);
    setTimeout(onClose, MORPH_MS);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); close(); }
      else if (e.key === "ArrowRight" || e.key === " ") { e.preventDefault(); onStep(1); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); onStep(-1); }
      else return;
      e.stopPropagation();
    };

    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  });

  const siblings = board?.items ?? [];
  const place = siblings.indexOf(item);
  const playable = media.kind === 1;

  return (
    <div
      className="fixed inset-0 z-50"
      role="dialog"
      aria-modal="true"
      aria-label={board?.topic || media.id}
    >
      <div
        onClick={close}
        style={{
          position: "absolute",
          inset: 0,
          background: "var(--scrim)",
          backdropFilter: "blur(20px) saturate(0.9)",
          WebkitBackdropFilter: "blur(20px) saturate(0.9)",
          opacity: open ? 1 : 0,
          transition: `opacity ${MORPH_MS}ms var(--ease-standard)`,
        }}
      />

      <figure
        style={{
          position: "absolute",
          margin: 0,
          left: box.left,
          top: box.top,
          width: box.width,
          height: box.height,
          borderRadius: open ? 4 : 3,
          overflow: "hidden",

          backgroundImage: `url(${thumbOf(media.id)})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          opacity: fade ? 0 : 1,
          transition: `left ${MORPH_MS}ms var(--ease-out-expo), top ${MORPH_MS}ms var(--ease-out-expo), width ${MORPH_MS}ms var(--ease-out-expo), height ${MORPH_MS}ms var(--ease-out-expo), opacity ${MORPH_MS}ms var(--ease-standard)`,
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          key={media.id}
          src={fullOf(media.id)}
          alt={board?.topic || ""}
          draggable={false}
          onLoad={() => setFullReady(true)}
          style={{
            display: "block",
            width: "100%",
            height: "100%",
            objectFit: "cover",
            opacity: fullReady ? 1 : 0,
            transition: `opacity ${MORPH_MS}ms var(--ease-standard)`,
          }}
        />

        {playable && settled && (
          <video
            key={`v-${media.id}`}
            src={videoOf(media.id)}
            poster={fullOf(media.id)}
            controls
            autoPlay
            loop
            playsInline
            onClick={(e) => e.stopPropagation()}
            /*
             * Playback started, which is not the same as the video opening.
             * The element asks to autoplay with sound, and a browser refuses
             * that on most phones — so this event minus the `video` share of
             * image_open is how often autoplay was blocked.
             */
            onPlay={() => track(OA_EVENTS.videoPlay, { id: media.id, author: board?.author ?? "" })}
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", background: "#000" }}
          />
        )}

        {media.kind === 2 && settled && (
          <p
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              bottom: 0,
              margin: 0,
              padding: "10px 14px",
              fontSize: 11,
              color: "rgb(255 255 255 / 0.72)",
              background: "linear-gradient(to top, rgb(0 0 0 / 0.7), transparent)",
            }}
          >
            Poster frame — the video itself was never archived.
          </p>
        )}
      </figure>

      <Chrome
        show={open}
        board={board}
        place={place}
        siblings={siblings}
        current={item}
        deck={deck}
        onClose={close}
        onStep={onStep}
        onPick={onPick}
      />
    </div>
  );
}

function Chrome({
  show, board, place, siblings, current, deck, onClose, onStep, onPick,
}: {
  show: boolean;
  board: Deck["boards"][number] | undefined;
  place: number;
  siblings: number[];
  current: number;
  deck: Deck;
  onClose: () => void;
  onStep: (d: number) => void;
  onPick: (i: number) => void;
}) {
  const style: React.CSSProperties = {
    opacity: show ? 1 : 0,
    transition: `opacity ${MORPH_MS}ms var(--ease-standard) ${show ? "120ms" : "0ms"}`,
    color: "rgb(255 255 255 / 0.86)",
  };

  return (
    <>
      <div
        style={{
          ...style,
          position: "absolute",
          top: 0,
          right: 0,
          padding: 18,
          display: "flex",
          gap: 14,
          alignItems: "center",
        }}
      >
        {siblings.length > 1 && (
          <span className="mono tnum" style={{ fontSize: 11, color: "rgb(255 255 255 / 0.45)" }}>
            {place + 1}/{siblings.length}
          </span>
        )}
        <button onClick={onClose} aria-label="Close" style={ghost}>
          esc
        </button>
      </div>

      <Arrow side="left" onClick={() => onStep(-1)} show={show} />
      <Arrow side="right" onClick={() => onStep(1)} show={show} />

      <div
        style={{
          ...style,
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          padding: "0 22px 20px",
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "space-between",
          gap: 24,
          pointerEvents: "none",
        }}
      >
        <div style={{ minWidth: 0, pointerEvents: "auto" }}>
          {board?.author && (
            <p style={{ margin: 0, fontSize: 13, fontWeight: 500 }}>
              @{board.author}
              {board.authorName && (
                <span style={{ marginLeft: 8, fontWeight: 400, color: "rgb(255 255 255 / 0.3)" }}>
                  {board.authorName}
                </span>
              )}
            </p>
          )}
          {board?.topic && (
            <p
              style={{
                margin: "3px 0 0",
                fontSize: 12,
                color: "rgb(255 255 255 / 0.3)",
                maxWidth: "56ch",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {board.topic}
            </p>
          )}
          {siblings.length > 1 && (
            <div style={{ display: "flex", gap: 6, marginTop: 12 }}>
              {siblings.map((s) => (
                <button
                  key={s}
                  onClick={() => onPick(s)}
                  aria-label={`Image ${siblings.indexOf(s) + 1} of this post`}
                  aria-current={s === current}
                  style={{
                    width: 44,
                    height: 30,
                    padding: 0,
                    borderRadius: 3,
                    overflow: "hidden",
                    border: "none",
                    cursor: "pointer",
                    background: `center/cover url(${thumbOf(deck.items[s].id)})`,
                    opacity: s === current ? 1 : 0.4,
                    outline: s === current ? "1px solid rgb(255 255 255 / 0.7)" : "none",
                    outlineOffset: 1,
                    transition: "opacity var(--dur-move) var(--ease-standard)",
                  }}
                />
              ))}
            </div>
          )}
        </div>

        <div
          className="mono tnum"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
            fontSize: 11,
            color: "rgb(255 255 255 / 0.45)",
            pointerEvents: "auto",
            flexShrink: 0,
          }}
        >
          {board && board.likes > 0 && <span>{compact(board.likes)} likes</span>}
          {board?.url && (
            <a
              href={board.url}
              target="_blank"
              rel="noreferrer noopener"
              {...eventProps(OA_EVENTS.boardSource, {
                author: board.author,
                host: linkHost(board.url),
              })}
              style={{ color: "rgb(255 255 255 / 0.75)", textDecoration: "none", borderBottom: "1px solid rgb(255 255 255 / 0.28)" }}
            >
              source
            </a>
          )}
        </div>
      </div>
    </>
  );
}

function Arrow({ side, onClick, show }: { side: "left" | "right"; onClick: () => void; show: boolean }) {
  return (
    <button
      onClick={onClick}
      aria-label={side === "left" ? "Previous" : "Next"}
      style={{
        position: "absolute",
        [side]: 0,
        top: 0,
        bottom: 0,
        width: 88,
        border: "none",
        background: "transparent",
        color: "rgb(255 255 255 / 0.55)",
        fontSize: 20,
        cursor: "pointer",
        opacity: show ? 1 : 0,
        transition: `opacity ${MORPH_MS}ms var(--ease-standard)`,
      }}
    >
      {side === "left" ? "‹" : "›"}
    </button>
  );
}

const ghost: React.CSSProperties = {
  border: "1px solid rgb(255 255 255 / 0.22)",
  background: "transparent",
  color: "rgb(255 255 255 / 0.7)",
  borderRadius: 6,
  padding: "3px 8px",
  fontSize: 11,
  fontFamily: "var(--font-mono)",
  cursor: "pointer",
};

function fit(w: number, h: number): Rect {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const padX = Math.min(96, vw * 0.07);
  const top = Math.min(64, vh * 0.06);
  const bottom = vw < 640 ? 132 : 116;
  const availW = Math.max(80, vw - padX * 2);
  const availH = Math.max(80, vh - top - bottom);
  const s = Math.min(availW / w, availH / h);
  const rw = w * s;
  const rh = h * s;
  return { left: (vw - rw) / 2, top: top + (availH - rh) / 2, width: rw, height: rh };
}

function compact(n: number) {
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k`;
  return String(n);
}
