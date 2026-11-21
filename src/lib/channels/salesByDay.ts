// Safe for the browser: sales monitor rows as units and revenue per day and channel. Every number is a
// sum of rows; nothing is estimated. Cancelled Amazon orders are rows with 0 units and 0 revenue.
export type SaleRow = { date: string; channel: string; units: number; revenue: number; currency: string };
export type DayChannel = { day: string; channel: string; units: number; revenue: number; rows: number };

const n = (v: unknown) => (typeof v === "number" ? v : Number.parseFloat(String(v ?? "")) || 0);

export function toSaleRow(data: Record<string, unknown>): SaleRow {
  return {
    date: typeof data.date === "string" ? data.date : "",
    channel: (typeof data.channel === "string" && data.channel.trim()) || "(no channel)",
    units: n(data.units),
    revenue: n(data.revenue),
    currency: typeof data.currency === "string" ? data.currency : "",
  };
}

export function byDayAndChannel(rows: SaleRow[]): { days: string[]; channels: string[]; cells: DayChannel[]; currencies: Record<string, string[]> } {
  const map = new Map<string, DayChannel>();
  const currencies: Record<string, Set<string>> = {};
  for (const r of rows) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(r.date)) continue;
    const k = `${r.date}\u0000${r.channel}`;
    const c = map.get(k) ?? { day: r.date, channel: r.channel, units: 0, revenue: 0, rows: 0 };
    c.units += r.units;
    c.revenue = Math.round((c.revenue + r.revenue) * 100) / 100;
    c.rows++;
    map.set(k, c);
    if (r.currency) (currencies[r.channel] ??= new Set()).add(r.currency);
  }
  const cells = [...map.values()].sort((a, b) => a.day.localeCompare(b.day) || a.channel.localeCompare(b.channel));
  return {
    days: [...new Set(cells.map((c) => c.day))],
    channels: [...new Set(cells.map((c) => c.channel))].sort(),
    cells,
    currencies: Object.fromEntries(Object.entries(currencies).map(([k, v]) => [k, [...v]])),
  };
}
