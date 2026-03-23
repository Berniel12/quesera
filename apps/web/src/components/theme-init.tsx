"use client";

import { useEffect } from "react";

// Runs on mount to apply saved theme preference before first paint
export function ThemeInit() {
  useEffect(() => {
    const stored = localStorage.getItem("quesera-theme");
    if (stored === "dark") {
      document.documentElement.classList.add("dark");
    } else if (!stored && window.matchMedia("(prefers-color-scheme: dark)").matches) {
      document.documentElement.classList.add("dark");
    }
  }, []);

  return null;
}
