"use client";

import Window from "./Window";
import { useWindows } from "./WindowManager";

export default function RouteWindow({
  title,
  status,
  children,
}: {
  title: string;
  status?: React.ReactNode;
  children: React.ReactNode;
}) {
  const { routeOpen, hideRoute, showRoute } = useWindows();

  if (!routeOpen) {
    return (
      <button type="button" className="desktop-icon" onClick={showRoute}>
        <svg viewBox="0 0 16 16" aria-hidden className="desktop-icon-glyph">
          <rect x="1" y="1" width="14" height="14" />
          <rect x="3" y="3" width="10" height="3" fill="var(--chrome)" />
        </svg>
        <span className="desktop-icon-label">{title}</span>
      </button>
    );
  }

  return (
    <Window title={title} status={status} onClose={hideRoute}>
      {children}
    </Window>
  );
}
