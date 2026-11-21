// Browser-safe. The one sentence that says the slicer is not set up: the /api/slicer answer and the printing
// page show it word for word. Written for the person who runs the install.
export const SLICER_NOT_SET_UP =
  "No slicer service is set up on this install. To add one, start it with `docker compose --profile slicer up -d --build` and save its address (http://slicer:8000) in Admin, Printers; the SLICER_URL environment variable is the fallback. Until then, print jobs can still be queued: download the model from the job, slice it in your own slicer, and attach the sliced file to the job.";

/** The steps for a job with no slicer here: the model leaves the app and the sliced file comes back. */
export const OWN_SLICER_STEPS = [
  "Download the STL or 3MF below.",
  "Slice it in your own slicer (OrcaSlicer, PrusaSlicer, Bambu Studio, Cura) with the printer, material and settings on this job.",
  "Attach the sliced G-code or .3mf here, with the print time and filament grams your slicer reports.",
  "Then send it to a connected printer from here, or download it and take it to a printer with no connection.",
] as const;

/** Slicers people name when they attach a file sliced elsewhere. Free text is accepted too. */
export const OWN_SLICERS = ["OrcaSlicer", "PrusaSlicer", "Bambu Studio", "UltiMaker Cura", "SuperSlicer", "Simplify3D"] as const;

/** Materials and layer heights offered when no slicer profile limits them. */
export const COMMON_MATERIALS = ["PLA", "PETG", "ABS", "ASA", "TPU", "PA"] as const;
export const COMMON_LAYERS = [0.08, 0.12, 0.16, 0.2, 0.24, 0.28, 0.32] as const;
