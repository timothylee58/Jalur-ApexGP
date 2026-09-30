import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { GET } from "@/app/og/route";
import { cleanText, parseOgCard } from "./ogCard";

const parse = (query: string) => parseOgCard(new URLSearchParams(query));

describe("parseOgCard", () => {
  it("reads a real share link", () => {
    const card = parse(
      "session=FP1&cc=74&ac=61&rain=50&temp=31&cond=Shower+risk&ct=Hard-Intermediate&at=Hard-Intermediate&ty=Hard",
    );
    expect(card).toMatchObject({
      session: "FP1",
      sessionName: "Free Practice 1",
      condition: "Shower risk",
      tempC: 31,
      rain: 50,
      safetyCar: false,
      startTyre: "Hard",
      stronger: "conservative",
    });
    expect(card.conservative.confidence).toBe(74);
    expect(card.conservative.stints.map((s) => s.compound)).toEqual(["Hard", "Intermediate"]);
  });

  it("only shows real sessions and compounds", () => {
    const card = parse("session=<script>&ct=Super-Medium-&at=hard-WET&ty=Banana");
    expect(card.session).toBe("Race");
    expect(card.conservative.stints.map((s) => s.compound)).toEqual(["Medium"]);
    expect(card.aggressive.stints.map((s) => s.compound)).toEqual(["Hard", "Wet"]);
    expect(card.startTyre).toBeNull();
  });

  it("clamps numbers and drops ones that aren't", () => {
    const card = parse("cc=abc&ac=250&rain=-5&temp=nope");
    expect(card.conservative.confidence).toBeNull();
    expect(card.aggressive.confidence).toBe(100);
    expect(card.rain).toBe(0);
    expect(card.tempC).toBeNull();
    expect(card.stronger).toBeNull();
  });

  it("calls no stronger read on a tie", () => {
    expect(parse("cc=58&ac=58").stronger).toBeNull();
    expect(parse("cc=58&ac=60").stronger).toBe("aggressive");
  });

  it("keeps at most four stints", () => {
    expect(parse("ct=Soft-Medium-Hard-Soft-Medium").conservative.stints).toHaveLength(4);
  });

  it("cleans free text down to plain characters and a length cap", () => {
    expect(cleanText("  Heavy\nrain <b>likely</b>  ", 40)).toBe("Heavy rain b likely /b");
    expect(cleanText("x".repeat(50), 10)).toBe(`${"x".repeat(9)}…`);
    expect(cleanText(null, 10)).toBe("");
  });
});

describe("GET /og", () => {
  // The renderer rejects some markup only at render time (the crash this
  // guards against: a multi-child element without display:flex, reached
  // only when a starting tyre was set). Render every optional part on and
  // off, and junk, and require a PNG each time.
  const cases = [
    "session=FP1&cc=74&ac=61&rain=50&temp=31&cond=Shower+risk&ct=Hard-Intermediate&at=Hard-Intermediate&ty=Hard",
    "session=Race&cc=58&ac=58&rain=85&temp=27&cond=Heavy+rain&ct=Intermediate-Wet-Intermediate-Medium&at=Wet-Intermediate&sc=1&ty=Wet",
    "session=Quali&cc=81&ac=66&ct=Medium-Hard&at=Soft-Medium&sc=1",
    "",
    "session=%3Cscript%3E&cc=abc&ac=250&rain=-5&temp=nope&ct=Super-&at=&ty=Banana&sc=2",
  ];

  it.each(cases)("renders %#", async (query) => {
    const response = await GET(new NextRequest(`http://localhost/og?${query}`));
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/png");
    const bytes = new Uint8Array(await response.arrayBuffer());
    expect([...bytes.slice(1, 4)].map((b) => String.fromCharCode(b)).join("")).toBe("PNG");
  }, 30000);
});
