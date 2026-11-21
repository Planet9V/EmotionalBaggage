"use client";

import { useEffect } from "react";
import { useReactFlow } from "@xyflow/react";
import { FIT_EVENT } from "./printSchematic";

/** Fits the drawing to the canvas when the canvas changes shape for printing, and back after. */
export function useFitOnPrint(padding: number, maxZoom: number) {
  const { fitView } = useReactFlow();
  useEffect(() => {
    const fit = () => void fitView({ padding, maxZoom, duration: 0 });
    window.addEventListener(FIT_EVENT, fit);
    return () => window.removeEventListener(FIT_EVENT, fit);
  }, [fitView, padding, maxZoom]);
}
