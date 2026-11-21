"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FileText, GitBranch, LayoutList, Moon, Plug, Plus, Settings, Sun, BookOpen } from "lucide-react";
import { ProjectContext } from "@/lib/client";
import { messageOf, queries } from "@/lib/queries";
import { STAGES } from "@/lib/menu";
import type { Project } from "@/lib/types";
import { SessionControls } from "@/app/account/SessionControls";
import { ConceptFromUrl } from "@/components/concepts/ConceptFromUrl";

const KEY = "c2r.project";
const NO_PROJECTS: Project[] = [];

// The sign-in page renders bare: no sidebar, and none of the shell's API calls (they would answer 401).
export function Shell({ children }: { children: React.ReactNode }) {
  return usePathname() === "/sign-in" ? <>{children}</> : <AppShell>{children}</AppShell>;
}

function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const conceptsQuery = useQuery(queries.concepts());
  const projects = conceptsQuery.data ?? NO_PROJECTS;
  const loading = conceptsQuery.isPending;
  const error = messageOf(conceptsQuery.error);
  const [chosen, setChosen] = useState<string>("");
  const [dark, setDark] = useState(false);
  const { refetch } = conceptsQuery;
  const reload = useCallback(async () => {
    await refetch();
  }, [refetch]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reads the stored concept and theme on mount
    setChosen(window.localStorage.getItem(KEY) ?? "");
    const d = window.localStorage.getItem("c2r.theme") === "dark";
    setDark(d);
    document.documentElement.classList.toggle("dark", d);
  }, []);

  const select = useCallback((id: string) => {
    setChosen(id);
    window.localStorage.setItem(KEY, id);
  }, []);

  const toggleTheme = () => {
    const d = !dark;
    setDark(d);
    document.documentElement.classList.toggle("dark", d);
    window.localStorage.setItem("c2r.theme", d ? "dark" : "light");
  };

  // The stored or chosen concept if it still exists, else the first one.
  const project = useMemo(() => projects.find((p) => p.id === chosen) ?? projects[0] ?? null, [projects, chosen]);
  const current = project?.id ?? "";
  const ctx = useMemo(() => ({ projects, project, loading, error, select, reload }), [projects, project, loading, error, select, reload]);

  const link = (href: string, active: boolean) =>
    `flex items-center gap-2 rounded-md px-2.5 py-1.5 text-[13px] transition-colors duration-150 ${
      active ? "bg-dutchOrange/10 font-semibold text-link" : "text-secondary hover:bg-subtle hover:text-primary"
    }`;

  return (
    <ProjectContext.Provider value={ctx}>
      <div className="flex min-h-dvh bg-canvas text-primary">
        <aside className="no-print sticky top-0 flex h-dvh w-64 shrink-0 flex-col border-r border-hairline bg-surface">
          <div className="border-b border-hairline px-4 py-4">
            <Link href="/" className="block">
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-link">Concept to realization</p>
              <p className="mt-1 text-sm font-semibold tracking-tight">Product workbench</p>
            </Link>
            <label className="mt-4 block font-mono text-[10px] uppercase tracking-[0.15em] text-muted" htmlFor="concept">
              Concept
            </label>
            <select
              id="concept"
              value={current}
              onChange={(e) => select(e.target.value)}
              className="mt-1 h-9 w-full rounded-md border border-hairline bg-canvas px-2 text-sm text-primary focus-visible:border-dutchOrange focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-dutchOrange"
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => router.push("/new")}
              className="mt-2 inline-flex h-8 w-full items-center justify-center gap-1.5 rounded-md bg-action text-xs font-semibold text-white transition ease-out-soft hover:bg-action-hover active:scale-[0.98]"
            >
              <Plus className="h-3.5 w-3.5" aria-hidden /> New concept
            </button>
            <Link
              href="/concepts"
              aria-current={pathname === "/concepts" ? "page" : undefined}
              className="mt-2 inline-flex w-full items-center justify-center gap-1.5 text-xs font-medium text-secondary hover:text-link"
            >
              <LayoutList className="h-3.5 w-3.5" aria-hidden /> All concepts
            </Link>
          </div>

          <nav className="flex-1 overflow-y-auto px-2 py-3" aria-label="Stages">
            {STAGES.map((st) => (
              <div key={st.key} className="mb-3">
                <p className="flex items-baseline gap-2 px-2.5 pb-1 text-[11px] font-semibold uppercase tracking-wide text-primary">
                  <span className="font-mono text-[10px] text-link">{String(st.n).padStart(2, "0")}</span>
                  {st.label}
                </p>
                {st.sections.map((s) => {
                  const href = `/s/${st.key}/${s.key}`;
                  return (
                    <Link key={s.key} href={href} className={link(href, pathname === href)}>
                      {s.label}
                    </Link>
                  );
                })}
              </div>
            ))}
          </nav>

          <div className="space-y-0.5 border-t border-hairline px-2 py-2">
            <Link href="/plan" className={link("/plan", pathname === "/plan")}><GitBranch className="h-3.5 w-3.5" aria-hidden /> Order of operations</Link>
            <Link href="/report" className={link("/report", pathname === "/report")}><FileText className="h-3.5 w-3.5" aria-hidden /> Report</Link>
            <Link href="/integrations" className={link("/integrations", pathname === "/integrations")}><Plug className="h-3.5 w-3.5" aria-hidden /> Integrations</Link>
            <Link href="/admin" className={link("/admin", pathname === "/admin")}><Settings className="h-3.5 w-3.5" aria-hidden /> Admin</Link>
            <Link href="/docs" className={link("/docs", pathname.startsWith("/docs"))}><BookOpen className="h-3.5 w-3.5" aria-hidden /> Documentation</Link>
            <button type="button" onClick={toggleTheme} className={`${link("", false)} w-full`}>
              {dark ? <Sun className="h-3.5 w-3.5" aria-hidden /> : <Moon className="h-3.5 w-3.5" aria-hidden />}
              {dark ? "Light theme" : "Dark theme"}
            </button>
            <SessionControls linkClass={link("", false)} />
          </div>
        </aside>

        <main className="min-w-0 flex-1">
          {error ? (
            <div className="m-8 rounded-xl border border-hairline bg-danger-soft p-5 text-sm text-danger" role="alert">
              <p className="font-semibold">The database could not be reached.</p>
              <p className="mt-1">{error}</p>
            </div>
          ) : (
            <>
              <Suspense fallback={null}><ConceptFromUrl /></Suspense>
              {children}
            </>
          )}
        </main>
      </div>
    </ProjectContext.Provider>
  );
}
