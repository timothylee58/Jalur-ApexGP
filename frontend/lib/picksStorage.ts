/**
 * Race-day Picks is anonymous, no login — a browser-local participant id
 * (minted once, on first successful submit) plus an in-progress draft are
 * the only client-held state, both in localStorage. Every read/write is
 * wrapped: a private window, cleared site data, or a browser blocking
 * storage must never crash the page, just fall back to "no saved state".
 */

import type { PickAnswers } from "@/types/picks";

const DRAFT_KEY = "jalur-apexgp:picks-draft";
const ENTRY_ID_KEY = "jalur-apexgp:picks-entry-id";

export function loadDraft(): Partial<PickAnswers> | null {
  try {
    const raw = window.localStorage.getItem(DRAFT_KEY);
    return raw ? (JSON.parse(raw) as Partial<PickAnswers>) : null;
  } catch {
    return null;
  }
}

export function saveDraft(draft: Partial<PickAnswers>): void {
  try {
    window.localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  } catch {
    // Best-effort — a fan can still fill out the form in one sitting even
    // if the draft can't be persisted between visits.
  }
}

export function clearDraft(): void {
  try {
    window.localStorage.removeItem(DRAFT_KEY);
  } catch {
    // Nothing to do — worst case a stale draft lingers for this browser.
  }
}

export function getEntryId(): string | null {
  try {
    return window.localStorage.getItem(ENTRY_ID_KEY);
  } catch {
    return null;
  }
}

export function saveEntryId(id: string): void {
  try {
    window.localStorage.setItem(ENTRY_ID_KEY, id);
  } catch {
    // If this fails, the fan's submission still went through server-side —
    // they just won't see "your row" highlighted on this browser later.
  }
}
