/**
 * Splits a full racer name into display parts.
 *
 * The first word is treated as the given name (displayed larger/bolder),
 * and everything after the first word is treated as the family/surname portion
 * (displayed smaller). This correctly handles:
 *   "Alice"           → { first: "Alice",   last: "" }
 *   "Alice Kim"       → { first: "Alice",   last: "Kim" }
 *   "Mary Jane Kim"   → { first: "Mary",    last: "Jane Kim" }
 *   "José Luis García"→ { first: "José",    last: "Luis García" }
 */
export function splitName(full: string): { first: string; last: string } {
  const trimmed = (full ?? '').trim();
  const spaceIdx = trimmed.indexOf(' ');
  if (spaceIdx === -1) return { first: trimmed, last: '' };
  return {
    first: trimmed.slice(0, spaceIdx),
    last: trimmed.slice(spaceIdx + 1),
  };
}
