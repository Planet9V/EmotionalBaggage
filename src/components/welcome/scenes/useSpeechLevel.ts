"use client";

// A small hook for the animation: the level (0 to 1) of the voice being heard right now, and whose cue it is. It
// follows the audio element's own clock, frame by frame, and re-renders only when the level moves by a sixteenth.
// Inside a render loop (a useFrame), call currentSpeech() or speechLevelAt() from ./voiceTrack directly instead.
import { useEffect, useState } from "react";
import { currentSpeech } from "./voiceTrack";

const STEPS = 16;

export function useSpeechLevel(): { cue: string; level: number } {
  const [now, setNow] = useState({ cue: "", level: 0 });
  useEffect(() => {
    let raf = 0;
    const step = () => {
      const s = currentSpeech();
      const level = Math.round(s.level * STEPS) / STEPS;
      setNow((was) => (was.cue === s.cue && was.level === level ? was : { cue: s.cue, level }));
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, []);
  return now;
}
