import Link from "next/link";
import { DOC_PAGES } from "@/lib/docs";

export const metadata = { title: "Documentation" };

export default function DocsIndex() {
  return (
    <div className="px-8 py-8">
      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-link">Documentation</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight text-primary">Guides</h1>
      <p className="mt-2 max-w-2xl text-sm text-secondary">
        Each guide describes the workbench as it is today and says plainly what is not built yet.
      </p>
      <ul className="mt-8 grid max-w-4xl gap-4 sm:grid-cols-2">
        {DOC_PAGES.map((d) => (
          <li key={d.slug}>
            <Link
              href={`/docs/${d.slug}`}
              className="block h-full rounded-xl border border-hairline bg-surface p-6 shadow-card transition-colors hover:border-dutchOrange/40 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-dutchOrange"
            >
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted">For: {d.audience}</p>
              <p className="mt-2 text-lg font-semibold text-primary">{d.title}</p>
              <p className="mt-1 text-sm text-secondary">{d.blurb}</p>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
