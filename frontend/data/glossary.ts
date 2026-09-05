/**
 * Plain-English F1 strategy glossary. Keys are lowercase match phrases; the app
 * auto-annotates the strategy reasoning copy (see components/shared/GlossaryText)
 * so beginners can tap any jargon term for a Sepang-flavoured explanation.
 */
export interface GlossaryEntry {
  label: string;
  definition: string;
}

export const glossary: Record<string, GlossaryEntry> = {
  undercut: {
    label: "Undercut",
    definition:
      "Pitting for fresh tyres before the car you're chasing. The new rubber is faster for a few laps, so you can jump ahead when they finally stop.",
  },
  overcut: {
    label: "Overcut",
    definition:
      "The opposite of an undercut — staying out longer on old tyres while rivals pit, betting your clear track is faster than their out-laps.",
  },
  "pit window": {
    label: "Pit window",
    definition:
      "The band of laps where stopping makes the most sense — late enough to get life out of the tyres, early enough before they fall off a cliff.",
  },
  stint: {
    label: "Stint",
    definition: "A run of laps on one set of tyres, from leaving the pits to the next stop.",
  },
  "one-stop": {
    label: "One-stop",
    definition:
      "A race plan with a single pit stop — usually more durable compounds and a longer first stint.",
  },
  offset: {
    label: "Offset",
    definition:
      "Running a different tyre or pit timing than the cars around you, so you're on fresher rubber when they aren't (or vice versa).",
  },
  deg: {
    label: "Deg (degradation)",
    definition:
      "How quickly a tyre loses grip as it wears. Sepang's abrasive, hot surface makes deg — especially on the rear tyres — a defining factor.",
  },
  degradation: {
    label: "Degradation",
    definition:
      "How quickly a tyre loses grip as it wears. Sepang's abrasive, hot surface makes deg — especially on the rear tyres — a defining factor.",
  },
  drs: {
    label: "DRS",
    definition:
      "Drag Reduction System — a movable rear-wing flap that opens on the straights when you're within one second of the car ahead, boosting top speed to help overtaking.",
  },
  slicks: {
    label: "Slicks",
    definition: "Smooth dry-weather tyres (Soft/Medium/Hard) with no grooves — fastest, but useless once it rains.",
  },
  "safety car": {
    label: "Safety car",
    definition:
      "A car that neutralises the race behind it after an incident. The field bunches up, so pitting loses much less time — a cheap moment to stop.",
  },
  "track evolution": {
    label: "Track evolution",
    definition:
      "The track getting faster through a session as rubber is laid down and dust is cleared — qualifying laps often come alive at the very end.",
  },
  "out-lap": {
    label: "Out-lap",
    definition: "The lap straight out of the pits, warming up tyres and brakes before a flying (timed) lap.",
  },
  "lift-and-coast": {
    label: "Lift-and-coast",
    definition:
      "Lifting off the throttle before braking to save fuel and cool the tyres and brakes, trading a little lap time for durability.",
  },
  "heat soak": {
    label: "Heat soak",
    definition:
      "Heat building up in the tyres (and brakes) faster than it can escape — a constant risk in Malaysia's tropical conditions.",
  },
  compound: {
    label: "Compound",
    definition:
      "The rubber recipe of a tyre. Softer compounds grip harder but wear out faster; harder ones last longer but are slower.",
  },
  intermediate: {
    label: "Intermediate",
    definition: "A grooved tyre for a damp or drying track — between slicks and full wets.",
  },
};

// Longest phrases first so multi-word terms win over their single-word parts.
export const glossaryPhrases = Object.keys(glossary).sort((a, b) => b.length - a.length);
