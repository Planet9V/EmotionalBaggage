// Saves bytes or text as a file through a temporary link. The one download helper for the browser.
export function downloadFile(name: string, data: string | Blob | ArrayBuffer | Uint8Array, type: string) {
  const blob = new Blob([data as BlobPart], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Saves what a `data:` address holds (a canvas or QR library's PNG) as a file, through downloadFile. */
export async function downloadDataUrl(name: string, dataUrl: string) {
  const blob = await (await fetch(dataUrl)).blob();
  downloadFile(name, blob, blob.type || "application/octet-stream");
}
