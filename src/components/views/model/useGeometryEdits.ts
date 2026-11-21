"use client";

// Editing a part's geometry in the 3D view: saves, the undo and redo of this session (Ctrl+Z, Ctrl+Shift+Z),
// the end of a handle drag, and nudging the selected part with the keyboard.
import { useCallback, useEffect, useRef, useState } from "react";
import type { Part } from "@/lib/domain";
import type { PartGeometry } from "@/components/three/layout";
import { snap } from "@/lib/geometry/rotation";

export function useGeometryEdits({ parts, patch, selectedId }: { parts: Part[]; patch: (id: number, change: { data: { geometry: PartGeometry } }) => Promise<void>; selectedId: number | null }) {
  // Undo for this session: the geometry a part had before each change.
  type Step = { id: number; before: PartGeometry; at: number };
  const undoStack = useRef<Step[]>([]);
  const redoStack = useRef<Step[]>([]);
  const [history, setHistory] = useState({ undo: 0, redo: 0 });

  // A failed save is shown in the error line (writeError) and the part goes back to its saved geometry.
  // The latest parts, for handlers that run later (key repeats, undo).
  const partsRef = useRef(parts);
  useEffect(() => {
    partsRef.current = parts;
  }, [parts]);

  /**
   * Saves a part's geometry and remembers the one it replaced, so Ctrl+Z can bring it back.
   * Changes to the same part within 600 ms (a held arrow key) count as one step.
   */
  const commitGeometry = useCallback(
    (id: number, geometry: PartGeometry, record = true) => {
      const current = partsRef.current.find((x) => x.item.id === id)?.geometry;
      if (record && current) {
        const top = undoStack.current[undoStack.current.length - 1];
        const now = Date.now();
        if (!(top && top.id === id && now - top.at < 600)) undoStack.current.push({ id, before: current, at: now });
        else top.at = now;
        if (undoStack.current.length > 100) undoStack.current.shift();
        redoStack.current = [];
        setHistory({ undo: undoStack.current.length, redo: redoStack.current.length });
      }
      // Later key presses start from this geometry even before the save comes back.
      const before = partsRef.current;
      partsRef.current = before.map((x) => (x.item.id === id ? { ...x, geometry } : x));
      // A failed save is shown in the error line and the part goes back to its saved geometry.
      return patch(id, { data: { geometry } }).catch(() => {
        partsRef.current = before;
      });
    },
    [patch]
  );
  const saveGeometry = useCallback((p: Part, geometry: PartGeometry) => commitGeometry(p.item.id, geometry), [commitGeometry]);

  const undo = useCallback(() => {
    const step = undoStack.current.pop();
    if (!step) return;
    const now = partsRef.current.find((x) => x.item.id === step.id)?.geometry;
    if (now) redoStack.current.push({ id: step.id, before: now, at: 0 });
    setHistory({ undo: undoStack.current.length, redo: redoStack.current.length });
    void commitGeometry(step.id, step.before, false);
  }, [commitGeometry]);
  const redo = useCallback(() => {
    const step = redoStack.current.pop();
    if (!step) return;
    const now = partsRef.current.find((x) => x.item.id === step.id)?.geometry;
    if (now) undoStack.current.push({ id: step.id, before: now, at: 0 });
    setHistory({ undo: undoStack.current.length, redo: redoStack.current.length });
    void commitGeometry(step.id, step.before, false);
  }, [commitGeometry]);

  /** A drag of a handle ended: the canvas has snapped the numbers; save them. */
  const onTransform = useCallback(
    (id: number, change: { pos: [number, number, number]; rotation: [number, number, number] }) => {
      const g = partsRef.current.find((x) => x.item.id === id)?.geometry;
      if (!g) return;
      const next: PartGeometry = { ...g, pos: [...change.pos] };
      if (change.rotation.some((a) => a !== 0)) next.rotation = [...change.rotation];
      else delete next.rotation;
      void commitGeometry(id, next);
    },
    [commitGeometry]
  );

  // Ctrl+Z and Ctrl+Shift+Z, unless the user is typing in a field.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== "z") return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable)) return;
      e.preventDefault();
      if (e.shiftKey) redo();
      else undo();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo]);

  /** Arrow keys nudge the selected part: 1 mm (10 mm with Shift); Page Up and Down move it up and down; R turns it 15 degrees about y. */
  const onCanvasKey = (e: React.KeyboardEvent) => {
    if (e.target !== e.currentTarget || selectedId === null) return;
    const p = partsRef.current.find((x) => x.item.id === selectedId);
    const g = p?.geometry;
    if (!g) return;
    const step = e.shiftKey ? 10 : 1;
    const d: [number, number, number] = [0, 0, 0];
    let turn = 0;
    switch (e.key) {
      case "ArrowLeft": d[0] = -step; break;
      case "ArrowRight": d[0] = step; break;
      case "ArrowUp": d[2] = -step; break;
      case "ArrowDown": d[2] = step; break;
      case "PageUp": d[1] = step; break;
      case "PageDown": d[1] = -step; break;
      case "r": case "R": turn = e.shiftKey ? -15 : 15; break;
      default: return;
    }
    e.preventDefault();
    if (g.shape === "shell" && turn) return;
    const next: PartGeometry = { ...g, pos: g.pos.map((v, i) => snap(v + d[i], 0.001)) };
    if (turn) {
      const r = g.rotation ?? [0, 0, 0];
      const y = snap(((((r[1] + turn + 180) % 360) + 360) % 360) - 180, 15);
      next.rotation = [r[0], y, r[2]];
      if (next.rotation.every((a) => a === 0)) delete next.rotation;
    }
    void commitGeometry(selectedId, next);
  };

  return { partsRef, commitGeometry, saveGeometry, undo, redo, onTransform, onCanvasKey, history };
}
