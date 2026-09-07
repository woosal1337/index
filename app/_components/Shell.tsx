import CommandPalette from "./CommandPalette";
import HoverPreview from "./HoverPreview";
import MenuBar from "./MenuBar";
import Dock from "./Dock";
import RouteWindow from "./RouteWindow";
import WindowManager from "./WindowManager";
import WindowLayer from "./WindowLayer";
import BootSplash from "./BootSplash";
import { getStats } from "../lib/data";

export default function Shell({
  children,
  title,
  status,
  wide = false,
}: {
  children: React.ReactNode;

  title: string;
  status?: React.ReactNode;
  wide?: boolean;
}) {
  const stats = getStats();
  return (
    <WindowManager>
    <div className="desktop">
      <CommandPalette />
      <HoverPreview />
      <MenuBar count={stats.resources} />

      <main id="main" className={`desk-area${wide ? " wide" : ""}`}>
        <RouteWindow title={title} status={status}>
          {children}
        </RouteWindow>
      </main>

      <WindowLayer />
      <Dock />
      <BootSplash />
    </div>
    </WindowManager>
  );
}
