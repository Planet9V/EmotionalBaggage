"use client";

import { useEffect } from "react";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Opens the browser's print dialog, where "Save as PDF" is one of the printers. Paper is white, so while the
 * page prints (from this button or from the browser's own menu) it is drawn in the light theme, then put back.
 */
export function PrintButton() {
  useEffect(() => {
    const html = document.documentElement;
    let wasDark = false;
    const before = () => {
      wasDark = html.classList.contains("dark");
      html.classList.remove("dark");
    };
    const after = () => {
      if (wasDark) html.classList.add("dark");
    };
    window.addEventListener("beforeprint", before);
    window.addEventListener("afterprint", after);
    return () => {
      window.removeEventListener("beforeprint", before);
      window.removeEventListener("afterprint", after);
    };
  }, []);
  return (
    <Button size="sm" variant="outline" onClick={() => window.print()}>
      <Printer className="h-3.5 w-3.5" aria-hidden /> Print or save as PDF
    </Button>
  );
}
