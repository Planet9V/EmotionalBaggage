"use client";

// "Your turn": the four service levels, and the way in that exists today. Accounts and payment are not built, so
// no card pretends otherwise: Free, Maker and Studio each ask for access, which brings the visitor to the request
// form with the chosen level named above it and preselected in the form's Level field (changeable there; the
// level is stored with the request), and Self-hosted goes to "Run it yourself". Prices are the owner's to confirm:
// while SHOW_PRICES is false the paid levels read "Price to be announced". The links work without script; script
// adds the level to the heading and the form.
import Link from "next/link";
import { useState } from "react";
import { ArrowRight, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ACCESS_LEVEL_LABEL, type AccessLevel } from "@/lib/accessRequests/shared";
import { AccessRequestForm } from "./AccessRequestForm";
import { DEMO_NOTE, HERO, LEVELS, SHOW_PRICES, YOUR_TURN, type Level } from "./content";

function Price({ level }: { level: Level }) {
  if (SHOW_PRICES) {
    return (
      <p className="flex h-12 items-baseline gap-1.5">
        <span className="text-[1.75rem] font-semibold tracking-tight text-primary">{level.price}</span>
        {level.per ? <span className="text-sm text-secondary">{level.per}</span> : null}
      </p>
    );
  }
  return <p className={`flex h-12 items-center ${level.paid ? "text-[15px] font-medium text-secondary" : "text-[1.75rem] font-semibold tracking-tight text-primary"}`}>{level.paid ? YOUR_TURN.tba : "Free"}</p>;
}

export function Levels() {
  const [level, setLevel] = useState<AccessLevel | "">("");
  const levelName = level ? ACCESS_LEVEL_LABEL[level] : null;
  return (
    <>
      <ul className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {LEVELS.map((l) => (
          <li key={l.key} className={`flex flex-col rounded-xl border bg-surface p-5 shadow-[var(--shadow-card)] ${level === l.key ? "border-dutchOrange" : "border-hairline"}`}>
            <h3 className="text-lg font-semibold tracking-tight text-primary">{l.name}</h3>
            <p className="mt-0.5 font-mono text-[11px] text-link">{l.who}</p>
            <div className="mt-3">
              <Price level={l} />
            </div>
            <p className="mt-2 min-h-[4rem] text-sm leading-snug text-secondary">{l.what}</p>
            <p className="mt-4 font-mono text-[11px] text-muted">{YOUR_TURN.includes}</p>
            <ul className="mt-2 space-y-2">
              {l.includes.map((t) => (
                <li key={t} className="flex gap-2.5 text-[13px] leading-snug text-secondary">
                  <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-link" aria-hidden />
                  {t}
                </li>
              ))}
            </ul>
            <div className="mt-auto pt-5">
              {l.action === "request" ? (
                <Button asChild variant={l.key === "maker" ? "primary" : "outline"} className="h-10 w-full rounded-lg">
                  <a href="#request" onClick={() => setLevel(l.key)} aria-label={`${YOUR_TURN.request}: ${l.name}`}>
                    {YOUR_TURN.request}
                  </a>
                </Button>
              ) : (
                <Button asChild variant="outline" className="h-10 w-full rounded-lg">
                  <a href="#run">{YOUR_TURN.run}</a>
                </Button>
              )}
            </div>
          </li>
        ))}
      </ul>
      <p className="mt-4 flex max-w-[80ch] items-start gap-2 text-sm leading-relaxed text-secondary">
        <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-dutchOrange" aria-hidden />
        {YOUR_TURN.honest}
      </p>

      <div id="request" className="mt-10 grid scroll-mt-6 grid-cols-1 gap-10 lg:grid-cols-12">
        <div className="lg:col-span-7">
          <h3 id="request-title" className="text-lg font-semibold tracking-tight text-primary" aria-live="polite">{YOUR_TURN.formTitle(levelName)}</h3>
          <p className="mb-6 mt-2 max-w-2xl text-sm leading-relaxed text-secondary">{YOUR_TURN.formLead(levelName)}</p>
          <AccessRequestForm level={level} onLevelChange={setLevel} />
        </div>
        <div className="lg:col-span-5">
          <h3 className="text-lg font-semibold tracking-tight text-primary">{YOUR_TURN.demoTitle}</h3>
          <div className="mt-4 rounded-xl border border-hairline bg-surface p-6">
            <p className="text-sm leading-relaxed text-secondary">{DEMO_NOTE}</p>
            <p className="mt-2 text-sm leading-relaxed text-secondary">
              Sign in as <span className="font-mono text-primary">demo</span> with the password <span className="font-mono text-primary">demo</span>. The account is public and shared: anyone who visits can read and change what is in it, and so can you. Please keep private ideas out of it.
            </p>
            <Button asChild variant="outline" size="lg" className="mt-5 h-11 rounded-lg px-5 text-sm font-semibold">
              <Link href="/sign-in">
                {HERO.secondary} <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
