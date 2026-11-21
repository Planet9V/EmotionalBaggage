"use client";

import { useMemo, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import type { EventDropArg, EventInput } from "@fullcalendar/core";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ErrorLine } from "@/components/parts/controls";
import { socialChannel, checkSocial } from "@/lib/content/channels";
import type { Item } from "@/lib/types";
import { StatusPill } from "./shared";

type Change = { status?: string; data?: Record<string, unknown> };
const sched = (i: Item) => (typeof i.data.scheduledAt === "string" ? i.data.scheduledAt : "");
const label = (i: Item) => socialChannel(String(i.data.channel ?? ""))?.label ?? String(i.data.channel ?? "other");
const first = (t: string) => (t.trim().split("\n")[0] || "(empty)").slice(0, 50);
/** FullCalendar hands back a Date in the browser's zone; the row stores the local wall time as the user sees it. */
const stamp = (d: Date, allDay: boolean) => {
  const p = (n: number) => String(n).padStart(2, "0");
  const day = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  return allDay ? day : `${day}T${p(d.getHours())}:${p(d.getMinutes())}`;
};

export function SocialCalendar({ items, onPatch }: { items: Item[]; onPatch: (id: number, c: Change) => Promise<unknown> }) {
  const [err, setErr] = useState("");
  const [dates, setDates] = useState<Record<number, string>>({});
  const live = items.filter((i) => i.status !== "posted");
  const events = useMemo<EventInput[]>(
    () =>
      items
        .filter((i) => sched(i))
        .map((i) => ({
          id: String(i.id),
          title: `${label(i)}: ${first(i.body || i.title)}`,
          start: sched(i),
          allDay: !sched(i).includes("T"),
          editable: i.status !== "posted",
          classNames: [`c2r-ev-${i.status}`],
        })),
    [items],
  );
  // Open on the next dated post (or the latest one), so a plan for next month is not hidden behind today.
  const initialDate = useMemo(() => {
    const dates = items.map(sched).filter(Boolean).map((d) => d.slice(0, 10)).sort();
    const today = stamp(new Date(), true);
    return dates.find((d) => d >= today) ?? dates[dates.length - 1] ?? undefined;
  }, [items]);
  const unscheduled = live.filter((i) => !sched(i));
  const set = async (i: Item, when: string) => {
    setErr("");
    try {
      // An approved post that gets a date becomes scheduled; a draft only holds the date until it is approved.
      await onPatch(i.id, { data: { scheduledAt: when }, ...(i.status === "approved" ? { status: "scheduled" } : {}) });
    } catch (e) {
      setErr((e as Error).message);
    }
  };
  const drop = async (a: EventDropArg) => {
    const it = items.find((x) => String(x.id) === a.event.id);
    if (!it || !a.event.start) return a.revert();
    try {
      await set(it, stamp(a.event.start, a.event.allDay));
    } catch {
      a.revert();
    }
  };

  return (
    <div className="space-y-4">
      {err && <ErrorLine>{err}</ErrorLine>}
      <style>{`
        .c2r-cal{--fc-border-color:var(--color-hairline,#d4d4d8);--fc-page-bg-color:transparent;--fc-neutral-bg-color:var(--color-subtle,#f4f4f5);--fc-today-bg-color:color-mix(in srgb,var(--color-link,#2563eb) 10%,transparent);--fc-event-bg-color:var(--color-link,#2563eb);--fc-event-border-color:var(--color-link,#2563eb);--fc-event-text-color:var(--color-on-link,#fff);--fc-list-event-hover-bg-color:var(--color-subtle,#f4f4f5);color:var(--color-primary,inherit);font-size:13px}
        .c2r-cal .fc-button{background:var(--color-surface,#fff);color:var(--color-primary,#111);border:1px solid var(--color-hairline,#d4d4d8);text-transform:capitalize}
        .c2r-cal .fc-button-primary:not(:disabled).fc-button-active,.c2r-cal .fc-button-primary:not(:disabled):active{background:var(--color-link,#2563eb);color:var(--color-on-link,#fff)}
        .c2r-cal .fc-button:focus-visible{outline:2px solid var(--color-link,#2563eb);outline-offset:2px;box-shadow:none}
        .c2r-cal .fc-event{cursor:grab;padding:1px 3px}
        .c2r-cal .c2r-ev-draft{--fc-event-bg-color:var(--color-muted,#52525b);--fc-event-border-color:var(--color-muted,#52525b)}
        .c2r-cal .c2r-ev-posted{opacity:.6}
        .c2r-cal a{color:inherit}
      `}</style>
      <div className="c2r-cal rounded-xl border border-hairline bg-surface p-3">
        <FullCalendar
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
          initialView="dayGridMonth"
          initialDate={initialDate}
          scrollTime="08:00:00"
          slotMinTime="06:00:00"
          slotMaxTime="23:00:00"
          headerToolbar={{ left: "prev,next today", center: "title", right: "dayGridMonth,timeGridWeek" }}
          buttonText={{ today: "Today", month: "Month", week: "Week" }}
          events={events}
          editable
          eventDrop={(a) => void drop(a)}
          firstDay={1}
          height="auto"
          dayMaxEvents={4}
          allDayText="All day"
          eventTimeFormat={{ hour: "2-digit", minute: "2-digit", hour12: false }}
        />
      </div>

      <section aria-label="Posts without a date" className="rounded-xl border border-hairline bg-surface p-4">
        <h3 className="text-sm font-semibold text-primary">Not on the calendar yet ({unscheduled.length})</h3>
        <p className="text-xs text-muted">Pick a date and time, or drag a dated post on the calendar. An approved post becomes scheduled when it gets a date.</p>
        {unscheduled.length === 0 ? (
          <p className="mt-2 text-sm text-secondary">Every post has a date.</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {unscheduled.map((i) => {
              const ch = socialChannel(String(i.data.channel ?? ""));
              const problems = ch ? checkSocial(ch, i.body, String(i.data.postTitle ?? "")) : [];
              return (
                <li key={i.id} className="flex flex-wrap items-center gap-2 text-sm">
                  <StatusPill status={i.status} />
                  <span className="font-mono text-[10px] uppercase tracking-wider text-muted">{label(i)}</span>
                  <span className="min-w-[10rem] flex-1 truncate text-primary">{first(i.body || i.title)}</span>
                  {problems.some((p) => p.level === "refuse") && <span className="text-xs text-danger">Over the limit</span>}
                  <Input aria-label={`Date and time for ${first(i.body || i.title)}`} type="datetime-local" className="h-8 w-52" value={dates[i.id] ?? ""} onChange={(e) => setDates((d) => ({ ...d, [i.id]: e.target.value }))} />
                  <Button size="sm" variant="outline" disabled={!dates[i.id]} onClick={() => void set(i, dates[i.id])}>Set date</Button>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
