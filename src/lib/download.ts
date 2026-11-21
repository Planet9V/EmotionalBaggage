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
