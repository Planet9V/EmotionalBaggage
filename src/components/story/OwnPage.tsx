"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ViewProps } from "@/components/views/types";

/** A section with a page of its own in the Whole concept group (the concept story, the sources): its /s/ address goes there. */
export function OwnPage({ section }: ViewProps) {
  const router = useRouter();
  const href = section.href ?? "/";
  useEffect(() => router.replace(href), [router, href]);
  return (
    <p className="text-sm text-secondary">
      {section.label} has its own page. <Link href={href} className="text-link hover:underline">Open {section.label}</Link>.
    </p>
  );
}
