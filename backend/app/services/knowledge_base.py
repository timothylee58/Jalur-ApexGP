"""Retrieval corpus for the race-engineer assistant (`rag_service.py`).

Two deliberate choices worth stating up front.

WHY BM25 AND NOT EMBEDDINGS. This corpus is a few dozen short documents
about one circuit, one weekend and one app. At that size a lexical
ranker is not a compromise — F1 questions are dense with exactly the
rare, high-signal terms BM25 is best at ("undercut", "Genting", "T9",
"intermediate", "parc ferme"), and an embedding index would add an API
dependency, a build step and a vector store to rank the same 60
documents. Revisit this if the corpus ever grows past a few hundred
documents or starts covering paraphrase-heavy prose.

WHAT THIS IS NOT. There is no "official F1 database" to draw on — F1
does not publish an open API. What this app actually has is: its own
domain content (below), plus three real third-party feeds already wired
up elsewhere in the backend (Jolpica for results and standings, OpenF1
for historical telemetry, Open-Meteo for weather). `rag_service` mixes
live reads from those into the context at query time. The assistant is
told, in its system prompt, to say so rather than imply it is reading
from something official.

Documents are written for retrieval: one idea each, the distinctive
term in the title as well as the body, and no cross-references that
only make sense with a neighbouring document also retrieved.
"""

from __future__ import annotations

import math
import re
from collections import Counter
from dataclasses import dataclass, field

# BM25's standard parameters. k1 controls how fast term frequency
# saturates, b how much a long document is penalised for its length.
_K1 = 1.5
_B = 0.75

# Deliberately short. An aggressive stoplist hurts here — "the hairpin"
# and "hairpin" should rank alike, but dropping a word like "no" would
# flatten "no official shuttle" into "official shuttle".
_STOPWORDS = frozenset(
    "a an and are as at be by for from has have in is it its of on or "
    "that the to was were will with you your".split()
)

_TOKEN_RE = re.compile(r"[a-z0-9]+")


def tokenize(text: str) -> list[str]:
    """Lowercase word tokens, stopwords dropped. Digits are kept — "T9"
    and "2026" carry real meaning in this domain."""
    return [t for t in _TOKEN_RE.findall(text.lower()) if t not in _STOPWORDS]


@dataclass(frozen=True)
class Document:
    id: str
    title: str
    section: str
    body: str
    tags: tuple[str, ...] = ()

    @property
    def searchable(self) -> str:
        return f"{self.title} {' '.join(self.tags)} {self.body}"


@dataclass
class RetrievedDocument:
    document: Document
    score: float


@dataclass
class _Index:
    documents: list[Document]
    doc_tokens: list[list[str]] = field(default_factory=list)
    doc_freqs: list[Counter[str]] = field(default_factory=list)
    inverse_doc_freq: dict[str, float] = field(default_factory=dict)
    avg_len: float = 0.0

    def build(self) -> "_Index":
        self.doc_tokens = [tokenize(d.searchable) for d in self.documents]
        self.doc_freqs = [Counter(t) for t in self.doc_tokens]
        total = sum(len(t) for t in self.doc_tokens)
        self.avg_len = total / max(1, len(self.doc_tokens))

        n = len(self.documents)
        containing: Counter[str] = Counter()
        for tokens in self.doc_tokens:
            containing.update(set(tokens))
        # Standard BM25 IDF with the +1 smoothing that keeps a term
        # appearing in every document at a small positive weight rather
        # than a negative one.
        self.inverse_doc_freq = {
            term: math.log(1 + (n - count + 0.5) / (count + 0.5))
            for term, count in containing.items()
        }
        return self

    def search(self, query: str, limit: int) -> list[RetrievedDocument]:
        terms = tokenize(query)
        if not terms:
            return []

        scored: list[RetrievedDocument] = []
        for i, doc in enumerate(self.documents):
            freqs = self.doc_freqs[i]
            length = len(self.doc_tokens[i])
            score = 0.0
            for term in terms:
                tf = freqs.get(term, 0)
                if tf == 0:
                    continue
                idf = self.inverse_doc_freq.get(term, 0.0)
                denominator = tf + _K1 * (1 - _B + _B * length / max(1e-9, self.avg_len))
                score += idf * (tf * (_K1 + 1)) / denominator
            if score > 0:
                scored.append(RetrievedDocument(document=doc, score=score))

        scored.sort(key=lambda r: r.score, reverse=True)
        return scored[:limit]


# --- Corpus ---------------------------------------------------------------
# Circuit prose here is written for a conversational answer. The
# authoritative *numbers* for corner apex speeds live in the frontend's
# `lib/lapSim.ts` SEPANG_CORNER_REFERENCE, which drives /circuit's solved
# lap; if a figure below ever disagrees with that table, that table wins.

_CIRCUIT: list[Document] = [
    Document(
        id="circuit-overview",
        title="Sepang International Circuit overview",
        section="circuit",
        tags=("sepang", "layout", "length", "turns"),
        body=(
            "Sepang International Circuit is 5.543 km with 15 turns, run clockwise. "
            "It opened in 1999 and hosted the Malaysian Grand Prix until 2017. Its "
            "defining features are two long straights of roughly 900 m each running "
            "anti-parallel to one another, joined by the Turn 15 hairpin, and very "
            "wide track that supports side-by-side racing. Heat and humidity are a "
            "constant factor, and afternoon thunderstorms are common."
        ),
    ),
    Document(
        id="circuit-t1-t2",
        title="Sepang Turn 1 and Turn 2",
        section="circuit",
        tags=("t1", "t2", "turn 1", "turn 2", "braking", "overtaking"),
        body=(
            "Turn 1 is the circuit's biggest braking event: cars arrive at around "
            "330 km/h off the main straight and shed it down to roughly 90 km/h in "
            "second gear. It is a long, slow right-hander where speed is given up "
            "gradually rather than all at once, which makes it the main overtaking "
            "spot. Turn 2 follows immediately as a tight left hairpin that drops "
            "downhill, taken in third, with power back on from the exit kerb."
        ),
    ),
    Document(
        id="circuit-t3-t4",
        title="Sepang Turn 3 and Turn 4",
        section="circuit",
        tags=("t3", "t4", "turn 3", "turn 4"),
        body=(
            "Turn 3 is a medium-speed right that links the opening complex to the "
            "Turn 4 braking zone. Turn 4 is a second- or third-gear 90-degree right "
            "taken at about 120 km/h after hard braking, and getting a clean exit "
            "matters because the run to the Genting Curve follows."
        ),
    ),
    Document(
        id="circuit-genting",
        title="Genting Curve, Sepang Turns 5 and 6",
        section="circuit",
        tags=("t5", "t6", "genting", "turn 5", "turn 6", "high speed"),
        body=(
            "Turns 5 and 6 form the Genting Curve, a very high-speed long chicane "
            "taken around 260-275 km/h in seventh gear. It is one of the most "
            "physically demanding sections on the calendar: sustained lateral load "
            "through a long-duration corner, and it is hard on the left-hand tyres. "
            "Tyre degradation complaints at Sepang usually trace back through here."
        ),
    ),
    Document(
        id="circuit-klia",
        title="KLIA Curve, Sepang Turns 7 and 8",
        section="circuit",
        tags=("t7", "t8", "klia", "turn 7", "turn 8", "double apex"),
        body=(
            "Turns 7 and 8 are the KLIA Curve, a long medium-speed double-apex "
            "right taken around 190-205 km/h. A bump through the corner can unsettle "
            "the car mid-corner, and the outer half of the exit kerb slopes away, so "
            "running wide is punished rather than forgiven."
        ),
    ),
    Document(
        id="circuit-berjaya-tioman",
        title="Berjaya Tioman, Sepang Turn 9 hairpin",
        section="circuit",
        tags=("t9", "turn 9", "berjaya tioman", "hairpin", "slowest"),
        body=(
            "Turn 9, the Berjaya Tioman corner, is the slowest point on the circuit "
            "at roughly 75 km/h in second gear. It is an uphill left hairpin with a "
            "crest right at the apex, which unloads the car exactly where it is "
            "asked to turn and steps most cars sideways. It is also the reference "
            "point this app's strategy engine uses when talking about a wet-weather "
            "pit call, because the run to it is where a driver loses most time on "
            "the wrong tyre."
        ),
    ),
    Document(
        id="circuit-t10-t14",
        title="Sepang Turns 10 to 14, the final sector",
        section="circuit",
        tags=("t10", "t11", "t12", "t13", "t14", "final sector"),
        body=(
            "Turns 10 through 14 are a linked medium-speed sequence through the "
            "final sector, ranging from about 150 km/h to 235 km/h. Turn 14 is the "
            "one that matters most for lap time: it feeds the back straight, so "
            "exit speed there sets up the entire run down to the Turn 15 hairpin "
            "and any overtake at the end of it."
        ),
    ),
    Document(
        id="circuit-t15",
        title="Sepang Turn 15 hairpin",
        section="circuit",
        tags=("t15", "turn 15", "hairpin", "overtaking", "last corner"),
        body=(
            "Turn 15 is a second-gear left hairpin at the end of the back straight, "
            "taken at roughly 85 km/h. It is the second big overtaking opportunity "
            "on the lap, and a clean exit is worth more than usual because the main "
            "straight and the timing line follow immediately."
        ),
    ),
    Document(
        id="circuit-sectors",
        title="Sepang timing sectors",
        section="circuit",
        tags=("sector", "s1", "s2", "s3", "timing", "splits"),
        body=(
            "This app splits the lap into three timing sectors at the Turn 5 and "
            "Turn 11 apexes, which divides it into near-thirds: sector 1 covers the "
            "Turn 1 to Turn 4 opening complex, sector 2 the Genting and KLIA "
            "curves, and sector 3 the final sequence through the Turn 15 hairpin "
            "onto the main straight. The FIA does not publish its actual timing-loop "
            "positions, so these boundaries are derived from the layout, not "
            "official."
        ),
    ),
    Document(
        id="circuit-hot-lap-sim",
        title="How the simulated hot lap on the circuit page works",
        section="circuit",
        tags=("hot lap", "simulation", "lap time", "solver", "simulated"),
        body=(
            "The /circuit page shows a solved lap, not a recorded one. Apex speeds "
            "come from published circuit guides where one exists and are reasoned "
            "from the corner's character where one does not; between those apexes a "
            "quasi-steady-state solver works out acceleration (traction limited at "
            "low speed, power limited at high speed, minus drag) and braking, and "
            "the braking zones fall out of that rather than being drawn on by hand. "
            "It produces roughly a 1:24 lap. The real Sepang F1 race lap record is "
            "1:34.080, set by Lewis Hamilton in 2017. The simulation runs quick "
            "because the centreline it solves over spaces the corners further apart "
            "than they really are. No telemetry is involved and no real driver drove "
            "it."
        ),
    ),
]

_STRATEGY: list[Document] = [
    Document(
        id="strategy-engine",
        title="How the Jalur APEXGP strategy engine works",
        section="strategy",
        tags=("strategy", "prediction", "conservative", "aggressive", "confidence"),
        body=(
            "The /predict page blends a live weather read for the circuit with the "
            "selected session and returns two strategy reads: a conservative one and "
            "an aggressive one. Each carries a confidence percentage and a key-risk "
            "line. It is a documented heuristic, not a trained model — the reasoning "
            "it prints is the actual rule it applied, and the confidence number is "
            "part of the output rather than decoration. Treat a low confidence "
            "reading as the engine telling you the call is genuinely marginal."
        ),
    ),
    Document(
        id="strategy-what-if",
        title="The what-if simulator",
        section="strategy",
        tags=("what if", "simulator", "safety car", "rain", "temperature", "tyre"),
        body=(
            "The what-if controls on /predict let you override the live inputs: rain "
            "probability, track and air temperature, whether a safety car is "
            "deployed, and the starting tyre compound. Changing any of them "
            "re-runs the same strategy engine against your numbers instead of the "
            "live ones, so you can see how sensitive a call is before committing to "
            "it. A deployed safety car in particular collapses the cost of a pit "
            "stop, which is why it flips so many calls."
        ),
    ),
    Document(
        id="strategy-tyres",
        title="F1 tyre compounds",
        section="strategy",
        tags=("tyre", "tire", "compound", "soft", "medium", "hard", "intermediate", "wet", "pirelli"),
        body=(
            "Pirelli supplies three dry compounds at each round — soft (red "
            "sidewall), medium (yellow) and hard (white) — plus two wet-weather "
            "compounds, intermediate (green) and full wet (blue). The dry compounds "
            "are slicks with no tread pattern at all; only the intermediate and the "
            "full wet carry grooves, and the full wet's are deeper and denser. "
            "Softer compounds give more grip and wear out faster. At Sepang, heat "
            "and the sustained load through the Genting Curve push most teams "
            "toward the harder end of the range."
        ),
    ),
    Document(
        id="strategy-undercut",
        title="Undercut and overcut",
        section="strategy",
        tags=("undercut", "overcut", "pit stop", "pit window", "track position"),
        body=(
            "An undercut means pitting before the car you are racing and using the "
            "immediate pace of fresh tyres to be ahead when they come out. An "
            "overcut is the opposite: staying out longer, hoping their out-lap and "
            "your clear track let you jump them instead. Undercuts work best where "
            "fresh tyres switch on quickly and the pit loss is low; overcuts work "
            "when traffic or tyre warm-up would spoil the out-lap."
        ),
    ),
    Document(
        id="strategy-safety-car",
        title="Why a safety car changes strategy",
        section="strategy",
        tags=("safety car", "vsc", "pit stop", "free stop"),
        body=(
            "Under a safety car the field slows and bunches up, so the time lost by "
            "driving through the pit lane is much smaller than at racing speed. That "
            "makes a stop dramatically cheaper — often called a cheap or free stop — "
            "and it is why a safety car at the wrong moment can destroy a strategy "
            "that was working, and why teams that had already stopped lose out."
        ),
    ),
    Document(
        id="strategy-weather",
        title="Sepang weather and race strategy",
        section="strategy",
        tags=("weather", "rain", "monsoon", "thunderstorm", "humidity", "tropical"),
        body=(
            "Sepang sits in a tropical climate with high heat, high humidity and "
            "frequent, fast-arriving afternoon thunderstorms. Rain there tends to be "
            "heavy and localised rather than a steady drizzle, which makes the "
            "timing of a switch to intermediates or full wets the single highest-"
            "leverage decision of the weekend. The 2009 Malaysian Grand Prix was "
            "red-flagged and awarded half points after a storm. This app's weather "
            "read comes from Open-Meteo, a real forecast API."
        ),
    ),
]

_WEEKEND: list[Document] = [
    Document(
        id="weekend-format",
        title="The 2026 Sepang race weekend in this app",
        section="weekend",
        tags=("schedule", "weekend", "fp1", "fp2", "fp3", "qualifying", "race", "2026"),
        body=(
            "This app is built around a fictional 2026 Formula 1 race weekend at "
            "Sepang on 2-4 October 2026, with the usual format: three practice "
            "sessions, qualifying, and the race. Formula 1 has not announced a "
            "return to Malaysia — the weekend is the app's premise, not a "
            "prediction, and everything tied to it should be read that way. Real "
            "data feeds in the app are labelled as such and point at real sessions "
            "elsewhere on the calendar."
        ),
    ),
    Document(
        id="weekend-singapore",
        title="Singapore Grand Prix 2026 and the regional calendar",
        section="weekend",
        tags=("singapore", "marina bay", "calendar", "sprint", "regional", "travel"),
        body=(
            "The real Singapore Grand Prix runs 9-11 October 2026 at the Marina Bay "
            "Street Circuit, and it is Singapore's first Formula 1 Sprint weekend. "
            "It falls five days after this app's fictional Sepang weekend ends, "
            "which is why the /calendar page pairs them: by road the two circuits "
            "are roughly 305-341 km apart depending on the route, about three and a "
            "half to four hours. The Singapore round is real; the Sepang one is not."
        ),
    ),
    Document(
        id="weekend-quali",
        title="How F1 qualifying works",
        section="weekend",
        tags=("qualifying", "q1", "q2", "q3", "grid", "pole"),
        body=(
            "Qualifying runs in three parts. Q1 is 18 minutes and eliminates the "
            "five slowest cars. Q2 is 15 minutes and eliminates five more. Q3 is 12 "
            "minutes and decides the top ten, with the fastest lap taking pole "
            "position. Each driver's best single lap in their final segment sets "
            "their grid slot."
        ),
    ),
    Document(
        id="weekend-parc-ferme",
        title="Parc ferme",
        section="weekend",
        tags=("parc ferme", "regulations", "setup", "rules"),
        body=(
            "Parc ferme conditions come into force when qualifying begins. From that "
            "point teams may not change the car's setup before the race except "
            "within a narrow permitted list. Breaking parc ferme — to change a wing "
            "setting after seeing the forecast, for instance — means starting from "
            "the pit lane. It is why a team's qualifying setup is partly a bet on "
            "race conditions."
        ),
    ),
    Document(
        id="weekend-drs",
        title="DRS, the Drag Reduction System",
        section="weekend",
        tags=("drs", "overtaking", "rear wing", "detection"),
        body=(
            "DRS opens a flap in the rear wing to cut drag and raise straight-line "
            "speed. A driver may use it only in a designated activation zone, and "
            "only if they were within one second of the car ahead at the detection "
            "point before that zone. It exists to make overtaking possible, and at a "
            "circuit with two long straights like Sepang it matters a great deal."
        ),
    ),
]

_APP: list[Document] = [
    Document(
        id="app-what-it-is",
        title="What Jalur APEXGP is",
        section="app",
        tags=("about", "app", "independent", "unofficial", "official", "fan project"),
        body=(
            "Jalur APEXGP is an independent fan project — a race engineer's read on "
            "a Sepang weekend. It is not official: not affiliated with, licensed by, "
            "or endorsed by Formula 1, the FIA, FOM, any team, or Sepang "
            "International Circuit, and it does not sell tickets. It is built as a "
            "portfolio project: a Next.js frontend and a FastAPI backend, with real "
            "third-party data feeds where real data exists and clear labelling "
            "where it does not."
        ),
    ),
    Document(
        id="app-pages",
        title="What each page in the app does",
        section="app",
        tags=("pages", "navigation", "predict", "picks", "circuit", "telemetry", "tickets"),
        body=(
            "/predict runs the strategy engine and the what-if simulator. /circuit "
            "shows the simulated hot lap with braking zones, apex speeds and sector "
            "splits. /picks is a podium-prediction game with a leaderboard. "
            "/telemetry replays a real historical session. /drivers and /teams cover "
            "the 2026 grid. /guide teaches F1 basics and has a quiz, and is "
            "available in English, Bahasa Malaysia and Chinese. /calendar covers the "
            "regional race calendar. /tickets covers seating and getting to the "
            "circuit. /accuracy tracks how the predictions actually did."
        ),
    ),
    Document(
        id="app-data-sources",
        title="Where this app's data actually comes from",
        section="app",
        tags=("data", "sources", "openf1", "jolpica", "open-meteo", "api", "official"),
        body=(
            "Formula 1 does not publish an open public API, so nothing here comes "
            "from an official F1 source. Results, standings and the schedule come "
            "from Jolpica, an open-source Ergast-compatible community API. "
            "Historical telemetry comes from OpenF1, another independent community "
            "project — free and keyless for historical data only, with no live "
            "stream. Weather comes from Open-Meteo. Public transit toward the "
            "circuit comes from Malaysia's government open-data GTFS feeds at "
            "data.gov.my. None of these are official F1, FIA or FOM products."
        ),
    ),
    Document(
        id="app-telemetry-gap",
        title="Why the telemetry is from another race",
        section="app",
        tags=("telemetry", "openf1", "live", "historical", "zandvoort"),
        body=(
            "The /telemetry page shows a real, clearly labelled historical session "
            "rather than pretending the app's fictional Sepang weekend has real "
            "data. OpenF1's live streaming needs a paid account this project does "
            "not use, so there is no live telemetry at all. Being explicit about "
            "that gap is deliberate."
        ),
    ),
    Document(
        id="app-picks",
        title="The race-day picks game",
        section="app",
        tags=("picks", "leaderboard", "prediction", "game", "score"),
        body=(
            "/picks is an anonymous podium-prediction game: no login, a browser-local "
            "participant id, and a shared leaderboard. Picks are scored once the "
            "round is classified. Because the id lives in the browser, clearing site "
            "data loses the link to a previous entry."
        ),
    ),
]

_TRAVEL: list[Document] = [
    Document(
        id="travel-getting-there",
        title="Getting to Sepang International Circuit",
        section="travel",
        tags=("travel", "transport", "klia", "kuala lumpur", "shuttle", "taxi", "parking"),
        body=(
            "The circuit sits near Kuala Lumpur International Airport, about an hour "
            "south of central Kuala Lumpur. It is fairly isolated: no scheduled "
            "RapidKL bus route has a stop at the circuit gate itself, so the last "
            "leg is taxi, e-hailing or private transport. Past Malaysian Grand Prix "
            "weekends ran dedicated charter shuttles from KL Sentral and KLCC, but "
            "those were event charters rather than standing routes, and no 2026 "
            "service has been announced. The app shows the nearest real scheduled "
            "service toward the Sepang and KLIA corridor instead."
        ),
    ),
    Document(
        id="travel-tickets",
        title="Tickets and grandstands at Sepang",
        section="travel",
        tags=("tickets", "grandstand", "seats", "hillstand", "main grandstand"),
        body=(
            "The /tickets page maps each grandstand and hillstand to its real "
            "position on the circuit and says which corners it overlooks, so you can "
            "pick a seat by what you want to watch rather than by price alone. The "
            "main grandstand covers the start, the pit lane and the run to Turn 1; "
            "stands toward the hairpins trade that for the best overtaking views. "
            "This app does not sell tickets and is not a ticketing agent."
        ),
    ),
    Document(
        id="travel-weather-advice",
        title="What to expect at the circuit as a spectator",
        section="travel",
        tags=("spectator", "heat", "humidity", "rain", "what to bring", "sun"),
        body=(
            "Expect heat in the low-to-mid thirties Celsius with high humidity, and "
            "a real chance of a heavy afternoon downpour. Sun protection, water and "
            "a poncho matter more here than at most circuits, and covered seating is "
            "worth paying for. Storms arrive quickly and can pass just as fast."
        ),
    ),
]

_BASICS: list[Document] = [
    Document(
        id="basics-points",
        title="How F1 championship points work",
        section="basics",
        tags=("points", "championship", "scoring", "standings"),
        body=(
            "The top ten finishers score points on a 25-18-15-12-10-8-6-4-2-1 scale. "
            "There are two championships decided by them: the drivers' championship, "
            "and the constructors' championship, which adds both of a team's cars "
            "together. Sprint races award points to the top eight on a smaller scale."
        ),
    ),
    Document(
        id="basics-pit-stop",
        title="What happens in an F1 pit stop",
        section="basics",
        tags=("pit stop", "tyre change", "pit lane", "time loss"),
        body=(
            "A modern F1 pit stop changes four tyres in around two to three seconds "
            "stationary. Refuelling has been banned since 2010. The real cost is not "
            "the stationary time but the total pit lane time loss — driving in, "
            "through the speed-limited lane, and back out — which is typically "
            "around twenty seconds and varies by circuit."
        ),
    ),
    Document(
        id="basics-flags",
        title="F1 flags and race control",
        section="basics",
        tags=("flag", "yellow", "red flag", "blue flag", "vsc", "race control"),
        body=(
            "A yellow flag means danger ahead and no overtaking. A red flag stops "
            "the session. A blue flag tells a driver being lapped to let the leaders "
            "through. A virtual safety car slows the whole field to a delta time "
            "without physically bunching it up, which makes a pit stop cheaper than "
            "normal but less cheap than under a full safety car."
        ),
    ),
    Document(
        id="basics-2026-regs",
        title="The 2026 Formula 1 regulations",
        section="basics",
        tags=("2026", "regulations", "power unit", "active aero", "rules change"),
        body=(
            "2026 brings a major regulation change. The power unit moves to a roughly "
            "50/50 split between internal combustion and electrical power with a much "
            "larger electrical deployment, runs on fully sustainable fuel, and drops "
            "the MGU-H. The cars are smaller and lighter with active aerodynamics, "
            "moveable front and rear wings that shift between low-drag and "
            "high-downforce modes. The grid expands to eleven teams with Cadillac "
            "joining, and Audi arrives via the Sauber operation."
        ),
    ),
]

DOCUMENTS: list[Document] = [*_CIRCUIT, *_STRATEGY, *_WEEKEND, *_APP, *_TRAVEL, *_BASICS]

_index = _Index(documents=DOCUMENTS).build()


def search(query: str, limit: int = 6) -> list[RetrievedDocument]:
    """Highest-scoring documents for a query, best first. An empty list is
    a legitimate answer for an off-topic question — `rag_service` passes
    that straight through so the assistant says it doesn't know rather
    than answering from whatever ranked least badly."""
    return _index.search(query, limit)


def document_by_id(doc_id: str) -> Document | None:
    return next((d for d in DOCUMENTS if d.id == doc_id), None)
