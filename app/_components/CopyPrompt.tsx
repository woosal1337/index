"use client";

import { useState } from "react";
import type { Resource } from "../lib/types";
import { buildPrompt } from "../lib/prompt";
import { OA_EVENTS, track } from "../lib/analytics";
import { Btn } from "./primitives";

export default function CopyPrompt({ resource }: { resource: Resource }) {
  const [copied, setCopied] = useState(false);
  const [show, setShow] = useState(false);
  const prompt = buildPrompt(resource);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(prompt);
      track(OA_EVENTS.promptCopy, { resource: resource.slug });
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setShow(true);
    }
  };

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <Btn solid onClick={copy}>
          {copied ? "Copied" : "Copy agent prompt"}
        </Btn>
        <Btn onClick={() => setShow((v) => !v)} ariaExpanded={show} active={show}>
          {show ? "Hide prompt" : "View prompt"}
        </Btn>
        <span className="text-[12.5px] text-fg-4">Install command, framework, licence and component list.</span>
      </div>
      {show && <pre className="code scroll-area mt-3 max-h-80 whitespace-pre-wrap">{prompt}</pre>}
    </div>
  );
}
