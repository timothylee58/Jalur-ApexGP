"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
  error?: boolean;
}

const SUGGESTIONS = [
  "What's the slowest corner at Sepang?",
  "When should I pit if it starts raining?",
  "Is the hot lap time real?",
  "How do I get to the circuit from KL?",
];

export function RaceEngineerChat() {
  const [open, setOpen] = useState(false);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [turns, streaming]);

  // Escape closes the panel — it's an overlay on mobile, so there has to
  // be a keyboard way out that isn't hunting for the button.
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const ask = useCallback(
    async (question: string) => {
      const trimmed = question.trim();
      if (!trimmed || streaming) return;

      // Whole exchanges only. Filtering out just the errored assistant
      // turn left its user message behind, so the next request sent two
      // user turns in a row — which the Messages API rejects, meaning one
      // recoverable failure bricked every later question until reload.
      const history: Array<{ role: "user" | "assistant"; content: string }> = [];
      for (let i = 0; i < turns.length - 1; i += 1) {
        const ask = turns[i];
        const answer = turns[i + 1];
        if (
          ask.role === "user" &&
          answer.role === "assistant" &&
          !answer.error &&
          answer.content.trim()
        ) {
          history.push({ role: "user", content: ask.content });
          history.push({ role: "assistant", content: answer.content });
        }
      }

      setTurns((prev) => [
        ...prev,
        { role: "user", content: trimmed },
        { role: "assistant", content: "" },
      ]);
      setInput("");
      setStreaming(true);

      const controller = new AbortController();
      abortRef.current = controller;

      // Mutates the last turn in place as deltas arrive. Rebuilding the
      // whole array per token would re-render every earlier turn too.
      const patchLast = (patch: Partial<Turn>) =>
        setTurns((prev) => {
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
            .then((body) => body?.detail as string | undefined)
            .catch(() => undefined);
          patchLast({
            content:
              detail ?? "The assistant isn't available right now. Try again shortly.",
            error: true,
          });
          return;
        }

        const reader = response.body?.getReader();
        if (!reader) throw new Error("No response body");
        const decoder = new TextDecoder();
        let buffer = "";
        let text = "";

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
              patchLast({
                content: event.message ?? "Something went wrong.",
                error: true,
              });
            }
          }
        }
      } catch (error) {
        if ((error as Error)?.name === "AbortError") return;
        patchLast({
          content: "Couldn't reach the assistant. Check your connection and try again.",
          error: true,
        });
      } finally {
        setStreaming(false);
        abortRef.current = null;
      }
    },
    [streaming, turns],
  );

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls="race-engineer-panel"
        className="fixed bottom-4 right-4 z-40 flex items-center gap-2 rounded-full border border-amber/40 bg-asphalt/95 px-4 py-2.5 font-mono text-xs uppercase tracking-wide text-amber shadow-lg backdrop-blur transition-colors hover:border-amber"
      >
        <span aria-hidden>📻</span>
        {open ? "Close radio" : "Ask the engineer"}
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
        className={`fixed inset-y-0 right-0 z-50 w-full max-w-md flex-col border-l border-paper/15 bg-pit-carbon sm:w-[26rem] ${
          open ? "flex" : "hidden"
        }`}
      >
        <header className="shrink-0 border-b border-paper/10 px-4 py-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-amber">
                Team radio
              </p>
              <h2 className="mt-1 font-display text-xl uppercase tracking-wide text-paper">
                Race engineer
              </h2>
            </div>
            {/* The launcher sits underneath the open panel, so closing
                needs its own affordance here — Escape alone leaves touch
                users with no way out. */}
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close the race engineer panel"
              className="-mr-1 shrink-0 rounded-md px-2 py-1 font-mono text-lg leading-none text-paper-dim transition-colors hover:bg-paper/10 hover:text-paper"
            >
              ×
            </button>
          </div>
          <p className="mt-1 text-[11px] leading-relaxed text-paper-dim">
            Answers from this app&apos;s own knowledge base, plus a live read of the
            feeds it uses. Not an official F1 source — it will tell you where a
            number came from.
          </p>
        </header>

        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3">
          {turns.length === 0 ? (
            <div>
              <p className="text-xs text-paper-dim">Try one of these:</p>
              <div className="mt-2 grid gap-1.5">
                {SUGGESTIONS.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => ask(suggestion)}
                    className="rounded-md border border-paper/10 px-3 py-2 text-left text-xs text-paper-dim transition-colors hover:border-amber/40 hover:text-paper"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {turns.map((turn, index) => (
                <div key={index}>
                  {turn.role === "user" ? (
                    <p className="ml-6 rounded-lg rounded-br-sm bg-amber/10 px-3 py-2 text-sm text-paper">
                      {turn.content}
                    </p>
                  ) : (
                    <div className="mr-4">
                      {turn.sources && turn.sources.length > 0 ? (
                        <div className="mb-1.5 flex flex-wrap gap-1">
                          {turn.sources.slice(0, 4).map((source) => (
                            <span
                              key={source.id}
                              title={source.title}
                              className="rounded bg-paper/5 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wide text-paper-dim"
                            >
                              {source.section}
                            </span>
                          ))}
                        </div>
                      ) : null}
                      <p
                        className={`whitespace-pre-wrap text-sm leading-relaxed ${
                          turn.error ? "text-brick" : "text-paper-dim"
                        }`}
                      >
                        {turn.content}
                        {streaming && index === turns.length - 1 && !turn.content ? (
                          <span className="text-paper-dim">Reading the data…</span>
                        ) : null}
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            ask(input);
          }}
          className="shrink-0 border-t border-paper/10 p-3"
        >
          <div className="flex items-center gap-2">
            <label htmlFor="race-engineer-input" className="sr-only">
              Ask the race engineer
            </label>
            <input
              id="race-engineer-input"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Ask about the circuit, strategy, the weekend…"
              disabled={streaming}
              className="min-w-0 flex-1 rounded-md border border-paper/15 bg-asphalt px-3 py-2 text-sm text-paper placeholder:text-paper-dim/60 focus:border-amber focus:outline-none disabled:opacity-60"
            />
            <button
              type="submit"
              disabled={streaming || !input.trim()}
              className="shrink-0 rounded-md bg-amber px-3 py-2 font-mono text-xs uppercase tracking-wide text-asphalt transition-opacity disabled:opacity-40"
            >
              {streaming ? "…" : "Send"}
            </button>
          </div>
        </form>
      </aside>
    </>
  );
}
