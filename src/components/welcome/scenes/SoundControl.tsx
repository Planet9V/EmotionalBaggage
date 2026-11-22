"use client";

// The film's sound control and the introduction's overlay. The film always starts silent (browsers allow sound only
// after the visitor acts, and this page never switches it on for them). Until the control has been used, it is an
// invitation in the bag's own voice, set over the first frame where it cannot be missed; after that it is the small
// switch in the top bar, with a meter that moves with the voice being heard. It is a sound switch, not a pause.
import { useEffect, useState } from "react";
import { Volume2, VolumeX } from "lucide-react";
import { SCENES } from "./scenes";
import { Still } from "./Still";
import { INTRO, INTRO_CUE, SOUND, SPEAKER_NAME, introLineAt } from "./voiceScript";
import { useSpeechLevel } from "./useSpeechLevel";
import { voiceTrack } from "./voiceTrack";

/** Three bars that rise with the voice being heard. */
function Meter() {
  const { level } = useSpeechLevel();
  return (
    <span className="flex h-3 items-end gap-[2px]" aria-hidden="true">
      {[0.55, 1, 0.75].map((gain, i) => (
        <span key={i} className="w-[3px] rounded-[1px] bg-dutchOrange" style={{ height: `${Math.round(18 + 82 * Math.min(1, level * gain * 1.2))}%` }} />
      ))}
    </span>
  );
}

export function SoundControl({ sound, asked, empty, onToggle, onIntent }: { sound: boolean; asked: boolean; empty: boolean; onToggle: () => void; onIntent: () => void }) {
  if (!asked && !sound) {
    return (
      <div className="pointer-events-none absolute inset-x-0 top-[11%] z-10 flex justify-center px-3">
        <button
          type="button"
          aria-pressed={false}
          onClick={onToggle}
          onPointerEnter={onIntent}
          onFocus={onIntent}
          data-testid="sound-invite"
          className="sc-invite pointer-events-auto inline-flex min-h-11 items-center gap-2.5 rounded-full bg-dutchOrange px-4 py-2 text-left text-sm font-semibold text-black shadow-lg outline-none ring-2 ring-white/70 hover:brightness-110 focus-visible:ring-4 focus-visible:ring-focus sm:px-5 sm:text-base"
        >
          <Volume2 className="h-5 w-5 shrink-0" aria-hidden />
          <span>
            <span className="sr-only">{SOUND.on}: </span>
            {SOUND.invite}
          </span>
        </button>
      </div>
    );
  }
  return (
    <div className="absolute right-3 top-0 z-10 flex h-[7%] min-h-6 items-center gap-2.5 sm:right-5">
      {sound && empty ? <span className="font-mono text-[10px] text-muted sm:text-[11px]">{SOUND.none}</span> : null}
      {sound && !empty ? <Meter /> : null}
      <button type="button" aria-pressed={sound} onClick={onToggle} data-testid="sound-switch" className="-my-2 inline-flex items-center gap-1.5 rounded px-1.5 py-2 font-mono text-[10px] text-secondary outline-none hover:text-primary focus-visible:ring-2 focus-visible:ring-focus sm:text-[11px]">
        {sound ? <VolumeX className="h-3.5 w-3.5" aria-hidden /> : <Volume2 className="h-3.5 w-3.5" aria-hidden />}
        {sound ? SOUND.off : SOUND.on}
      </button>
    </div>
  );
}

/**
 * The introduction, over the stage: the narrator's line as a subtitle, on the drawn frame of the scene each line
 * names (the frames the chapter list already shows; no new picture). It follows the audio element's own clock.
 */
export function VoiceIntro({ onSkip }: { onSkip: () => void }) {
  const [at, setAt] = useState(0);
  useEffect(() => {
    let raf = 0;
    const step = () => {
      const now = voiceTrack.now();
      if (now.cue === INTRO_CUE) {
        const i = INTRO.lines.indexOf(introLineAt(now.seconds));
        setAt((was) => (was === i ? was : i));
      }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, []);
  const line = INTRO.lines[at]!;
  const n = SCENES.findIndex((s) => s.id === line.shot) + 1;
  return (
    <div className="absolute inset-0 bg-black" data-testid="voice-intro">
      <Still scene={line.shot} n={n} />
      <div className="pointer-events-none absolute inset-x-0 bottom-[14.5%] flex justify-center px-3 sm:px-8" aria-hidden="true">
        <p key={at} className="sc-line max-w-[44ch] text-center text-sm text-white sm:text-lg lg:text-xl">
          <span className="sc-sub">
            <span className="mr-2 font-mono text-[11px] text-zinc-300 sm:text-[13px]">{SPEAKER_NAME.narrator}</span>
            {line.text}
          </span>
        </p>
      </div>
      <p aria-live="polite" className="sr-only">
        {SPEAKER_NAME.narrator}: {line.text}
      </p>
      <button type="button" onClick={onSkip} className="absolute bottom-[13%] right-3 rounded bg-black/70 px-2 py-1.5 font-mono text-[10px] text-secondary outline-none hover:text-primary focus-visible:ring-2 focus-visible:ring-focus sm:right-5 sm:text-[11px]">
        {SOUND.skip}
      </button>
    </div>
  );
}
