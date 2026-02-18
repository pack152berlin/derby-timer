const PLACE_BY_PUNCTUATION: Record<string, number> = {
  "!": 1,
  '"': 2,
  "#": 3,
  "$": 4,
  "%": 5,
  "&": 6,
  "'": 7,
  "\u201c": 2,
  "\u201d": 2,
};

const LANE_TIME_PATTERN = /([A-F])\s*=\s*([0-9]+(?:\.[0-9]{1,5})?)([!"#$%&'\u201c\u201d]?)/gi;

export type LaneLetter = "A" | "B" | "C" | "D" | "E" | "F";

export type LaneTiming = {
  laneLetter: LaneLetter;
  laneNumber: number;
  timeSeconds: number;
  place?: number;
  placeIndicator?: string;
};

export type ParsedRaceDataLine = {
  rawLine: string;
  laneResults: LaneTiming[];
};

export type ParseRaceDataLineOptions = {
  maxLaneCount?: number;
};

const normalizePlaceIndicator = (indicator?: string) => {
  if (!indicator) return undefined;
  if (indicator === "\u201c" || indicator === "\u201d") return '"';
  return indicator;
};

const laneLetterToNumber = (laneLetter: LaneLetter) => {
  return laneLetter.charCodeAt(0) - 64;
};

const derivePlacesFromTimes = (laneResults: LaneTiming[]): LaneTiming[] => {
  const alreadyHasPlace = laneResults.some((lane) => lane.place !== undefined);
  if (alreadyHasPlace) {
    return laneResults;
  }

  const ranked = [...laneResults].sort((left, right) => {
    if (left.timeSeconds === right.timeSeconds) {
      return left.laneNumber - right.laneNumber;
    }
    return left.timeSeconds - right.timeSeconds;
  });

  const placeByLane = new Map<LaneLetter, number>();
  ranked.forEach((lane, index) => {
    placeByLane.set(lane.laneLetter, index + 1);
  });

  return laneResults.map((lane) => {
    const derivedPlace = placeByLane.get(lane.laneLetter);
    return {
      ...lane,
      place: derivedPlace,
    };
  });
};

export const parseRaceDataLine = (
  line: string,
  options: ParseRaceDataLineOptions = {}
): ParsedRaceDataLine | null => {
  const maxLaneCount = options.maxLaneCount ?? 6;
  const cleanedLine = line.replace(/\u0000/g, "").trim();
  if (cleanedLine.length === 0) {
    return null;
  }

  const laneResults: LaneTiming[] = [];
  const lanePattern = new RegExp(LANE_TIME_PATTERN.source, LANE_TIME_PATTERN.flags);
  let match: RegExpExecArray | null = lanePattern.exec(cleanedLine);

  while (match !== null) {
    const laneLetter = match[1]?.toUpperCase() as LaneLetter | undefined;
    const timeLiteral = match[2];
    const indicator = normalizePlaceIndicator(match[3]);

    if (!laneLetter || !timeLiteral) {
      match = lanePattern.exec(cleanedLine);
      continue;
    }

    const laneNumber = laneLetterToNumber(laneLetter);
    if (laneNumber > maxLaneCount) {
      match = lanePattern.exec(cleanedLine);
      continue;
    }

    const timeSeconds = Number.parseFloat(timeLiteral);
    if (!Number.isFinite(timeSeconds)) {
      match = lanePattern.exec(cleanedLine);
      continue;
    }

    laneResults.push({
      laneLetter,
      laneNumber,
      timeSeconds,
      placeIndicator: indicator,
      place: indicator ? PLACE_BY_PUNCTUATION[indicator] : undefined,
    });

    match = lanePattern.exec(cleanedLine);
  }

  if (laneResults.length === 0) {
    return null;
  }

  laneResults.sort((left, right) => left.laneNumber - right.laneNumber);

  return {
    rawLine: cleanedLine,
    laneResults: derivePlacesFromTimes(laneResults),
  };
};
