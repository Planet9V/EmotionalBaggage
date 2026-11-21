"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Button } from "@/components/ui/button";

/**
 * A QR code for an address, drawn with the `qrcode` library (npm "qrcode", node-qrcode). Made in the
 * browser; the address is not sent anywhere. Downloadable as SVG (print) or PNG.
 */
export function QrCode({ value, label }: { value: string; label: string }) {
  const [svg, setSvg] = useState("");
  const [err, setErr] = useState("");
  useEffect(() => {
    let live = true;
    QRCode.toString(value, { type: "svg", margin: 2, errorCorrectionLevel: "M", color: { dark: "#000000", light: "#ffffff" } })
      .then((s) => live && setSvg(s))
      .catch((e: Error) => live && setErr(e.message));
    return () => { live = false; };
  }, [value]);
  const save = (href: string, name: string) => {
    const a = document.createElement("a");
    a.href = href;
    a.download = name;
    a.click();
  };
  const png = async () => save(await QRCode.toDataURL(value, { margin: 2, width: 1024, errorCorrectionLevel: "M" }), `${label}.png`);
  if (err) return <p role="alert" className="text-sm text-danger">The QR code could not be made: {err}</p>;
  return (
    <div className="space-y-2">
      <div role="img" aria-label={`QR code for ${value}`} className="h-40 w-40 rounded-md bg-white p-1 [&>svg]:h-full [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: svg }} />
      <div className="flex gap-2">
        <Button size="sm" variant="outline" disabled={!svg} onClick={() => save(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`, `${label}.svg`)}>Download SVG</Button>
        <Button size="sm" variant="outline" disabled={!svg} onClick={() => void png()}>Download PNG</Button>
      </div>
    </div>
  );
}
