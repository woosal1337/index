"use client";

import { useEffect, useState } from "react";
import { OA_EVENTS, track } from "../lib/analytics";
import { ChevronsUpDownIcon, MonitorIcon, MoonIcon, SunIcon } from "./icons";

type Theme = "system" | "light" | "dark";

const LABEL: Record<Theme, string> = { system: "System", light: "Light", dark: "Dark" };

export default function ThemeSelect() {
  const [theme, setTheme] = useState<Theme>("system");

  useEffect(() => {
    try {
      const stored = localStorage.getItem("di-theme");
      if (stored === "light" || stored === "dark") setTheme(stored);
    } catch {
      return;
    }
  }, []);

  const apply = (next: Theme) => {
    setTheme(next);
    const dark = next === "dark" || (next === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.setAttribute("data-theme", dark ? "dark" : "light");
    track(OA_EVENTS.themeToggle, { theme: next });
    try {
      if (next === "system") localStorage.removeItem("di-theme");
      else localStorage.setItem("di-theme", next);
    } catch {
      return;
    }
  };

  const Icon = theme === "dark" ? MoonIcon : theme === "light" ? SunIcon : MonitorIcon;

  return (
    <label className="sb-item sb-select">
      <Icon />
      <span>Theme</span>
      <span className="sb-value">{LABEL[theme]}</span>
      <ChevronsUpDownIcon className="sb-select-chevron" />
      <select value={theme} onChange={(e) => apply(e.target.value as Theme)} aria-label="Theme">
        <option value="system">System</option>
        <option value="light">Light</option>
        <option value="dark">Dark</option>
      </select>
    </label>
  );
}
