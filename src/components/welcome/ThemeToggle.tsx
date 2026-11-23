"use client";

// The theme switch for the public pages, which have no app shell. It reads and writes the same stored choice
// as the sidebar's switch (c2r.theme), so a visitor who signs in keeps the theme they picked here. Like the
// sidebar's switch, its label names what pressing it does. The welcome page's header and hero are dark in both themes, so
// the label speaks of the page below them, not of "the theme" the visitor seems to be looking at. `compact` (the
// welcome page's header, which must keep its action in reach on a phone) shows the icon alone and keeps the label for
// screen readers.
import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { TOGGLE } from "./content";

const KEY = "c2r.theme";

export function ThemeToggle({ compact = false }: { compact?: boolean }) {
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
      className="inline-flex h-9 items-center gap-1.5 rounded-md px-2.5 text-sm text-secondary transition-colors duration-150 hover:text-primary focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-focus"
    >
      {dark ? <Sun className="h-4 w-4" aria-hidden /> : <Moon className="h-4 w-4" aria-hidden />}
      <span className={compact ? "sr-only" : undefined}>{dark ? TOGGLE.toLight : TOGGLE.toDark}</span>
    </button>
  );
}
