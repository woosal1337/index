"use client";

import { useEffect, useState } from "react";
import { PRELOAD, warm } from "./WindowManager";

const KEY = "di-booted";

export default function BootSplash() {
  const [show, setShow] = useState(false);
  const [done, setDone] = useState(0);
  const [line, setLine] = useState("");
  const [failed, setFailed] = useState<string[]>([]);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    let cancelled = false;

    let seen = false;
    try {
      seen = !!sessionStorage.getItem(KEY);
    } catch {

    }

    if (!seen) setShow(true);

    (async () => {
      for (const item of PRELOAD) {
        if (cancelled) return;
        setLine(item.label);
        const ok = await warm(item.href);
        if (cancelled) return;
        if (!ok) setFailed((f) => [...f, item.label]);
        setDone((d) => d + 1);
      }
      if (cancelled) return;
      setLine("Ready");
      if (seen) return;
      try {
        sessionStorage.setItem(KEY, "1");
      } catch {

      }

      setTimeout(() => {
        if (!cancelled) setLeaving(true);
        setTimeout(() => !cancelled && setShow(false), 260);
      }, 420);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  if (!show) return null;

  const total = PRELOAD.length;
  const pct = Math.round((done / total) * 100);

  const cells = 24;
  const filled = Math.round((done / total) * cells);

  return (
    <div className={`boot${leaving ? " is-leaving" : ""}`} role="status" aria-live="polite">
      <div className="boot-panel">
        <p className="boot-mark">INDEX</p>
        <p className="boot-sub">A design corpus your agent can read</p>

        <p className="boot-bar" aria-hidden>
          {"█".repeat(filled)}
          {"░".repeat(cells - filled)}
        </p>

        <p className="boot-line">
          <span>{line || "Starting"}</span>
          <span className="numeric">{pct}%</span>
        </p>

        {failed.length ? (
          <p className="boot-warn">Could not preload: {failed.join(", ")}</p>
        ) : null}

        <p className="boot-foot">Index OS · Version 1.0</p>
      </div>
    </div>
  );
}
