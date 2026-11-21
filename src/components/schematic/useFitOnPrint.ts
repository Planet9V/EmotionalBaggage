"use client";

import { useEffect } from "react";
import { useReactFlow } from "@xyflow/react";
import { FIT_EVENT } from "./printSchematic";

/** Fits the whole drawing to the canvas when the canvas changes shape for printing, and back after. */
export function useFitOnPrint() {
  const { fitView } = useReactFlow();
  useEffect(() => {
    const fit = () => void fitView({ padding: 0.04, maxZoom: 1.2, minZoom: 0.05, duration: 0 });
    window.addEventListener(FIT_EVENT, fit);
    return () => window.removeEventListener(FIT_EVENT, fit);
  }, [fitView]);
}
