"use client";

import Link from "next/link";
import { useEffect, type ReactNode } from "react";
import { EYEBROW } from "@/components/ui/field";
import { prefersDark } from "@/lib/theme";

/**
 * The page around every account screen: the same centred column, eyebrow, heading and card as the sign-in page
 * (src/app/sign-in/SignInForm.tsx). These pages have no app shell, so the stored theme is applied here. `wide` is
 * for the workspace screens, which hold lists.
 */
export function Frame({ title, lead, children, footer, wide = false }: { title: string; lead?: ReactNode; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  useEffect(() => {
    document.documentElement.classList.toggle("dark", prefersDark());
  }, []);
  return (
    <main className="flex min-h-dvh items-center justify-center bg-canvas px-4 py-10 text-primary">
      <div className={wide ? "w-full max-w-3xl" : "w-full max-w-sm"}>
        <p className={EYEBROW}>Concept to realization</p>
        <h1 className="mt-1.5 text-2xl font-semibold tracking-tight text-primary">{title}</h1>
        {lead && <p className="mt-1 text-sm text-secondary">{lead}</p>}
        <div className="mt-6 space-y-4 rounded-xl border border-hairline bg-surface p-5">{children}</div>
        {footer && <div className="mt-4 space-y-1 text-sm text-secondary">{footer}</div>}
      </div>
    </main>
  );
}

/** A link in a frame's footer or text, in the app's link colour. */
export function TextLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="text-link underline-offset-4 hover:underline focus-visible:rounded-sm focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-dutchOrange">
      {children}
    </Link>
  );
}
