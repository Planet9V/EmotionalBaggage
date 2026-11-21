import type { PrinterState } from "@/lib/printers/adapter";
import type { StatusTone } from "@/lib/statusTones";
import type { AdapterKind, PrinterModel } from "@/lib/printers/models";

export const STATE_LABEL: Record<PrinterState, string> = {
  idle: "Ready", printing: "Printing", paused: "Paused", finished: "Finished", error: "Needs attention", busy: "Busy", unknown: "State not recognised",
};
export const STATE_TONE: Record<PrinterState, StatusTone> = {
  idle: "neutral", printing: "info", paused: "warning", finished: "success", error: "danger", busy: "warning", unknown: "neutral",
};

/** "45 min", "1 h 5 min". */
export const minutesText = (seconds: number) => {
  const m = Math.max(1, Math.round(seconds / 60));
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${m % 60} min`;
};

/** "215 °C" or "214.9 of 215 °C"; the target is left out when the heater is off. */
export const tempText = (t?: { actual: number; target: number | null }) => {
  if (!t) return null;
  const a = Math.round(t.actual * 10) / 10;
  return t.target ? `${a} of ${Math.round(t.target)} °C` : `${a} °C, heater off`;
};


export const ADAPTER_LABEL: Record<AdapterKind, string> = {
  bambu: "Bambu LAN (MQTT and FTPS)",
  prusalink: "PrusaLink",
  moonraker: "Moonraker (Klipper)",
  octoprint: "OctoPrint",
  duet: "Duet (RepRapFirmware)",
  "file-only": "File only",
};

export const CONFIRMED_TEXT: Record<PrinterModel["confirmed"], string> = {
  model: "The source page names this model.",
  series: "The source page names this model's series or firmware family, not this exact model.",
  none: "Not confirmed for this model.",
};

export const volumeText = (v: { x: number; y: number; z: number; note?: string }) => `${v.x} x ${v.y} x ${v.z} mm${v.note ? ` (${v.note})` : ""}`;
export const monthText = (ym: string) => {
  const [y, m] = ym.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en", { month: "long", year: "numeric", timeZone: "UTC" });
};
