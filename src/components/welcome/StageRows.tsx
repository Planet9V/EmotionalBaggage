// The example's own seeded rows for the journey's Research, Marketing and Sales stages, set out as the app lists
// them: a frame with the section's address, then the rows with their status. Plain markup at the full width of
// the column; nothing here is a screenshot and nothing is invented. Where the example holds almost nothing (its
// listing is not started) the panel says so in the row's own words.
import type { ReactNode } from "react";
import { TONE_CLASS, approvalStatusTone } from "@/lib/statusTones";
import type { Item } from "@/lib/types";
import type { UnitCost } from "@/lib/economics/compute";
import { BuildUpTable } from "@/components/economics/BuildUpTable";
import { ROWS } from "./content";

export type JourneyRows = { claims: Item[]; positioning: Item[]; ads: Item[]; listing: Item[]; channels: Item[] };

const str = (v: unknown) => (typeof v === "string" ? v : "");

function Status({ value }: { value: string }) {
  return <span className={`inline-flex h-5 shrink-0 items-center whitespace-nowrap rounded-full px-2 font-mono text-[11px] ${TONE_CLASS[approvalStatusTone(value)]}`}>{value}</span>;
}

export function RowsPanel({ path, count, children }: { path: string; count: string; children: ReactNode }) {
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
    <RowsPanel path="/s/research/claims" count={ROWS.claims.count(rows.length, open)}>
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
    </RowsPanel>
  );
}

function Marketing({ positioning, ads }: { positioning: Item[]; ads: Item[] }) {
  return (
    <div className="grid gap-4">
      <RowsPanel path="/s/marketing/positioning" count={ROWS.positioning.count(positioning.length)}>
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
      </RowsPanel>
      <RowsPanel path="/s/marketing/ads" count={ROWS.ads.count(ads.length)}>
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
      </RowsPanel>
    </div>
  );
}

function Sales({ listing, channels }: { listing: Item[]; channels: Item[] }) {
  return (
    <div className="grid gap-4">
      <RowsPanel path="/s/sales/listing" count={ROWS.listing.count(listing.length)}>
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
      </RowsPanel>
      <RowsPanel path="/s/sales/channels" count={ROWS.channels.count(channels.length)}>
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
      </RowsPanel>
    </div>
  );
}

/** The unit cost, line by line, drawn by the app's own build-up table from the app's own calculation. */
export function UnitCostPanel({ unit }: { unit: UnitCost }) {
  return (
    <RowsPanel path="/s/production/economics" count={ROWS.unit.count(unit.lines.length, unit.batchSize)}>
      <div className="overflow-x-auto">
        <BuildUpTable unit={unit} readOnly />
      </div>
      <p className="border-t border-hairline bg-subtle px-3.5 py-2.5 text-[13px] leading-relaxed text-secondary">{ROWS.unit.honest}</p>
    </RowsPanel>
  );
}

/** The decisions as a plain list, in the box the live decision tree takes over: before it loads, and without script. */
export function DecisionsStill({ rows }: { rows: Item[] }) {
  return (
    <>
      <ul className="h-[440px] overflow-y-auto" tabIndex={0} aria-label={ROWS.decisions.still}>
        {rows.map((r) => (
          <li key={r.id} className="flex items-start gap-3 border-b border-hairline px-3.5 py-3 last:border-0">
            <p className="min-w-0 flex-1 text-sm font-medium leading-snug text-primary">{str(r.data.question) || r.title}</p>
            <Status value={str(r.data.chosen) ? "decided" : r.status} />
          </li>
        ))}
      </ul>
      <p className="flex min-h-[5.5rem] items-center sm:min-h-[3.75rem] border-t border-hairline bg-subtle px-3.5 py-2.5 text-[13px] leading-relaxed text-secondary">{ROWS.decisions.still}</p>
    </>
  );
}

/** The rows panel of a stage, or null for a stage that shows something else. */
export function stageRows(key: string, rows: JourneyRows): ReactNode {
  if (key === "research") return <Claims rows={rows.claims} />;
  if (key === "marketing") return <Marketing positioning={rows.positioning} ads={rows.ads} />;
  if (key === "sales") return <Sales listing={rows.listing} channels={rows.channels} />;
  return null;
}
