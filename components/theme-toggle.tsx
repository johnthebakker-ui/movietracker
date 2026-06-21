"use client";

import { SunMoon } from "lucide-react";

export function ThemeToggle() {
  function toggleTheme() {
    const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    localStorage.setItem("movietracker-theme", next);
  }
  return <button className="icon-button" aria-label="Toggle color theme" onClick={toggleTheme}>
    <SunMoon size={17} />
  </button>;
}
