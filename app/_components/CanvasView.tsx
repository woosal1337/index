"use client";

import Mood from "../mood/Mood";
import { ViewToggle } from "./AppSidebar";
import { useShell } from "./ShellProvider";
import type { DeckName } from "../lib/canvas";

export default function CanvasView({ deck, children }: { deck: DeckName; children: React.ReactNode }) {
  const { view, setView } = useShell();
  return (
    <>
      <div hidden={view === "canvas"}>{children}</div>
      {view === "canvas" ? (
        <Mood src={`/canvas/${deck}.json`} switcher={<ViewToggle view={view} onChange={setView} lg />} />
      ) : (
        <ViewDock />
      )}
    </>
  );
}

export function ViewDock() {
  const { view, setView } = useShell();
  return (
    <div className="canvas-hud view-dock" role="group" aria-label="View">
      <ViewToggle view={view} onChange={setView} lg />
    </div>
  );
}
