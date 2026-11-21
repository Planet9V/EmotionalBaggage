// Browser-safe: shown on a print job whose printer has no connection.
/** The steps for a printer with no connection. A generic list; the model list's own steps replace it when that branch is joined. */
export const FILE_ONLY_STEPS = [
  "Download the file below.",
  "Copy it to the printer: a USB stick or SD card, or the maker's own app or web page.",
  "Check the printer shows the same material and nozzle as the slice used.",
  "Start the print at the printer.",
  "Come back and record the result here.",
] as const;
