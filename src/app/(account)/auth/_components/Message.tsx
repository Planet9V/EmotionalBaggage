"use client";

import { useEffect, useRef } from "react";

/**
 * The one message line of a form: an error (role="alert") or a confirmation (role="status"). It takes the focus as
 * soon as it appears, so keyboard and screen-reader users land on it (as the sign-in page does).
 */
export function Message({ id, error, done }: { id: string; error?: string; done?: string }) {
  const ref = useRef<HTMLParagraphElement>(null);
  const text = error || done;
  useEffect(() => {
    if (text) ref.current?.focus();
  }, [text]);
  if (!text) return null;
  return (
    <p
      id={id}
      ref={ref}
      tabIndex={-1}
      role={error ? "alert" : "status"}
      className={`rounded-md px-3 py-2 text-sm focus:outline-hidden focus-visible:ring-2 focus-visible:ring-dutchOrange ${error ? "bg-danger-soft text-danger" : "bg-success-soft text-success"}`}
    >
      {text}
    </p>
  );
}
