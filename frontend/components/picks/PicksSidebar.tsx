import { LAST_RACE } from "@/data/formGuide";
import { PICK_QUESTIONS } from "@/data/pickQuestions";

export function ScoringNote() {
  return (
    <section className="rounded-lg border border-paper/10 bg-asphalt px-4 py-4">
      <h2 className="font-mono text-[10px] uppercase tracking-[0.25em] text-paper-dim">How it&apos;s scored</h2>
      <ul className="mt-2 space-y-1.5 text-xs leading-relaxed text-paper-dim">
        <li>
          <span className="text-paper">10 points</span> for each exact call, {PICK_QUESTIONS.length * 10} in all. No
          partial credit: the right driver in the wrong podium place scores nothing.
        </li>
        <li>Scored automatically from the official classification, via Jolpica, once it&apos;s final.</li>
        <li>Level on points? Whoever locked in first ranks higher.</li>
      </ul>
    </section>
  );
}

export function FormGuide() {
  return (
    <section className="rounded-lg border border-paper/10 bg-asphalt px-4 py-4">
      <h2 className="font-mono text-[10px] uppercase tracking-[0.25em] text-paper-dim">
        Last time out · Round {LAST_RACE.round}
      </h2>
      <p className="mt-1 font-display text-base uppercase tracking-wide text-paper">
        {LAST_RACE.name} <span className="text-paper-dim">· {LAST_RACE.date}</span>
      </p>
      <ul className="mt-2 space-y-1.5 text-xs leading-relaxed text-paper-dim">
        {LAST_RACE.notes.map((note) => (
          <li key={note} className="flex gap-2">
            <span aria-hidden="true" className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-amber" />
            <span>{note}</span>
          </li>
        ))}
      </ul>
      <p className="mt-3 font-mono text-[10px] text-paper-dim/70">
        Sources:{" "}
        {LAST_RACE.sources.map((source, i) => (
          <span key={source.url}>
            {i > 0 ? ", " : ""}
            <a href={source.url} target="_blank" rel="noopener noreferrer" className="hover:text-amber hover:underline">
              {source.label}
              <span className="sr-only"> (opens in a new tab)</span>
            </a>
          </span>
        ))}
      </p>
    </section>
  );
}
