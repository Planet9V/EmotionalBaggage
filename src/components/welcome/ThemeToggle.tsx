"use client";

// The theme switch for the public pages, which have no app shell. It reads and writes the same stored choice
// as the sidebar's switch (c2r.theme), so a visitor who signs in keeps the theme they picked here.
import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

const KEY = "c2r.theme";

export function ThemeToggle() {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const d = window.localStorage.getItem(KEY) === "dark";
    document.documentElement.classList.toggle("dark", d);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reads the stored theme once, on mount
    setDark(d);
  }, []);
  const flip = () => {
    const d = !dark;
    setDark(d);
    document.documentElement.classList.toggle("dark", d);
    window.localStorage.setItem(KEY, d ? "dark" : "light");
  };
  return (
    <button
      type="button"
      onClick={flip}
      aria-pressed={dark}
      className="inline-flex h-9 items-center gap-1.5 rounded-md px-2.5 text-sm text-secondary transition-colors duration-150 hover:text-primary focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-focus"
    >
      {dark ? <Sun className="h-4 w-4" aria-hidden /> : <Moon className="h-4 w-4" aria-hidden />}
      <span>Dark theme</span>
    </button>
  );
}
