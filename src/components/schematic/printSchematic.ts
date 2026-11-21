/**
 * Prints the schematic sheet. The schematic print rules (print.css) apply only while
 * `html.printing-schematic` is set, so every other page prints as itself. The class goes on, the
 * canvas takes the paper's shape and is fitted to it (FIT_EVENT), the print dialog opens, and the
 * class comes off when the browser says printing is over (`afterprint`).
 */
const PRINT_CLASS = "printing-schematic";
export const FIT_EVENT = "schematic:fit";

const frame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));
const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function endSchematicPrint() {
  document.documentElement.classList.remove(PRINT_CLASS);
  window.dispatchEvent(new Event(FIT_EVENT));
}

export async function printSchematic() {
  const html = document.documentElement;
  html.classList.add(PRINT_CLASS);
  window.addEventListener("afterprint", endSchematicPrint, { once: true });
  await frame();
  await frame();
  window.dispatchEvent(new Event(FIT_EVENT));
  // React Flow measures the new size and applies the fit on the next frames.
  await wait(150);
  await frame();
  window.print();
}
