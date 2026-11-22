// The example's own seeded rows for the journey's Research, Marketing and Sales stages, set out as the app lists
// them: a frame with the section's address, then the rows with their status. Plain markup at the full width of
// the column; nothing here is a screenshot and nothing is invented. Where the example holds almost nothing (its
// listing is not started) the panel says so in the row's own words.
import type { ReactNode } from "react";
import type { Item } from "@/lib/types";
import { ROWS } from "./content";

export type JourneyRows = { claims: Item[]; positioning: Item[]; ads: Item[]; listing: Item[]; channels: Item[] };

const str = (v: unknown) => (typeof v === "string" ? v : "");
const TONE: Record<string, string> = {
  unverified: "bg-warning-soft text-warning",
  draft: "bg-warning-soft text-warning",
  planned: "bg-info-soft text-info",
  done: "bg-success-soft text-success",
};

function Status({ value }: { value: string }) {
  return <span className={`inline-flex h-5 shrink-0 items-center whitespace-nowrap rounded-full px-2 font-mono text-[11px] ${TONE[value] ?? "bg-subtle text-secondary"}`}>{value}</span>;
}

function Panel({ path, count, children }: { path: string; count: string; children: ReactNode }) {
  return (
    <div className="overflow-hidden rounded-xl border border-hairline bg-surface shadow-[var(--shadow-card)]">
      <div className="flex h-8 items-center justify-between gap-3 border-b border-hairline bg-subtle px-3.5">
        <span className="truncate font-mono text-[11px] text-muted">{path}</span>
        <span className="shrink-0 font-mono text-[11px] text-muted">{count}</span>
      </div>
      {children}
    </div>
  );
}

const HEAD = "px-3.5 py-2 text-left font-mono text-[11px] font-normal text-muted";
const CELL = "px-3.5 py-2.5 align-top text-[13px] leading-snug";

function Claims({ rows }: { rows: Item[] }) {
  const open = rows.filter((r) => r.status !== "verified").length;
  return (
    <Panel path="/s/research/claims" count={ROWS.claims.count(rows.length, open)}>
      <table className="w-full border-collapse">
        <caption className="sr-only">{ROWS.claims.caption}</caption>
        <thead>
          <tr className="border-b border-hairline">
            <th scope="col" className={HEAD}>Claim</th>
            <th scope="col" className={`${HEAD} hidden sm:table-cell`}>Source</th>
            <th scope="col" className={HEAD}>Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-b border-hairline last:border-0">
              <th scope="row" className={`${CELL} text-left font-medium text-primary`}>
                {r.title}
                {r.body ? <span className="mt-0.5 block font-normal text-secondary">{r.body}</span> : null}
              </th>
              <td className={`${CELL} hidden text-secondary sm:table-cell`}>{str(r.data.source)}</td>
              <td className={CELL}><Status value={r.status} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </Panel>
  );
}

function Marketing({ positioning, ads }: { positioning: Item[]; ads: Item[] }) {
  return (
    <div className="grid gap-4">
      <Panel path="/s/marketing/positioning" count={ROWS.positioning.count(positioning.length)}>
        <ul>
          {positioning.map((r) => (
            <li key={r.id} className="flex items-start gap-3 border-b border-hairline px-3.5 py-3 last:border-0">
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-semibold text-primary">{r.title}</p>
                <p className="mt-0.5 text-sm leading-relaxed text-secondary">{r.body}</p>
              </div>
              <Status value={r.status} />
            </li>
          ))}
        </ul>
      </Panel>
      <Panel path="/s/marketing/ads" count={ROWS.ads.count(ads.length)}>
        <ul>
          {ads.map((r) => (
            <li key={r.id} className="flex items-start gap-3 border-b border-hairline px-3.5 py-3 last:border-0">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium leading-snug text-primary">&ldquo;{r.title}&rdquo;</p>
                <p className="mt-1 font-mono text-[11px] text-muted">
                  {str(r.data.channel)}
                  {str(r.data.rule) ? `, ${str(r.data.rule)}` : ""}
                </p>
              </div>
              <Status value={r.status} />
            </li>
          ))}
        </ul>
        {ads[0]?.body ? <p className="border-t border-hairline bg-subtle px-3.5 py-2.5 text-[13px] leading-relaxed text-secondary">{ads[0].body}</p> : null}
      </Panel>
    </div>
  );
}

function Sales({ listing, channels }: { listing: Item[]; channels: Item[] }) {
  return (
    <div className="grid gap-4">
      <Panel path="/s/sales/listing" count={ROWS.listing.count(listing.length)}>
        {listing.map((r) => (
          <div key={r.id} className="flex items-start gap-3 px-3.5 py-3">
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-semibold text-primary">{r.title}</p>
              <p className="mt-0.5 text-sm leading-relaxed text-secondary">{r.body}</p>
            </div>
            <Status value={r.status} />
          </div>
        ))}
        <p className="border-t border-hairline bg-subtle px-3.5 py-2.5 text-[13px] leading-relaxed text-secondary">{ROWS.listing.honest}</p>
      </Panel>
      <Panel path="/s/sales/channels" count={ROWS.channels.count(channels.length)}>
        <table className="w-full border-collapse">
          <caption className="sr-only">{ROWS.channels.caption}</caption>
          <thead>
            <tr className="border-b border-hairline">
              <th scope="col" className={HEAD}>Channel</th>
              <th scope="col" className={`${HEAD} text-right`}>Price</th>
              <th scope="col" className={`${HEAD} hidden sm:table-cell`}>Their take</th>
              <th scope="col" className={`${HEAD} text-right`}>Net</th>
              <th scope="col" className={HEAD}>Status</th>
            </tr>
          </thead>
          <tbody>
            {channels.map((r) => (
              <tr key={r.id} className="border-b border-hairline last:border-0">
                <th scope="row" className={`${CELL} text-left font-medium text-primary`}>{r.title}</th>
                <td className={`${CELL} text-right font-mono tabular-nums text-primary`}>{str(r.data.price)}</td>
                <td className={`${CELL} hidden text-secondary sm:table-cell`}>{str(r.data.take)}</td>
                <td className={`${CELL} text-right font-mono tabular-nums text-primary`}>{str(r.data.net)}</td>
                <td className={CELL}><Status value={r.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="border-t border-hairline bg-subtle px-3.5 py-2.5 text-[13px] leading-relaxed text-secondary">{ROWS.channels.honest}</p>
      </Panel>
    </div>
  );
}

/** The rows panel of a stage, or null for a stage that shows something else. */
export function stageRows(key: string, rows: JourneyRows): ReactNode {
  if (key === "research") return <Claims rows={rows.claims} />;
  if (key === "marketing") return <Marketing positioning={rows.positioning} ads={rows.ads} />;
  if (key === "sales") return <Sales listing={rows.listing} channels={rows.channels} />;
  return null;
}
