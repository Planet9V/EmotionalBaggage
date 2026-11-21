// Creates the adapter for a printer family. Kept apart from index.ts so actions.ts can use it without a circular import.
import type { PrinterRow } from "@/lib/admin/printers";
import { valuesOf } from "@/lib/admin/printers";
import { printerFamily } from "@/lib/admin/printerFamilies";
import { PrinterError, type AdapterOptions, type PrinterAdapter, type PrinterValues } from "./adapter";
import { BambuAdapter, type BambuOptions } from "./bambu";
import { DuetAdapter } from "./duet";
import { FileOnlyAdapter } from "./fileOnly";
import { MoonrakerAdapter } from "./moonraker";
import { OctoPrintAdapter } from "./octoprint";
import { PrusaLinkAdapter } from "./prusalink";

/** The adapter for a family and its field values (address included). Throws PrinterError when the family has none. */
export function createAdapter(family: string, values: PrinterValues, options: AdapterOptions & Partial<BambuOptions> = {}): PrinterAdapter {
  switch (family) {
    case "octoprint":
      return new OctoPrintAdapter(values, options);
    case "moonraker":
      return new MoonrakerAdapter(values, options);
    case "creality":
    case "elegoo":
      // No maker documentation for these; Moonraker is where the Klipper machines among them answer. Experimental.
      return new MoonrakerAdapter(values, { ...options, experimental: true, family });
    case "prusalink":
      return new PrusaLinkAdapter(values, options);
    case "duet":
      return new DuetAdapter(values, options);
    case "bambu":
      return new BambuAdapter(values, options);
    case "file-only":
      return new FileOnlyAdapter();
    default:
      throw new PrinterError("unsupported", `There is no connection for the printer family "${family}".`);
  }
}

/** The adapter for a printer saved in Admin. */
export function adapterForRow(row: Pick<PrinterRow, "family" | "address" | "access">, options: AdapterOptions & Partial<BambuOptions> = {}): PrinterAdapter {
  if (!printerFamily(row.family)) throw new PrinterError("unsupported", `There is no connection for the printer family "${row.family}".`);
  return createAdapter(row.family, valuesOf(row), options);
}
