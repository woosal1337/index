"use client";

import { Brand } from "./AppSidebar";
import { openPalette } from "./CommandPalette";
import { useShell } from "./ShellProvider";
import { MenuIcon, SearchIcon } from "./icons";

export default function MobileTopbar() {
  const { setSidebarOpen } = useShell();
  return (
    <header className="app-topbar">
      <button type="button" className="btn-icon" onClick={() => setSidebarOpen(true)} aria-label="Open the menu">
        <MenuIcon />
      </button>
      <Brand />
      <span className="ml-auto" />
      <button type="button" className="btn-icon" onClick={openPalette} aria-label="Search resources">
        <SearchIcon />
      </button>
    </header>
  );
}
