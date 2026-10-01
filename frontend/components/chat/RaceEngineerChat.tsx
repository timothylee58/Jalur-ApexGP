"use client";

import { Fragment, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { API_URL } from "@/lib/api";

/**
 * Sidebar assistant over the backend's retrieval endpoint (`/api/chat`).
 *
 * Reads the SSE stream with fetch + a ReadableStream reader rather than
 * EventSource, because EventSource is GET-only and the question plus
 * conversation history belong in a POST body, not a query string.
 *
 * Sources arrive as the first event and render immediately, so the panel
 * shows what it's grounding on while the answer is still arriving — the
 * same "show the working" standard the strategy engine's confidence and
 * key-risk lines hold themselves to.
 *
 * Spend is bounded on both ends: the server rate-limits and screens
 * (backend/app/services/chat_guard.py), and this client caps input length
 * and replays only the last few exchanges as history.
 */

interface Source {
  id: string;
  title: string;
  section: string;
}

interface Turn {
  role: "user" | "assistant";
  content: string;
  sources?: Source[];
  /** "error" for a failure, "notice" for a limit the user just has to wait out. */
  status?: "error" | "notice";
  question?: string;
}

const MAX_INPUT = 500;
const HISTORY_EXCHANGES = 3;
const HISTORY_CHARS = 1200;

const SUGGESTIONS: Array<{ topic: string; question: string }> = [
  { topic: "Circuit", question: "What's the slowest corner at Sepang?" },
  { topic: "Strategy", question: "When should I pit if it starts raining?" },
  { topic: "Simulation", question: "Is the hot lap time real?" },
  { topic: "Getting there", question: "Is there a free shuttle from KLIA 2?" },
];

function RadioIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden>
      <path d="M8 5 17 2" strokeLinecap="round" />
      <rect x="3" y="7" width="18" height="14" rx="3" />
      <circle cx="15.5" cy="14" r="3" />
      <path d="M6.5 11.5h3M6.5 14.5h3M6.5 17.5h3" strokeLinecap="round" />
    </svg>
  );
}

function Waveform({ active }: { active: boolean }) {
  return (
    <span className="inline-flex h-3 items-end gap-[2px]" aria-hidden>
      {[0, 1, 2, 3, 4].map((i) => (
        <span
          key={i}
          className={`w-[2px] rounded-full bg-amber ${active ? "radio-bar" : "h-1 opacity-50"}`}
          style={active ? { animationDelay: `${i * 0.12}s`, height: "100%" } : undefined}
        />
      ))}
    </span>
  );
}

function inline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*\n]+\*\*)/g).map((part, i) =>
    part.startsWith("**") && part.endsWith("**") && part.length > 4 ? (
      <strong key={i} className="font-semibold text-paper">
        {part.slice(2, -2)}
      </strong>
    ) : (
      <Fragment key={i}>{part}</Fragment>
    ),
  );
}

const LIST_ITEM = /^\s*([-*•]|\d+[.)])\s+/;

/** Just enough formatting for an engineer's read: paragraphs, bullet or
 * numbered lists (with or without a lead-in line), and bold. Built as
 * elements, never as HTML. */
function RichText({ text }: { text: string }) {
  const blocks = text.split(/\n{2,}/).filter((block) => block.trim());
  return (
    <>
      {blocks.map((block, i) => {
        const groups: Array<{ list: boolean; lines: string[] }> = [];
        for (const line of block.split("\n").filter((l) => l.trim())) {
          const list = LIST_ITEM.test(line);
          const lastGroup = groups[groups.length - 1];
          if (lastGroup && lastGroup.list === list) lastGroup.lines.push(line);
          else groups.push({ list, lines: [line] });
        }
        return (
          <div key={i} className="my-2 first:mt-0 last:mb-0">
            {groups.map((group, g) =>
              group.list ? (
                <ul key={g} className="mt-1 space-y-1 pl-4">
                  {group.lines.map((line, j) => (
                    <li key={j} className="list-disc marker:text-amber/70">
                      {inline(line.replace(LIST_ITEM, ""))}
                    </li>
                  ))}
                </ul>
              ) : (
                <p key={g}>
                  {group.lines.map((line, j) => (
                    <Fragment key={j}>
                      {j > 0 ? <br /> : null}
                      {inline(line)}
                    </Fragment>
                  ))}
                </p>
              ),
            )}
          </div>
        );
      })}
    </>
  );
}

export function RaceEngineerChat() {
  const [open, setOpen] = useState(false);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const launcherRef = useRef<HTMLButtonElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [turns, streaming]);

  // Escape closes the panel — it's an overlay on mobile, so there has to
  // be a keyboard way out that isn't hunting for the button.
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    inputRef.current?.focus({ preventScroll: true });
    // Full-screen on phones: keep the page behind from scrolling under it.
    const phone = window.matchMedia("(max-width: 639px)").matches;
    const previous = document.body.style.overflow;
    if (phone) document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      if (phone) document.body.style.overflow = previous;
    };
  }, [open]);

  useEffect(() => () => abortRef.current?.abort(), []);

  // Grow the composer with its content, up to four lines.
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    // Empty goes back to the one-line default: an empty textarea's
    // scrollHeight can include its wrapped placeholder.
    el.style.height = "";
    if (!input) return;
    el.style.height = `${Math.min(el.scrollHeight, 112)}px`;
  }, [input]);

  function close() {
    setOpen(false);
    requestAnimationFrame(() => launcherRef.current?.focus({ preventScroll: true }));
  }

  function newChat() {
    abortRef.current?.abort();
    setTurns([]);
    setInput("");
    inputRef.current?.focus();
  }

  const ask = useCallback(
    async (question: string) => {
      const trimmed = question.trim().slice(0, MAX_INPUT);
      if (!trimmed || streaming) return;

      // Whole exchanges only, and only the last few. Filtering out just the
      // errored assistant turn left its user message behind, so the next
      // request sent two user turns in a row — which the Messages API
      // rejects. Older turns would only cost tokens: grounding is rebuilt
      // per question on the server anyway.
      const exchanges: Array<[string, string]> = [];
      for (let i = 0; i < turns.length - 1; i += 1) {
        const q = turns[i];
        const a = turns[i + 1];
        if (q.role === "user" && a.role === "assistant" && !a.status && a.content.trim()) {
          exchanges.push([q.content, a.content.slice(0, HISTORY_CHARS)]);
        }
      }
      const history = exchanges
        .slice(-HISTORY_EXCHANGES)
        .flatMap(([q, a]) => [
          { role: "user" as const, content: q },
          { role: "assistant" as const, content: a },
        ]);

      setTurns((prev) => [
        ...prev,
        { role: "user", content: trimmed },
        { role: "assistant", content: "", question: trimmed },
      ]);
      setInput("");
      setStreaming(true);

      const controller = new AbortController();
      abortRef.current = controller;
      let text = "";

      // Mutates the last turn in place as deltas arrive. Rebuilding the
      // whole array per token would re-render every earlier turn too.
      const patchLast = (patch: Partial<Turn>) =>
        setTurns((prev) => {
          if (prev.length === 0) return prev;
          const next = [...prev];
          next[next.length - 1] = { ...next[next.length - 1], ...patch };
          return next;
        });

      try {
        const response = await fetch(`${API_URL}/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ question: trimmed, history }),
          signal: controller.signal,
        });

        if (!response.ok) {
          const detail = await response
            .json()
            .then((body) => (typeof body?.detail === "string" ? (body.detail as string) : undefined))
            .catch(() => undefined);
          patchLast({
            content: detail ?? "The assistant isn't available right now. Try again shortly.",
            status: response.status === 429 ? "notice" : "error",
          });
          return;
        }

        const reader = response.body?.getReader();
        if (!reader) throw new Error("No response body");
        const decoder = new TextDecoder();
        let buffer = "";

        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          // SSE frames are separated by a blank line; a frame can arrive
          // split across chunks, so keep the trailing partial in the buffer.
          const frames = buffer.split("\n\n");
          buffer = frames.pop() ?? "";

          for (const frame of frames) {
            const line = frame.split("\n").find((l) => l.startsWith("data: "));
            if (!line) continue;
            let event: { type: string; text?: string; sources?: Source[]; message?: string };
            try {
              event = JSON.parse(line.slice(6));
            } catch {
              continue;
            }
            if (event.type === "sources") {
              patchLast({ sources: event.sources ?? [] });
            } else if (event.type === "delta") {
              text += event.text ?? "";
              patchLast({ content: text });
            } else if (event.type === "error") {
              patchLast({ content: event.message ?? "Something went wrong.", status: "error" });
            }
          }
        }
      } catch (error) {
        if ((error as Error)?.name === "AbortError") {
          if (!text) patchLast({ content: "Stopped.", status: "notice" });
          return;
        }
        patchLast({
          content: "Couldn't reach the assistant. Check your connection and try again.",
          status: "error",
        });
      } finally {
        setStreaming(false);
        abortRef.current = null;
      }
    },
    [streaming, turns],
  );

  const remaining = MAX_INPUT - input.length;

  return (
    <>
      <button
        ref={launcherRef}
        type="button"
        onClick={() => (open ? close() : setOpen(true))}
        aria-expanded={open}
        aria-controls="race-engineer-panel"
        aria-label={open ? "Close the race engineer" : "Ask the race engineer"}
        data-floating-widget=""
        className={`fixed bottom-[max(1rem,env(safe-area-inset-bottom))] right-[max(1rem,env(safe-area-inset-right))] z-40 items-center justify-center gap-2 rounded-full border border-amber/40 bg-asphalt/95 font-mono text-xs uppercase tracking-wide text-amber shadow-lg shadow-black/40 backdrop-blur transition-colors hover:border-amber focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber h-11 w-11 sm:h-auto sm:w-auto sm:px-4 sm:py-2.5 ${
          open ? "hidden sm:flex" : "flex"
        }`}
      >
        <span className="relative">
          <RadioIcon className="h-5 w-5 sm:h-4 sm:w-4" />
          <span className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-teal sm:hidden" aria-hidden />
        </span>
        <span className="hidden sm:inline">{open ? "Close radio" : "Ask the engineer"}</span>
      </button>

      {/* Toggled by class, not the `hidden` attribute. Tailwind's `flex`
          utility and Preflight's `[hidden]{display:none}` have equal
          specificity, and utilities come later in the cascade — so with
          `hidden` set the panel stayed `display:flex`, invisible but
          still covering the right side of every page and swallowing
          clicks meant for the content underneath.

          Background is solid rather than translucent: this is a reading
          surface for streamed prose, and a blurred 3D scene showing
          through it costs more in legibility than the effect is worth. */}
      <aside
        id="race-engineer-panel"
        aria-label="Race engineer assistant"
        className={`fixed inset-y-0 right-0 z-50 w-full flex-col border-l border-paper/15 bg-pit-carbon shadow-2xl shadow-black/60 sm:w-[26rem] ${
          open ? "flex" : "hidden"
        }`}
      >
        <header className="relative shrink-0 overflow-hidden border-b border-paper/10 px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber/60 to-transparent" />
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.25em] text-amber">
                <Waveform active={streaming} />
                Team radio
              </p>
              <h2 className="mt-1 font-display text-2xl uppercase leading-none tracking-wide text-paper">
                Race engineer
              </h2>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              {turns.length > 0 ? (
                <button
                  type="button"
                  onClick={newChat}
                  className="rounded-md px-2 py-1 font-mono text-[10px] uppercase tracking-[0.15em] text-paper-dim transition-colors hover:bg-paper/10 hover:text-paper focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber"
                >
                  New chat
                </button>
              ) : null}
              {/* The launcher sits underneath the open panel, so closing
                  needs its own affordance here — Escape alone leaves touch
                  users with no way out. */}
              <button
                type="button"
                onClick={close}
                aria-label="Close the race engineer panel"
                className="-mr-1 rounded-md px-2 py-1 font-mono text-lg leading-none text-paper-dim transition-colors hover:bg-paper/10 hover:text-paper focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber"
              >
                ×
              </button>
            </div>
          </div>
          <p className="mt-2 text-[11px] leading-relaxed text-paper-dim">
            Grounded in this app&apos;s knowledge base and live feeds — every answer shows its
            sources. Unofficial, and it can be wrong.
          </p>
        </header>

        <div ref={scrollRef} className="flex-1 overflow-y-auto overscroll-contain px-4 py-4">
          {turns.length === 0 ? (
            <div>
              <p className="font-display text-3xl uppercase leading-none tracking-wide text-paper">Radio check.</p>
              <p className="mt-2 text-sm leading-relaxed text-paper-dim">
                Ask about Sepang&apos;s corners, tyre and pit strategy, this weekend&apos;s sessions, the
                grid, or getting to the circuit.
              </p>
              <div className="mt-5 grid gap-2">
                {SUGGESTIONS.map((suggestion) => (
                  <button
                    key={suggestion.question}
                    type="button"
                    onClick={() => ask(suggestion.question)}
                    className="group flex items-center justify-between gap-3 rounded-lg border border-paper/10 bg-asphalt/60 px-3 py-2.5 text-left transition-colors hover:border-amber/50 hover:bg-amber/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber"
                  >
                    <span>
                      <span className="block font-mono text-[9px] uppercase tracking-[0.2em] text-amber/80">
                        {suggestion.topic}
                      </span>
                      <span className="mt-0.5 block text-sm text-paper">{suggestion.question}</span>
                    </span>
                    <span aria-hidden className="text-paper-dim transition-transform group-hover:translate-x-0.5 group-hover:text-amber">
                      →
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <ol className="space-y-5" aria-live="polite">
              {turns.map((turn, index) => {
                const last = index === turns.length - 1;
                if (turn.role === "user") {
                  return (
                    <li key={index} className="flex justify-end">
                      <p className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-sm bg-amber/15 px-3.5 py-2 text-sm text-paper">
                        {turn.content}
                      </p>
                    </li>
                  );
                }
                const waiting = streaming && last && !turn.content;
                return (
                  <li key={index} className="flex gap-2.5">
                    <span
                      className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border ${
                        turn.status === "error" ? "border-brick/50 text-brick" : "border-amber/40 text-amber"
                      }`}
                      aria-hidden
                    >
                      <RadioIcon className="h-3.5 w-3.5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-paper-dim">Engineer</p>
                      {waiting ? (
                        <p className="mt-1.5 flex items-center gap-2 text-sm text-paper-dim">
                          <Waveform active />
                          On the radio…
                        </p>
                      ) : turn.status ? (
                        <div
                          className={`mt-1.5 rounded-lg border px-3 py-2 text-sm leading-relaxed ${
                            turn.status === "error" ? "border-brick/40 text-paper" : "border-amber/30 text-paper"
                          }`}
                        >
                          {turn.content}
                          {turn.status === "error" && turn.question && last && !streaming ? (
                            <button
                              type="button"
                              onClick={() => {
                                const question = turn.question!;
                                setTurns((prev) => prev.slice(0, -2));
                                setTimeout(() => ask(question), 0);
                              }}
                              className="mt-2 block font-mono text-[10px] uppercase tracking-[0.15em] text-amber hover:underline"
                            >
                              Try again
                            </button>
                          ) : null}
                        </div>
                      ) : (
                        <div className="mt-1 text-sm leading-relaxed text-paper/85">
                          <RichText text={turn.content} />
                          {streaming && last ? (
                            <span className="ml-0.5 inline-block h-3.5 w-1.5 animate-pulse bg-amber/70 align-middle" aria-hidden />
                          ) : null}
                        </div>
                      )}
                      {turn.sources && turn.sources.length > 0 && !turn.status ? (
                        <div className="mt-2 flex flex-wrap items-center gap-1">
                          <span className="font-mono text-[9px] uppercase tracking-[0.15em] text-paper-dim/70">
                            Sources
                          </span>
                          {turn.sources.slice(0, 4).map((source) => (
                            <span
                              key={source.id}
                              title={source.title}
                              className="max-w-[12rem] truncate rounded border border-paper/10 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wide text-paper-dim"
                            >
                              {source.title}
                            </span>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </div>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            ask(input);
          }}
          className="shrink-0 border-t border-paper/10 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3"
        >
          <div className="flex items-end gap-2 rounded-xl border border-paper/15 bg-asphalt px-2 py-1.5 focus-within:border-amber/70">
            <label htmlFor="race-engineer-input" className="sr-only">
              Ask the race engineer
            </label>
            <textarea
              id="race-engineer-input"
              ref={inputRef}
              rows={1}
              value={input}
              maxLength={MAX_INPUT}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                  event.preventDefault();
                  ask(input);
                }
              }}
              placeholder="Ask about the circuit, strategy, the weekend…"
              className="min-h-[2.25rem] min-w-0 flex-1 resize-none bg-transparent px-1.5 py-2 text-sm text-paper placeholder:text-paper-dim/60 focus:outline-none"
            />
            {streaming ? (
              <button
                type="button"
                onClick={() => abortRef.current?.abort()}
                className="mb-0.5 shrink-0 rounded-lg border border-paper/20 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.15em] text-paper transition-colors hover:border-amber hover:text-amber"
              >
                Stop
              </button>
            ) : (
              <button
                type="submit"
                disabled={!input.trim()}
                aria-label="Send"
                className="mb-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber text-asphalt transition-opacity disabled:opacity-30"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.2} aria-hidden>
                  <path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            )}
          </div>
          <div className="mt-1.5 flex items-center justify-between px-1 font-mono text-[9px] uppercase tracking-[0.15em] text-paper-dim/60">
            <span>Enter to send · Shift+Enter for a new line</span>
            <span className={remaining <= 50 ? "text-amber" : ""} aria-live="polite">
              {remaining <= 100 ? `${remaining} left` : ""}
            </span>
          </div>
        </form>
      </aside>
    </>
  );
}
