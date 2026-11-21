"use client";

import { useMemo, useState } from "react";
import { Calendar } from "@/components/ui/calendar";
import { dayNumber, formatDay, inclusiveDays, todayUtc } from "@/lib/campaigns/days";
import { dueDate, type LaunchRow, type StepRow } from "@/lib/campaigns/launch";
import type { Campaign } from "@/lib/campaigns/read";

const local = (day: string) => {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(y, m - 1, d);
};
const keyOf = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

type Entry = { day: string; kind: "start" | "end" | "launch" | "due"; text: string };

/**
 * The calendar: the days each campaign runs, each launch date and the day each launch step is due,
 * read from the same rows as the board and the launch plan. Under it, the same dates as a list for the
 * chosen month, which is what a keyboard or screen-reader user reads.
 */
export function CampaignCalendar({ campaigns, launches, steps }: { campaigns: Campaign[]; launches: LaunchRow[]; steps: StepRow[] }) {
  const [month, setMonth] = useState(() => local(todayUtc()));
  const [picked, setPicked] = useState<Date | undefined>();

  const { entries, running } = useMemo(() => {
    const entries: Entry[] = [];
    const running: Date[] = [];
    for (const c of campaigns) {
      if (c.status === "killed") continue;
      if (c.startDate) entries.push({ day: c.startDate, kind: "start", text: `${c.title} starts` });
      if (c.endDate) entries.push({ day: c.endDate, kind: "end", text: `${c.title} ends` });
      if (c.startDate && c.endDate) {
        const n = inclusiveDays(c.startDate, c.endDate);
        const s = dayNumber(c.startDate);
        if (n !== null && s !== null && n <= 800) for (let i = 0; i < n; i++) running.push(local(new Date((s + i) * 86_400_000).toISOString().slice(0, 10)));
      }
    }
    for (const l of launches) {
      if (l.launchDate) entries.push({ day: l.launchDate, kind: "launch", text: `Launch day: ${l.title}` });
      for (const s of steps.filter((x) => x.launch === l.launchKey && x.status !== "done")) {
        const due = dueDate(l.launchDate, s.daysBefore);
        if (due) entries.push({ day: due, kind: "due", text: `Step due: ${s.title}` });
      }
    }
    return { entries: entries.sort((a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : 0)), running };
  }, [campaigns, launches, steps]);

  const days = (kind: Entry["kind"][]) => entries.filter((e) => kind.includes(e.kind)).map((e) => local(e.day));
  const monthKeyStr = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, "0")}`;
  const inMonth = entries.filter((e) => e.day.startsWith(monthKeyStr));
  const onPicked = picked ? entries.filter((e) => e.day === keyOf(picked)) : [];

  return (
    <div className="grid gap-4 lg:grid-cols-[auto_1fr]">
      <div className="rounded-xl border border-hairline bg-surface">
        <Calendar
          mode="single"
          selected={picked}
          onSelect={setPicked}
          month={month}
          onMonthChange={setMonth}
          modifiers={{ running, launch: days(["launch"]), due: days(["due"]) }}
          modifiersClassNames={{
            running: "bg-info-soft",
            launch: "ring-2 ring-dutchOrange ring-inset font-semibold",
            due: "underline decoration-dutchOrange decoration-2 underline-offset-4",
          }}
        />
        <p className="border-t border-hairline px-3 py-2 text-xs text-secondary">Shaded: a campaign runs. Ringed: a launch day. Underlined: a launch step is due.</p>
      </div>
      <div className="min-w-0 space-y-3">
        {picked && (
          <div aria-live="polite">
            <h3 className="text-sm font-semibold text-primary">{formatDay(keyOf(picked))}</h3>
            {onPicked.length === 0 ? <p className="text-sm text-secondary">Nothing is planned on this day.</p> : <ul className="list-disc pl-5 text-sm text-primary">{onPicked.map((e, i) => <li key={i}>{e.text}</li>)}</ul>}
          </div>
        )}
        <div>
          <h3 className="text-sm font-semibold text-primary">{new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric" }).format(month)}</h3>
          {inMonth.length === 0 ? (
            <p className="text-sm text-secondary">No campaign dates or launch steps fall in this month.</p>
          ) : (
            <ul className="mt-1 space-y-0.5 text-sm text-primary">
              {inMonth.map((e, i) => <li key={i}><span className="font-mono text-xs text-secondary">{formatDay(e.day)}</span> {e.text}</li>)}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
