"""Guardrails in front of the race-engineer assistant.

The chat route is public and every answer spends model tokens on the
operator's key, so the cheap checks run first and most abuse never reaches
the model:

1. RATE LIMIT — a sliding window per client (per minute and per day) plus
   a per-instance ceiling across all clients, so one script can't drain
   the key and a burst from many can't either. In-memory, so it is per
   serverless instance: it bounds what any single warm instance will
   spend, and a platform-level rule (Vercel's WAF rate limiting on
   /api/chat) is the durable layer on top. Clients are keyed by a hash of
   the IP the platform reports, never the raw address.
2. SCREEN — greetings get a canned reply, prompt-injection phrasing and
   plainly off-topic asks get a polite refusal, all without a model call.
   "Off-topic" is judged by vocabulary rather than retrieval score: BM25
   scores alone don't separate "how much is a ticket" from "write me a
   python script". Follow-ups in an ongoing conversation ("why?") always
   pass, since they lean on the previous turn.
3. CACHE — the same first question (the suggestion chips, mostly) is
   answered once and replayed for a while, as long as it didn't pull in
   live data that may have moved since.
"""

from __future__ import annotations

import hashlib
import re
import time
from collections import OrderedDict, deque
from dataclasses import dataclass, field

from app.config import settings
from app.services import knowledge_base

# ---- rate limiting -----------------------------------------------------------


@dataclass
class RateDecision:
    allowed: bool
    retry_after_s: int = 0
    message: str = ""


@dataclass
class RateLimiter:
    per_minute: int
    per_day: int
    global_per_minute: int
    _clients: dict[str, deque[float]] = field(default_factory=dict)
    _global: deque[float] = field(default_factory=deque)

    def check(self, client: str, now: float | None = None) -> RateDecision:
        now = time.monotonic() if now is None else now
        hits = self._clients.setdefault(client, deque())
        while hits and now - hits[0] >= 86_400:
            hits.popleft()
        while self._global and now - self._global[0] >= 60:
            self._global.popleft()

        recent = [t for t in hits if now - t < 60]
        if len(recent) >= self.per_minute:
            wait = int(60 - (now - recent[0])) + 1
            return RateDecision(False, wait, f"That's a lot of radio traffic — give it {wait}s and ask again.")
        if len(hits) >= self.per_day:
            wait = int(86_400 - (now - hits[0])) + 1
            return RateDecision(
                False,
                wait,
                "You've reached today's question limit for the race engineer. It resets within 24 hours.",
            )
        if len(self._global) >= self.global_per_minute:
            wait = int(60 - (now - self._global[0])) + 1
            return RateDecision(False, wait, "The race engineer is busy right now — try again in a minute.")

        hits.append(now)
        self._global.append(now)
        if len(self._clients) > 5_000:
            self._prune(now)
        return RateDecision(True)

    def _prune(self, now: float) -> None:
        for key in [k for k, v in self._clients.items() if not v or now - v[-1] >= 86_400]:
            del self._clients[key]

    def reset(self) -> None:
        self._clients.clear()
        self._global.clear()


limiter = RateLimiter(
    per_minute=settings.chat_rate_per_minute,
    per_day=settings.chat_rate_per_day,
    global_per_minute=settings.chat_global_per_minute,
)


def client_key(headers: dict[str, str], fallback_host: str | None) -> str:
    """The client's IP as the platform reports it, hashed. Vercel sets
    x-forwarded-for / x-real-ip itself and overwrites what a client sends."""
    forwarded = headers.get("x-forwarded-for", "").split(",")[0].strip()
    ip = forwarded or headers.get("x-real-ip", "").strip() or (fallback_host or "unknown")
    return hashlib.sha256(ip.encode()).hexdigest()[:24]


def origin_allowed(origin: str | None) -> bool:
    """Browsers always send Origin on a cross-site POST, so another site
    embedding this endpoint is refused. A request without one (curl) still
    passes here and is bounded by the rate limit instead."""
    if not origin:
        return True
    allowed = {settings.frontend_origin.rstrip("/"), "http://localhost:3000"}
    allowed.update(o.strip().rstrip("/") for o in settings.chat_extra_origins.split(",") if o.strip())
    return origin.rstrip("/") in allowed


# ---- screening ------------------------------------------------------------


@dataclass
class Screen:
    allowed: bool
    reply: str = ""
    reason: str = ""


GREETING_REPLY = (
    "Radio check — loud and clear. Ask me about Sepang's corners, tyre and pit "
    "strategy, this weekend's sessions, the grid, or getting to the circuit."
)
OFF_TOPIC_REPLY = (
    "That's outside what I cover. I'm the race engineer for this app: Formula 1, "
    "Sepang International Circuit, this race weekend, the app's own pages, and "
    "getting to the track. Try asking about one of those."
)
INJECTION_REPLY = (
    "I can't change how I work or share my instructions. Happy to help with "
    "Formula 1, Sepang, strategy or the race weekend, though."
)

_GREETING_RE = re.compile(
    r"^\s*(hi|hey|hello|yo|hiya|helo|halo|hai|selamat\s+\w+|good\s+(morning|afternoon|evening)|"
    r"radio\s+check|test(ing)?|ping|sup|what'?s\s+up)[\s!.?]*$",
    re.IGNORECASE,
)
_INJECTION_RE = re.compile(
    r"\b(ignore|disregard|forget)\s+(all|any|the|your|previous|prior|earlier|above)"
    r"(\s+(previous|prior|earlier|above))?\s+(instructions|prompts?|rules|directions)"
    r"|system\s+prompt|your\s+(instructions|prompt|rules)\b|developer\s+mode|jailbreak"
    r"|you\s+are\s+now\s+(a|an|my|in)\b|pretend\s+(to\s+be|you\s+are)|roleplay|role-play"
    r"|(reveal|print|show|repeat)\s+(me\s+)?(your|the)\s+(system\s+)?(prompt|instructions)",
    re.IGNORECASE,
)

# What a question about this app's subject matter tends to contain. Broad on
# purpose — a false refusal costs more goodwill than an extra model call.
_DOMAIN_WORDS = {
    "f1", "formula", "grand", "prix", "gp", "race", "racing", "raced", "races", "sepang", "malaysia",
    "malaysian", "bahrain", "circuit", "track", "corner", "corners", "turn", "turns", "hairpin",
    "straight", "lap", "laps", "sector", "pit", "pits", "pitstop", "stop", "stint", "tyre", "tyres",
    "tire", "tires", "compound", "soft", "medium", "hard", "inter", "inters", "intermediate", "wet",
    "wets", "slick", "slicks", "undercut", "overcut", "strategy", "safety", "vsc", "drs", "overtake",
    "overtaking", "aero", "downforce", "qualifying", "quali", "practice", "fp1", "fp2", "fp3",
    "sprint", "pole", "podium", "win", "winner", "wins", "won", "champion", "championship",
    "standings", "points", "driver", "drivers", "team", "teams", "constructor", "constructors",
    "car", "cars", "engine", "power", "unit", "regulation", "regulations", "rules", "fia", "grid",
    "weekend", "session", "sessions", "schedule", "weather", "rain", "raining", "forecast",
    "monsoon", "heat", "humid", "humidity", "temperature", "ticket", "tickets", "grandstand",
    "grandstands", "hillstand", "seat", "seats", "shuttle", "bus", "train", "klia", "erl",
    "parking", "park", "kl", "kuala", "lumpur", "transport", "travel", "hotel", "app", "page",
    "predict", "prediction", "picks", "telemetry", "lore", "guide", "calendar", "singapore",
    "irvine", "schumacher", "button", "speed", "braking", "brake", "throttle", "gear", "kerb",
    "kerbs", "apex", "fastest", "slowest", "pace", "time", "times", "delta", "penalty", "flag",
    "flags", "marshal", "paddock", "garage", "mechanic", "engineer", "radio", "box", "fuel",
    "battery", "energy", "harvest", "mclaren", "ferrari", "mercedes", "williams", "alpine", "haas",
    "audi", "cadillac", "aston", "martin", "bull", "bulls", "verstappen", "norris", "piastri",
    "leclerc", "hamilton", "russell", "antonelli", "alonso", "stroll", "gasly", "colapinto",
    "ocon", "bearman", "lawson", "lindblad", "sainz", "albon", "hulkenberg", "bortoleto", "perez",
    "bottas", "hadjar",
    # Bahasa Melayu, since the app ships in BM too.
    "litar", "perlumbaan", "lumba", "kereta", "pemandu", "pasukan", "tayar", "hujan", "cuaca",
    "tiket", "kelayakan", "latihan", "selekoh", "jadual", "pengangkutan", "perlawanan", "juara",
}
# The vocabulary above can't judge Chinese (the app's third language), so a
# question in a non-Latin script is left to the model's own topic rule.
_NON_LATIN_RE = re.compile(r"[\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af]")
_WORD_RE = re.compile(r"[a-z0-9]+")
# A retrieval score this strong means the corpus clearly speaks to the
# question even when none of the vocabulary above appears.
_STRONG_MATCH = 5.0


def screen(question: str, has_history: bool) -> Screen:
    if _INJECTION_RE.search(question):
        return Screen(False, INJECTION_REPLY, "injection")
    if _GREETING_RE.match(question):
        return Screen(False, GREETING_REPLY, "greeting")
    if has_history:
        return Screen(True)
    words = set(_WORD_RE.findall(question.lower()))
    if words & _DOMAIN_WORDS or _NON_LATIN_RE.search(question):
        return Screen(True)
    hits = knowledge_base.search(question, limit=1)
    if hits and hits[0].score >= _STRONG_MATCH:
        return Screen(True)
    return Screen(False, OFF_TOPIC_REPLY, "off_topic")


# ---- answer cache ---------------------------------------------------------------


@dataclass
class CachedAnswer:
    source_ids: list[str]
    text: str
    stored_at: float


@dataclass
class AnswerCache:
    ttl_s: float = 900
    max_entries: int = 200
    _items: OrderedDict[str, CachedAnswer] = field(default_factory=OrderedDict)

    @staticmethod
    def key(question: str) -> str:
        return " ".join(_WORD_RE.findall(question.lower()))

    def get(self, question: str, now: float | None = None) -> CachedAnswer | None:
        now = time.monotonic() if now is None else now
        k = self.key(question)
        item = self._items.get(k)
        if item is None:
            return None
        if now - item.stored_at > self.ttl_s:
            del self._items[k]
            return None
        self._items.move_to_end(k)
        return item

    def put(self, question: str, source_ids: list[str], text: str, now: float | None = None) -> None:
        if not text.strip():
            return
        now = time.monotonic() if now is None else now
        k = self.key(question)
        self._items[k] = CachedAnswer(source_ids, text, now)
        self._items.move_to_end(k)
        while len(self._items) > self.max_entries:
            self._items.popitem(last=False)

    def clear(self) -> None:
        self._items.clear()


answers = AnswerCache()
