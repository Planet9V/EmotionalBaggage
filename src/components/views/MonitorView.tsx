"use client";

import type { ViewProps } from "./types";

export function MonitorView({ section }: ViewProps) {
  return <p className="text-sm text-secondary">{section.label} is being built.</p>;
}
