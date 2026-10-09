import AppSidebar from "./AppSidebar";
import MobileTopbar from "./MobileTopbar";
import CommandPalette from "./CommandPalette";
import HoverPreview from "./HoverPreview";
import ShellProvider from "./ShellProvider";
import { MotionProvider } from "./motion";
import { getCategoryNames, getStats } from "../lib/data";

export default function Shell({ children, wide = false }: { children: React.ReactNode; wide?: boolean }) {
  const stats = getStats();
  return (
    <ShellProvider>
      <MotionProvider>
        <div className="app">
          <AppSidebar count={stats.resources} updated={stats.generatedAt} />
          <div className="app-main">
            <MobileTopbar />
            <div className="app-panel">
              <main id="main" className={`app-content${wide ? " wide" : ""}`}>
                {children}
              </main>
            </div>
          </div>
          <CommandPalette categoryNames={getCategoryNames()} />
          <HoverPreview />
        </div>
      </MotionProvider>
    </ShellProvider>
  );
}
