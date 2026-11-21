"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import * as Dialog from "@radix-ui/react-dialog";
import { Activity, BookOpen, BookText, ChevronRight, FileText, FolderOpen, Gauge, GitBranch, LayoutList, Link2, ListChecks, Menu, MessagesSquare, Moon, PenLine, Plug, Plus, Printer, Settings, Sun, X } from "lucide-react";
import { ProjectContext } from "@/lib/client";
import { messageOf, queries } from "@/lib/queries";
import { sectionsFor } from "@/lib/productTypes";
import type { Project } from "@/lib/types";
import { SessionControls } from "@/app/account/SessionControls";
import { ConceptFromUrl } from "@/components/concepts/ConceptFromUrl";
import { NativeSelect } from "@/components/ui/native-select";

const KEY = "c2r.project";
/** which sidebar groups the person opened or closed by hand; a group not listed follows its default */
const NAV_KEY = "c2r.nav";
const WHOLE = ["/story", "/files", "/chat", "/process", "/plan", "/drafts", "/optimise", "/traceability", "/activity", "/report"];
const WORKBENCH = ["/integrations", "/admin", "/printers"];

function readNav(): Record<string, boolean> {
  try {
    const v = JSON.parse(window.localStorage.getItem(NAV_KEY) ?? "{}") as unknown;
    return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, boolean>) : {};
  } catch {
    return {};
  }
}

/**
 * One folding group of the sidebar: a heading that is a button, and its links. The links stay in the page
 * when folded (hidden, so not focusable), so a search of the sidebar still finds every destination.
 */
function NavGroup({ id, open, onToggle, label, prefix, sub, children }: { id: string; open: boolean; onToggle: () => void; label: string; prefix?: string; sub?: boolean; children: React.ReactNode }) {
  return (
    <div className={sub ? "mb-1" : ""}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={id}
        className={`flex w-full items-center gap-1.5 rounded-md px-1.5 py-1 text-left text-[11px] font-semibold uppercase tracking-wide transition-colors duration-150 hover:bg-subtle focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-dutchOrange ${sub ? "text-secondary" : "text-primary"}`}
      >
        <ChevronRight className={`h-3 w-3 shrink-0 text-muted transition-transform duration-150 motion-reduce:transition-none ${open ? "rotate-90" : ""}`} aria-hidden />
        {prefix ? <span className="font-mono text-[10px] text-link">{prefix}</span> : null}
        <span className="min-w-0 truncate">{label}</span>
      </button>
      <div id={id} hidden={!open} className={`space-y-0.5 pt-0.5 ${sub ? "pl-3" : ""}`}>
        {children}
      </div>
    </div>
  );
}
const NO_PROJECTS: Project[] = [];

// The sign-in page renders bare: no sidebar, and none of the shell's API calls (they would answer 401).
export function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  // The landing page preview (/p/<concept id>) is the page as a visitor would see it, so it gets no sidebar.
  return path === "/sign-in" || path.startsWith("/p/") ? <>{children}</> : <AppShell>{children}</AppShell>;
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
  /** below 1024 px the sidebar is a drawer, opened from the top bar */
  const [menuOpen, setMenuOpen] = useState(false);
  const [nav, setNav] = useState<Record<string, boolean>>({});
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
    setNav(readNav());
  }, []);

  const stageOf = pathname.startsWith("/s/") ? pathname.split("/")[2] ?? "" : "";
  const activeGroups = useMemo(() => {
    const a: string[] = [];
    if (WHOLE.includes(pathname)) a.push("whole");
    if (stageOf) a.push("stages", `stage:${stageOf}`);
    if (WORKBENCH.includes(pathname) || pathname.startsWith("/docs")) a.push("workbench");
    return a;
  }, [pathname, stageOf]);

  // Arriving in a group opens it, even one folded by hand earlier: the page you are on is always in view.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- follows the address, which is outside React state
    setNav((prev) => {
      if (!activeGroups.some((g) => prev[g] === false)) return prev;
      const next = { ...prev };
      for (const g of activeGroups) delete next[g];
      window.localStorage.setItem(NAV_KEY, JSON.stringify(next));
      return next;
    });
  }, [activeGroups]);

  /** open when the person said so, else when you are in it, else its default */
  const isOpen = (id: string, byDefault: boolean) => nav[id] ?? (activeGroups.includes(id) || byDefault);
  const toggle = (id: string, byDefault: boolean) =>
    setNav((prev) => {
      const next = { ...prev, [id]: !(prev[id] ?? (activeGroups.includes(id) || byDefault)) };
      window.localStorage.setItem(NAV_KEY, JSON.stringify(next));
      return next;
    });
  const group = (cid: string, id: string, byDefault: boolean) => ({ id: `${cid}-nav-${id.replace(":", "-")}`, open: isOpen(id, byDefault), onToggle: () => toggle(id, byDefault) });

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
    `flex items-center gap-2 rounded-md px-2.5 py-1.5 text-[13px] transition-colors duration-150 [@media(max-height:800px)]:py-1 ${
      active ? "bg-dutchOrange/10 font-semibold text-link" : "text-secondary hover:bg-subtle hover:text-primary"
    }`;

  // rendered in the sidebar and, below 1024 px, in the drawer: each copy has its own control id
  const sidebar = (cid: string) => (
    <>
          <div className="border-b border-hairline px-4 py-4 [@media(max-height:800px)]:py-2.5">
            <Link href="/" className="block">
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-link">Concept to realization</p>
              <p className="mt-1 text-sm font-semibold tracking-tight">Product workbench</p>
            </Link>
            <label className="mt-4 [@media(max-height:800px)]:mt-2 block font-mono text-[10px] uppercase tracking-[0.15em] text-muted" htmlFor={cid}>
              Concept
            </label>
            <NativeSelect
              id={cid}
              value={current}
              onChange={(e) => select(e.target.value)}
              className="mt-1 bg-canvas"
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </NativeSelect>
            {/* on a short window the two sit side by side, so the list below keeps its room */}
            <div className="mt-2 flex flex-col [@media(max-height:800px)]:flex-row [@media(max-height:800px)]:items-center [@media(max-height:800px)]:gap-3">
              <button
                type="button"
                onClick={() => router.push("/new")}
                className="inline-flex h-8 w-full items-center justify-center gap-1.5 rounded-md bg-action text-xs font-semibold text-white transition ease-out-soft hover:bg-action-hover active:scale-[0.98] [@media(max-height:800px)]:flex-1"
              >
                <Plus className="h-3.5 w-3.5" aria-hidden /> New concept
              </button>
              <Link
                href="/concepts"
                aria-current={pathname === "/concepts" ? "page" : undefined}
                className="mt-2 inline-flex w-full items-center justify-center gap-1.5 text-xs font-medium text-secondary hover:text-link [@media(max-height:800px)]:mt-0 [@media(max-height:800px)]:w-auto [@media(max-height:800px)]:shrink-0"
              >
                <LayoutList className="h-3.5 w-3.5" aria-hidden /> All concepts
              </Link>
            </div>
          </div>

          {/* One scrolling region for everything that can grow; only the theme and the session stay pinned. */}
          <div className="scroll-shadow min-h-0 flex-1 overflow-y-auto px-2 py-3">
            <nav aria-label="Whole concept" className="mb-2">
              <NavGroup {...group(cid, "whole", true)} label="Whole concept">
                <Link href="/story" className={link("/story", pathname === "/story")}><BookText className="h-3.5 w-3.5" aria-hidden /> Concept story</Link>
                <Link href="/chat" className={link("/chat", pathname === "/chat")}><MessagesSquare className="h-3.5 w-3.5" aria-hidden /> Chat</Link>
                <Link href="/files" className={link("/files", pathname === "/files")}><FolderOpen className="h-3.5 w-3.5" aria-hidden /> Files</Link>
                <Link href="/process" className={link("/process", pathname === "/process")}><ListChecks className="h-3.5 w-3.5" aria-hidden /> Process</Link>
                <Link href="/plan" className={link("/plan", pathname === "/plan")}><GitBranch className="h-3.5 w-3.5" aria-hidden /> Order of operations</Link>
                <Link href="/drafts" className={link("/drafts", pathname === "/drafts")}><PenLine className="h-3.5 w-3.5" aria-hidden /> Drafts</Link>
                <Link href="/optimise" className={link("/optimise", pathname === "/optimise")}><Gauge className="h-3.5 w-3.5" aria-hidden /> Optimise</Link>
                <Link href="/traceability" className={link("/traceability", pathname === "/traceability")}><Link2 className="h-3.5 w-3.5" aria-hidden /> Traceability</Link>
                <Link href="/activity" className={link("/activity", pathname === "/activity")}><Activity className="h-3.5 w-3.5" aria-hidden /> Activity</Link>
                <Link href="/report" className={link("/report", pathname === "/report")}><FileText className="h-3.5 w-3.5" aria-hidden /> Report</Link>
              </NavGroup>
            </nav>
            <nav aria-label="Stages" className="mb-2">
              <NavGroup {...group(cid, "stages", true)} label="Stages">
                {sectionsFor((project as { productType?: string } | null)?.productType ?? "").map((st) => (
                  <NavGroup key={st.key} {...group(cid, `stage:${st.key}`, false)} label={st.label} prefix={String(st.n).padStart(2, "0")} sub>
                    {st.sections.filter((s) => !s.href).map((s) => {
                      const href = `/s/${st.key}/${s.key}`;
                      return (
                        <Link key={s.key} href={href} className={link(href, pathname === href)}>
                          {s.label}
                        </Link>
                      );
                    })}
                  </NavGroup>
                ))}
              </NavGroup>
            </nav>
            <nav aria-label="Workbench" className="border-t border-hairline pt-2">
              <NavGroup {...group(cid, "workbench", false)} label="Workbench">
                <Link href="/integrations" className={link("/integrations", pathname === "/integrations")}><Plug className="h-3.5 w-3.5" aria-hidden /> Integrations</Link>
                <Link href="/admin" className={link("/admin", pathname === "/admin")}><Settings className="h-3.5 w-3.5" aria-hidden /> Admin</Link>
                <Link href="/printers" className={link("/printers", pathname === "/printers")}><Printer className="h-3.5 w-3.5" aria-hidden /> Supported printers</Link>
                <Link href="/docs" className={link("/docs", pathname.startsWith("/docs"))}><BookOpen className="h-3.5 w-3.5" aria-hidden /> Documentation</Link>
              </NavGroup>
            </nav>
          </div>

          <div className="space-y-0.5 border-t border-hairline px-2 py-2 [@media(max-height:800px)]:py-1">
            <button type="button" onClick={toggleTheme} className={`${link("", false)} w-full`}>
              {dark ? <Sun className="h-3.5 w-3.5" aria-hidden /> : <Moon className="h-3.5 w-3.5" aria-hidden />}
              {dark ? "Light theme" : "Dark theme"}
            </button>
            <SessionControls linkClass={link("", false)} />
          </div>
            </>
  );

  return (
    <ProjectContext.Provider value={ctx}>
      <div className="flex min-h-dvh bg-canvas text-primary">
        <aside className="no-print sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-hairline bg-surface lg:flex">{sidebar("concept")}</aside>
        <Dialog.Root open={menuOpen} onOpenChange={setMenuOpen}>
          <Dialog.Portal>
            <Dialog.Overlay className="fixed inset-0 z-40 bg-black/40 lg:hidden" />
            <Dialog.Content
              aria-describedby={undefined}
              className="no-print fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col border-r border-hairline bg-surface shadow-plate focus:outline-hidden lg:hidden"
              // a link followed from the drawer closes it
              onClick={(e) => {
                if ((e.target as HTMLElement).closest("a")) setMenuOpen(false);
              }}
            >
              <Dialog.Title className="sr-only">Menu</Dialog.Title>
              <Dialog.Close className="absolute right-2 top-2 rounded-md p-1.5 text-secondary hover:bg-subtle focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-dutchOrange" aria-label="Close the menu">
                <X className="h-4 w-4" aria-hidden />
              </Dialog.Close>
              <div className="flex min-h-0 flex-1 flex-col">{sidebar("concept-menu")}</div>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>

        <main className="min-w-0 flex-1">
          <div className="no-print sticky top-0 z-30 flex items-center gap-3 border-b border-hairline bg-surface px-4 py-2 lg:hidden">
            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              aria-expanded={menuOpen}
              className="inline-flex items-center gap-2 rounded-md border border-hairline px-2.5 py-1.5 text-sm text-primary hover:bg-subtle focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-dutchOrange"
            >
              <Menu className="h-4 w-4" aria-hidden /> Menu
            </button>
            <span className="truncate text-sm font-medium text-secondary">{project?.name ?? "Product workbench"}</span>
          </div>
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
