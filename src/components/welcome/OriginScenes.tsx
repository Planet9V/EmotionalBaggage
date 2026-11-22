// "It started as a joke": the origin of the worked example. For now a still placeholder: two sentences from the
// story's origin part beside a drawing of the gadget as now designed (a tag on the suitcase handle), and five cards naming the circumstances with the bag's lines, word for word. The animated
// scenes (src/components/welcome/scenes) are swapped into this wrapper; nothing else on the page needs to change.
// A server component.
import { HandleTag } from "./Artefacts";
import { ORIGIN } from "./content";

export function OriginScenes({ sentences }: { /** the first two sentences of the story's origin part, exactly as written */ sentences: string[] }) {
  return (
    <div>
      <div className="flex flex-wrap items-center gap-x-8 gap-y-5">
        <HandleTag className="h-[168px] w-auto shrink-0" label={ORIGIN.tag} />
        <blockquote className="min-w-0 max-w-[68ch] flex-1 basis-80 border-l-2 border-dutchOrange pl-4 text-[15px] leading-relaxed text-secondary sm:text-base">
          {sentences.map((s) => (
            <p key={s} className="mt-1 first:mt-0">{s}</p>
          ))}
        </blockquote>
      </div>
      <ol className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {ORIGIN.scenes.map((s, i) => (
          <li key={s.key} className="flex min-h-[148px] flex-col rounded-xl border border-hairline bg-surface p-4 shadow-[var(--shadow-card)]">
            <p className="font-mono text-[11px] text-muted">
              <span className="text-link">{String(i + 1).padStart(2, "0")}</span> {s.where}
            </p>
            <p className="mt-auto pt-4 text-base font-semibold leading-snug tracking-tight text-primary">&ldquo;{s.line}&rdquo;</p>
          </li>
        ))}
      </ol>
      <p className="mt-3 text-xs leading-relaxed text-muted">{ORIGIN.storyboard}</p>
    </div>
  );
}
