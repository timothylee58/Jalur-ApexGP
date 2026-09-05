import { Fragment } from "react";
import { glossary, glossaryPhrases } from "@/data/glossary";
import { GlossaryTerm } from "@/components/shared/GlossaryTerm";

interface GlossaryTextProps {
  children: string;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// One combined, case-insensitive matcher. Lookarounds (not \b) so hyphenated and
// multi-word phrases like "one-stop" and "pit window" match cleanly.
const PATTERN = new RegExp(
  `(?<![\\w-])(${glossaryPhrases.map(escapeRegExp).join("|")})(?![\\w-])`,
  "gi",
);

/** Renders a strategy-copy string, wrapping the first mention of each known
 * jargon term in a tap-to-explain GlossaryTerm. */
export function GlossaryText({ children }: GlossaryTextProps) {
  const text = children;
  const nodes: React.ReactNode[] = [];
  const used = new Set<string>();
  let lastIndex = 0;
  let key = 0;

  PATTERN.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = PATTERN.exec(text)) !== null) {
    const matched = match[0];
    const glossaryKey = matched.toLowerCase();
    const entry = glossary[glossaryKey];

    if (!entry || used.has(glossaryKey)) continue;
    used.add(glossaryKey);

    if (match.index > lastIndex) {
      nodes.push(<Fragment key={key++}>{text.slice(lastIndex, match.index)}</Fragment>);
    }
    nodes.push(
      <GlossaryTerm key={key++} entry={entry}>
        {matched}
      </GlossaryTerm>,
    );
    lastIndex = match.index + matched.length;
  }

  if (lastIndex < text.length) {
    nodes.push(<Fragment key={key++}>{text.slice(lastIndex)}</Fragment>);
  }

  return <>{nodes}</>;
}
