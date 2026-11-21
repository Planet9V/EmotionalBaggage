"use client";

import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { ErrorPanel } from "@/components/ui/states";

/** The page for an address that matches nothing: the shell's header, the one error panel, and links on. */
export function NotFoundPanel() {
  return (
    <>
      <PageHeader eyebrow="Workbench" title="Page not found" nextStep={false} />
      <div className="max-w-3xl px-8 py-6">
        <ErrorPanel
          title="This address does not match a page"
          message="The section, guide or page may have been renamed, or the address was typed with a mistake."
          todo="Open the concept's overview to pick a section, or the documentation for the guides."
          link={{ href: "/", label: "Open the overview" }}
        />
        <p className="mt-4 text-sm">
          <Link href="/docs" className="text-link underline">Open the documentation</Link>
        </p>
      </div>
    </>
  );
}
