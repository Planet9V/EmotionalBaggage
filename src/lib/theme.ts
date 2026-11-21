// Light or dark: the theme the person saved, or with nothing saved the system's setting.
export const THEME_KEY = "c2r.theme";

/** True when the page should be dark. Browser only. */
export function prefersDark(): boolean {
  const saved = window.localStorage.getItem(THEME_KEY);
  if (saved === "dark" || saved === "light") return saved === "dark";
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches === true;
}
