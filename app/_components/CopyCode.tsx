"use client";

import { useState } from "react";
import { OA_EVENTS, track } from "../lib/analytics";
import { CopyIcon } from "./icons";

export default function CopyCode({ code, what }: { code: string; what: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      track(OA_EVENTS.setupCopy, { what });
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="copy-code">
      <code className="code">{code}</code>
      <button type="button" className="btn sm is-ghost copy-code-btn" onClick={copy} aria-label={copied ? "Copied" : `Copy ${what}`} title={copied ? "Copied" : "Copy"}>
        {copied ? "Copied" : <CopyIcon />}
      </button>
    </div>
  );
}
