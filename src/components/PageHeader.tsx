export function PageHeader({ eyebrow, title, blurb, children }: { eyebrow: string; title: string; blurb?: string; children?: React.ReactNode }) {
  return (
    <header className="border-b border-hairline bg-surface px-8 py-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-link">{eyebrow}</p>
          <h1 className="mt-1.5 text-2xl font-semibold tracking-tight text-primary">{title}</h1>
          {blurb && <p className="mt-1 max-w-3xl text-sm text-secondary">{blurb}</p>}
        </div>
        {children && <div className="no-print flex flex-wrap items-center gap-2">{children}</div>}
      </div>
    </header>
  );
}
