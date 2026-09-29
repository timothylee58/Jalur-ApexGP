import type { Dictionary } from "../types";

export const en: Dictionary = {
  nav: {
    predict: "Predict",
    picks: "Picks",
    circuit: "Circuit",
    accuracy: "Accuracy",
    drivers: "Drivers",
    teams: "Teams",
    fan: "Fan",
    news: "News",
    telemetry: "Telemetry",
    drive: "Drive",
    reveal: "Reveal",
    lore: "Lore",
    guide: "Guide",
    seats: "Seats",
    calendar: "Calendar",
  },
  header: {
    primaryNav: "Primary",
    scrollBack: "Scroll menu back",
    scrollForward: "Scroll menu forward",
    language: "Language",
    machineTranslated: "BM and 中文 are machine-translated.",
  },
  hero: {
    pickSession: "Pick a session",
    next: "Next up",
    live: "Live",
    runStrategy: "Run strategy for {session}",
    sessionNames: {
      FP1: "Practice 1",
      FP2: "Practice 2",
      FP3: "Practice 3",
      Quali: "Qualifying",
      Race: "Grand Prix",
    },
    weekdays: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
    months: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
    dateFormat: "{weekday} {day} {month}",
    links: {
      circuit: "Corner-by-corner 3D",
      accuracy: "Prediction accuracy",
      lore: "Circuit lore",
      tickets: "Tickets & seating",
      flyover: "3D flyover",
      lapVideo: "Lap video",
    },
  },
  guide: {
    kicker: "New to F1?",
    title: "The rules, plainly",
    intro:
      "Six current-season rules explained in plain English, then a quiz to test what stuck. Every fact here is checked against real sources — including F1's 2026 rule changes, not last decade's.",
    quizLabel: "Rookie quiz",
    disclaimer:
      "Jalur APEXGP is an independent fan project — not affiliated with, endorsed by, or an official partner of Formula 1, the FIA, or Sepang International Circuit.",
    cards: [
      {
        id: "overtake-mode",
        title: "Overtake Mode (DRS's replacement)",
        body: "DRS — the single rear-wing flap a chasing car could open — was retired after 2025. From 2026 every car has active aero instead: on designated straights both the front and rear wings flatten (Straight Mode), then close again for the corners. The overtaking help is now electrical. A driver within one second of the car ahead at the detection point unlocks Overtake Mode for the next lap — extra battery energy, and full electric power held to a higher speed than the car in front, spent in one burst or spread around the lap.",
      },
      {
        id: "tyre-compounds",
        title: "Tyre compounds",
        body: 'Pirelli brings five dry compounds each season, C1 (hardest) through C5 (softest), and picks three for each race weekend — labelled Hard (white sidewall), Medium (yellow), and Soft (red) for that event only. "Soft" at one track can be a physically harder compound than "Soft" at another; the letters are relative to that weekend\'s selection, not a fixed rubber recipe.',
      },
      {
        id: "flags",
        title: "Flags",
        body: "Yellow: slow down, no overtaking — a hazard ahead. Red: the session is stopped entirely. Blue: a lapped car is told to let a faster one through. Chequered: the session is over.",
      },
      {
        id: "pit-strategy",
        title: "Undercut vs. overcut",
        body: "An undercut pits before the car you're chasing — fresh tyres are faster for a few laps, so you can jump ahead once they finally stop. An overcut is the opposite: stay out on older tyres while rivals pit, betting that clean air beats their slower out-lap.",
      },
      {
        id: "safety-car",
        title: "Safety car",
        body: "Neutralises the race after an incident — the field bunches up behind it at reduced speed, so a pit stop taken under it costs far less time than one taken at full racing speed. Teams that catch a safety car at the right moment often gain positions for close to free.",
      },
      {
        id: "ers",
        title: "ERS (Energy Recovery System)",
        body: "The hybrid half of a 2026 power unit — roughly half the car's power is now electric. The MGU-K turns the car's speed into charge under braking (the exhaust-heat MGU-H was dropped for 2026), stores it in the battery, and gives it back as extra power on demand. Drivers and engineers manage how much to save across a lap for a defensive move or an attacking one later on.",
      },
    ],
    demos: {
      "overtake-mode": {
        steps: [
          "Within 1 s of the car ahead at the detection point — Overtake Mode is unlocked for the next lap.",
          "Straight Mode: on the straight, every car flattens its front and rear wings.",
          "Overtake Mode's extra electric power gets the chaser by.",
        ],
        labels: { detection: "Detection", straight: "Straight mode", overtake: "Overtake" },
      },
      "tyre-compounds": {
        steps: [
          "A tough, high-wear track: Pirelli brings C1, C2 and C3 as the Hard, Medium and Soft.",
          "A low-grip street track: C3, C4 and C5 — the same C3 is now the Hard.",
        ],
        labels: { hard: "Hard", medium: "Medium", soft: "Soft" },
      },
      flags: {
        steps: [
          "Yellow: hazard ahead — slow down, no overtaking.",
          "Red: the session is stopped.",
          "Blue: a lapped car must let the faster one through.",
          "Chequered: the session is over.",
        ],
        labels: {},
      },
      "pit-strategy": {
        steps: [
          "You're a second behind. Pit first…",
          "…and fresh tyres make you seconds a lap quicker.",
          "When your rival stops, they come out behind you.",
        ],
        altSteps: [
          "Your rival pits first — and rejoins on cold tyres, in traffic.",
          "You stay out in clean air and keep lapping fast.",
          "Pit a lap later and come out ahead.",
        ],
        labels: {
          undercut: "Undercut",
          overcut: "Overcut",
          you: "You",
          rival: "Rival",
          pit: "Pit",
          fresh: "Fresh tyres",
          cleanAir: "Clean air",
          cold: "Cold tyres",
        },
      },
      "safety-car": {
        steps: [
          "Racing: the field is spread out, seconds apart.",
          "Safety car: everyone slows and closes up behind it.",
          "A pit stop now costs about half the usual time.",
        ],
        labels: { sc: "SC", green: "Normal stop", underSc: "Under SC", pitLoss: "Time lost in the pits" },
      },
      ers: {
        steps: [
          "Braking: the MGU-K turns the car's speed into charge.",
          "On the straight, the battery gives it back as power.",
        ],
        labels: { battery: "Battery", harvest: "Harvest", deploy: "Deploy" },
      },
    },
    demoUi: {
      pause: "Pause",
      play: "Play",
      step: "Step {n}",
      example: "{title} — animated example",
    },
    quiz: [
      {
        id: "points-win",
        question: "How many championship points does a race win score?",
        options: ["10", "20", "25", "30"],
        correctIndex: 2,
        explanation: "25 for first, scaling down to 1 point for tenth (18-15-12-10-8-6-4-2-1).",
      },
      {
        id: "fastest-lap-point",
        question: "Is there still a bonus point for the race's fastest lap?",
        options: [
          "Yes, if you finish in the top 10",
          "No — abolished after the 2024 season",
          "Yes, for anyone on track",
          "Only in sprint races",
        ],
        correctIndex: 1,
        explanation:
          "The fastest-lap bonus point was dropped from the 2025 season onward — finishing position is the only way to score now.",
      },
      {
        id: "drs-replacement",
        question: "What replaced DRS for the 2026 season?",
        options: [
          "Nothing — DRS is unchanged",
          "Overtake Mode — extra electric power for a car within one second",
          "A bigger rear-wing flap for every car",
          "Sprint-only DRS",
        ],
        correctIndex: 1,
        explanation:
          "Within one second of the car ahead at the detection point, a driver gets Overtake Mode for the next lap: extra battery energy and full power to a higher speed. The flattening wings (Straight Mode) are a separate system every car uses on the straights.",
      },
      {
        id: "mandatory-compounds",
        question: "In a dry race, how many different tyre compounds must a driver use?",
        options: ["1", "2", "3", "None — it's optional"],
        correctIndex: 1,
        explanation:
          "At least two different dry compounds are mandatory in a dry race, which guarantees at least one pit stop.",
      },
      {
        id: "yellow-flag",
        question: "What does a yellow flag mean?",
        options: ["Race finished", "Let a faster car past", "Slow down, no overtaking — hazard ahead", "Pit now"],
        correctIndex: 2,
        explanation: "Yellow is a caution: slow down and don't overtake until you're past the hazard.",
      },
      {
        id: "safety-car-effect",
        question: "What does a safety car do to the field?",
        options: [
          "Ends the session",
          "Bunches everyone up behind it at reduced speed",
          "Adds a mandatory pit stop",
          "Only slows the leader",
        ],
        correctIndex: 1,
        explanation:
          "It neutralises the race — the field closes up behind it, which is why pit stops taken under it cost so much less time.",
      },
      {
        id: "softest-compound",
        question: "Which is the softest tyre compound?",
        options: ["C1", "C3", "C5", "They're all equally soft"],
        correctIndex: 2,
        explanation: "C1 is the hardest of the five-compound range, C5 the softest.",
      },
      {
        id: "undercut-def",
        question: 'What\'s an "undercut"?',
        options: [
          "Staying out longer than your rival",
          "Pitting before your rival for fresher, faster tyres",
          "A type of kerb",
          "Overtaking under a safety car",
        ],
        correctIndex: 1,
        explanation:
          "Pit first, and the new tyres' extra pace can be enough to jump the rival once they finally stop themselves.",
      },
      {
        id: "sprint-points",
        question: "How many finishers score points in an F1 sprint race?",
        options: ["Top 3", "Top 8", "Top 10", "Everyone who finishes"],
        correctIndex: 1,
        explanation: "Sprints pay the top 8 finishers, 8-7-6-5-4-3-2-1 — a shorter scale than the full race's top 10.",
      },
      {
        id: "sepang-length",
        question: "How long is one lap of Sepang International Circuit?",
        options: ["3.4 km", "4.8 km", "5.543 km", "6.2 km"],
        correctIndex: 2,
        explanation: "5.543 km, 15 corners — the same figures behind every circuit map and stat on this site.",
      },
    ],
  },
  quizUi: {
    questionOf: "Question {current} / {total}",
    score: "Score",
    correct: "Correct. ",
    notQuite: "Not quite. ",
    correctSuffix: " — Correct",
    yourAnswerSuffix: " — Your answer",
    nextQuestion: "Next question",
    seeResults: "See results",
    quizComplete: "Quiz complete",
    cleanSweep: "Clean sweep — you know your current rulebook.",
    tryAgain: "Give it another lap — every question's explanation stays up after you answer.",
    playAgain: "Play again",
  },
};
