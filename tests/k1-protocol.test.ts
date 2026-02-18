import { describe, expect, it } from "bun:test";
import { parseRaceDataLine } from "../src/electronics/k1-protocol";

describe("K1 serial protocol parser", () => {
  it("parses lane timings with finish-order punctuation", () => {
    const line = 'A=3.001! B=3.043" C=3.120# D=3.250$';
    const parsed = parseRaceDataLine(line, { maxLaneCount: 4 });

    expect(parsed).not.toBeNull();
    expect(parsed?.laneResults.length).toBe(4);

    expect(parsed?.laneResults[0]).toEqual({
      laneLetter: "A",
      laneNumber: 1,
      timeSeconds: 3.001,
      placeIndicator: "!",
      place: 1,
    });

    expect(parsed?.laneResults[1]).toEqual({
      laneLetter: "B",
      laneNumber: 2,
      timeSeconds: 3.043,
      placeIndicator: '"',
      place: 2,
    });
  });

  it("normalizes curly quote punctuation for second place", () => {
    const line = "A=3.001! B=3.050\u201d C=3.200#";
    const parsed = parseRaceDataLine(line, { maxLaneCount: 3 });

    expect(parsed).not.toBeNull();
    expect(parsed?.laneResults[1]?.place).toBe(2);
    expect(parsed?.laneResults[1]?.placeIndicator).toBe('"');
  });

  it("derives places from time when punctuation is absent", () => {
    const line = "A=3.120 B=3.005 C=3.150 D=3.020";
    const parsed = parseRaceDataLine(line, { maxLaneCount: 4 });

    expect(parsed).not.toBeNull();
    expect(parsed?.laneResults.map((lane) => lane.place)).toEqual([3, 1, 4, 2]);
  });

  it("ignores lanes over the configured lane count", () => {
    const line = "A=3.120! B=3.130\" C=3.140# D=3.150$ E=3.160%";
    const parsed = parseRaceDataLine(line, { maxLaneCount: 4 });

    expect(parsed).not.toBeNull();
    expect(parsed?.laneResults.length).toBe(4);
    expect(parsed?.laneResults.some((lane) => lane.laneLetter === "E")).toBe(false);
  });

  it("returns null for non-race lines", () => {
    expect(parseRaceDataLine("K1 firmware V3.2 serial 8123", { maxLaneCount: 4 })).toBeNull();
    expect(parseRaceDataLine("RM 6 000011 0 0 0", { maxLaneCount: 4 })).toBeNull();
  });
});
