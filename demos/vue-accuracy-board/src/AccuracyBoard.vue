<script setup lang="ts">
import { computed } from "vue";
import type { SessionBoard, SessionState, Variant } from "./types";
import { useWeekendBoard } from "./useWeekendBoard";

const props = defineProps<{ endpoint: string; snapshot?: string }>();

const { board, source, error, loading, refresh } = useWeekendBoard(props.endpoint, props.snapshot);
const offline = props.endpoint === props.snapshot;

const STATE_LABEL: Record<SessionState, string> = {
  upcoming: "Upcoming",
  live: "Live",
  awaiting: "Awaiting data",
  scored: "Scored",
  unscored: "Not scored",
};

// Always Sepang's clock, whatever the viewer's timezone.
const myt = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Kuala_Lumpur",
  weekday: "short",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});
const when = (iso: string) => `${myt.format(new Date(iso))} MYT`;

const score = (s: SessionBoard, variant: Variant) =>
  s.scores.find((x) => x.variant === variant)?.compositeScore;

const summary = computed(() => {
  const scored = board.value?.sessions.filter((s) => s.scores.length > 0) ?? [];
  const mean = (variant: Variant) => {
    const values = scored.map((s) => score(s, variant)).filter((v): v is number => v !== undefined);
    return values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
  };
  return {
    scored: scored.length,
    total: board.value?.sessions.length ?? 0,
    conservative: mean("conservative"),
    aggressive: mean("aggressive"),
  };
});

const fmt = (n: number | null | undefined) => (n == null ? "—" : n.toFixed(0));
</script>

<template>
  <section class="board" aria-labelledby="board-title">
    <header class="head">
      <div>
        <p class="eyebrow">Prediction accuracy<template v-if="board"> · R{{ board.round }} {{ board.season }}</template></p>
        <h2 id="board-title">{{ board?.raceName ?? "Weekend board" }}</h2>
        <span v-if="board" class="chip" :data-source="source">
          {{ source === "live" ? "Live · production API" : "Saved snapshot" }}
        </span>
      </div>
      <button type="button" class="refresh" :disabled="loading" @click="refresh">
        {{ loading ? "Refreshing…" : "Refresh" }}
      </button>
    </header>

    <p v-if="error" role="alert" class="error">{{ error }}</p>

    <template v-if="board">
      <dl class="tiles">
        <div>
          <dt>Sessions scored</dt>
          <dd>{{ summary.scored }}<small>/{{ summary.total }}</small></dd>
        </div>
        <div>
          <dt>Conservative</dt>
          <dd>{{ fmt(summary.conservative) }}</dd>
        </div>
        <div>
          <dt>Aggressive</dt>
          <dd>{{ fmt(summary.aggressive) }}</dd>
        </div>
      </dl>

      <ol class="sessions">
        <li v-for="s in board.sessions" :key="s.session" class="row" :data-state="s.state">
          <div class="session">
            <strong>{{ s.session }}</strong>
            <time :datetime="s.start">{{ when(s.start) }}</time>
            <span class="badge">{{ STATE_LABEL[s.state] }}</span>
          </div>
          <p>
            <span class="label">Locked read</span>
            <template v-if="s.prediction">
              {{ fmt(s.prediction.rainProbability) }}% rain · {{ s.prediction.condition }}
            </template>
            <template v-else>None locked</template>
          </p>
          <p>
            <span class="label">What happened</span>
            <template v-if="s.outcome">
              {{ s.outcome.rainOccurred ? "Rain" : "Dry" }}
              <template v-if="s.outcome.actualPitLap !== null"> · first stop lap {{ s.outcome.actualPitLap }}</template>
            </template>
            <template v-else>—</template>
          </p>
          <p class="score">
            <span class="label">Score C / A</span>
            {{ fmt(score(s, "conservative")) }} / {{ fmt(score(s, "aggressive")) }}
          </p>
        </li>
      </ol>

      <p class="footnote" aria-live="polite">
        <template v-if="source === 'live'">
          Updated {{ when(board.generatedAt) }} · next check in {{ board.nextCheckSeconds }}s
        </template>
        <template v-else-if="offline">Saved snapshot from {{ when(board.generatedAt) }} · offline mode</template>
        <template v-else>
          Snapshot from {{ when(board.generatedAt) }}. The live API wasn't reachable from this page, so it retries every
          {{ board.nextCheckSeconds }}s.
        </template>
      </p>
    </template>
    <p v-else-if="!error" class="footnote" aria-busy="true">Loading the board…</p>
  </section>
</template>

<style scoped>
.board {
  --bg: #0b0d12;
  --panel: #141821;
  --line: #262c38;
  --text: #e8ebf1;
  --muted: #8a93a6;
  --accent: #e10600;
  --ok: #22c55e;
  --wait: #f59e0b;
  max-width: 56rem;
  margin: 0 auto;
  padding: 1.25rem;
  color: var(--text);
  background: var(--bg);
  border-radius: 1rem;
  font-family: ui-sans-serif, system-ui, sans-serif;
}
.head { display: flex; align-items: flex-end; justify-content: space-between; gap: 1rem; }
.eyebrow { margin: 0; color: var(--accent); font-size: 0.75rem; letter-spacing: 0.12em; text-transform: uppercase; }
h2 { margin: 0.25rem 0 0; font-size: 1.375rem; }
.refresh {
  border: 1px solid var(--line); background: var(--panel); color: var(--text);
  border-radius: 999px; padding: 0.5rem 1rem; cursor: pointer;
}
.refresh:disabled { opacity: 0.6; cursor: progress; }
.refresh:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.chip {
  display: inline-block; margin-top: 0.5rem; padding: 0.125rem 0.625rem; border-radius: 999px;
  font-size: 0.6875rem; border: 1px solid var(--line); color: var(--muted);
}
.chip[data-source="live"] { color: var(--ok); border-color: color-mix(in srgb, var(--ok) 45%, transparent); }
.error { color: #fca5a5; }
.tiles { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.75rem; margin: 1.25rem 0; }
.tiles div { background: var(--panel); border: 1px solid var(--line); border-radius: 0.75rem; padding: 0.75rem; }
dt { color: var(--muted); font-size: 0.75rem; }
dd { margin: 0.25rem 0 0; font-size: 1.75rem; font-weight: 700; font-variant-numeric: tabular-nums; }
dd small { color: var(--muted); font-size: 0.875rem; }
.sessions { list-style: none; margin: 0; padding: 0; display: grid; gap: 0.5rem; }
.row {
  display: grid; gap: 0.5rem; padding: 0.875rem; border-radius: 0.75rem;
  background: var(--panel); border: 1px solid var(--line); border-left: 3px solid var(--line);
}
.row[data-state="scored"] { border-left-color: var(--ok); }
.row[data-state="live"], .row[data-state="awaiting"] { border-left-color: var(--wait); }
.row p { margin: 0; }
.session { display: flex; align-items: baseline; gap: 0.5rem; flex-wrap: wrap; }
.session time { color: var(--muted); font-size: 0.8125rem; }
.badge { margin-left: auto; font-size: 0.6875rem; padding: 0.125rem 0.5rem; border-radius: 999px; border: 1px solid var(--line); color: var(--muted); }
.label { display: block; color: var(--muted); font-size: 0.6875rem; text-transform: uppercase; letter-spacing: 0.08em; }
.score { font-variant-numeric: tabular-nums; font-weight: 600; }
.footnote { color: var(--muted); font-size: 0.75rem; margin: 1rem 0 0; }
@media (min-width: 640px) {
  .row { grid-template-columns: 1.3fr 1.4fr 1.2fr 0.8fr; align-items: center; }
  .badge { margin-left: 0; }
}
</style>
