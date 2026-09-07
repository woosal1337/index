"use client";

import { useEffect, useState } from "react";

export default function ThemeToggle() {
  const [light, setLight] = useState(false);

  useEffect(() => {
    setLight(document.documentElement.getAttribute("data-theme") === "light");
  }, []);

  const toggle = () => {
    const next = !light;
    setLight(next);
    if (next) {
      localStorage.setItem("di-theme", "light");
      document.documentElement.setAttribute("data-theme", "light");
    } else {
      localStorage.removeItem("di-theme");
      document.documentElement.removeAttribute("data-theme");
    }
  };

  return (
    <button
      type="button"
      onClick={toggle}
      className="label transition-colors hover:text-fg"
      aria-pressed={light}
      title="Switch theme"
    >
      {light ? "Dark theme" : "Light theme"}
    </button>
  );
}
