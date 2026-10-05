import { onBeforeUnmount, onMounted, ref, shallowRef } from "vue";
import type { WeekendBoard } from "./types";

export type BoardSource = "live" | "snapshot";

async function load(url: string, signal: AbortSignal): Promise<WeekendBoard> {
  const res = await fetch(url, { signal, cache: "no-store" });
  if (!res.ok) throw new Error(`Board request failed (${res.status})`);
  return (await res.json()) as WeekendBoard;
}

// Polls on the server's own cadence (30s while a session is live, 5 min
// otherwise) and stops while the tab is hidden. If the live API can't be
// reached before anything has loaded (no network, or a sandbox the API's
// CORS list doesn't cover), it shows the bundled snapshot and keeps
// retrying live on the same cadence.
export function useWeekendBoard(url: string, snapshotUrl?: string) {
  const board = shallowRef<WeekendBoard | null>(null);
  const source = ref<BoardSource>(url === snapshotUrl ? "snapshot" : "live");
  const error = ref<string | null>(null);
  const loading = ref(false);
  let timer: ReturnType<typeof setTimeout> | undefined;
  let inFlight: AbortController | undefined;

  async function refresh() {
    clearTimeout(timer);
    inFlight?.abort();
    const controller = new AbortController();
    inFlight = controller;
    loading.value = true;
    try {
      board.value = await load(url, controller.signal);
      source.value = url === snapshotUrl ? "snapshot" : "live";
      error.value = null;
    } catch (err) {
      if (controller.signal.aborted) return;
      const reason = err instanceof Error ? err.message : "Board request failed";
      const showSnapshot = snapshotUrl && url !== snapshotUrl && (!board.value || source.value === "snapshot");
      if (showSnapshot) {
        try {
          board.value = await load(snapshotUrl, controller.signal);
          source.value = "snapshot";
          error.value = null;
        } catch {
          if (!controller.signal.aborted) error.value = reason;
        }
      } else {
        error.value = reason;
      }
    } finally {
      if (inFlight === controller) loading.value = false;
    }
    if (!document.hidden && !controller.signal.aborted) {
      timer = setTimeout(refresh, (board.value?.nextCheckSeconds ?? 300) * 1000);
    }
  }

  function onVisibility() {
    if (document.hidden) clearTimeout(timer);
    else void refresh();
  }

  onMounted(() => {
    document.addEventListener("visibilitychange", onVisibility);
    void refresh();
  });

  onBeforeUnmount(() => {
    document.removeEventListener("visibilitychange", onVisibility);
    clearTimeout(timer);
    inFlight?.abort();
  });

  return { board, source, error, loading, refresh };
}
