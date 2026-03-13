# Race Day Edge Cases Plan

How the software should handle common real-world problems at pinewood derby events.

## 1. Late Entries

**Problem:** A racer shows up after registration closes and heats are already generated.

**Current behavior:** No way to add a racer once heats exist without deleting all heats and regenerating.

**Proposed:**
- Allow adding a racer while racing is in progress
- Regenerate only the remaining (unraced) heats to include the new racer
- Completed heats and their results are preserved
- Show a confirmation: "Adding Tommy will regenerate 47 remaining heats. 12 completed heats are unaffected."
- The late racer won't have results for already-completed heats, so their stats will reflect fewer races — that's fair and expected

**Edge within the edge:** Two late entries at different times. Each addition triggers a regeneration of remaining heats. The system must handle multiple regenerations cleanly.

## 2. No-Shows / Withdrawals

**Problem:** A registered racer never shows up, or leaves early (sick kid, broken car beyond repair). Their empty lanes waste time and distort the schedule.

**Current behavior:** The racer stays in all heats. Their lanes run empty (or the heat is skipped manually outside the software).

**Proposed:**
- Add a "Withdraw" action on a racer (distinct from deleting them)
- Withdrawn racers are removed from all future unraced heats
- Remaining heats are regenerated to fill the gap
- Completed results for the withdrawn racer are preserved (they raced those heats fairly)
- Withdrawn racers appear in standings with a "WD" marker but don't receive awards
- Standings can optionally hide withdrawn racers

**UX:** A confirmation dialog: "Withdraw Alex? They'll be removed from 35 remaining heats. Their 5 completed results are kept."

## 3. Broken Cars Mid-Race

**Problem:** A wheel falls off, an axle bends, or the car splits apart during a heat. The race must pause for a repair decision.

**Current behavior:** The operator can mark the lane as DNF. No re-run support. No repair timer.

**Proposed:**
- **DNF is already handled** — keep this as the quick path
- Add a "Re-run Heat" action that voids the current heat's results and re-queues it as the next heat
- Optional: if the broken car interfered with another car's lane, the re-run is mandatory (flag this)
- Track breakdown count per racer — surface a warning on the second breakdown ("2nd breakdown for Car #17 — consider DQ per your pack's rules")
- The re-run heat uses the same lane assignments (fair to all racers in that heat)

**Not in scope:** Repair timers or countdown displays. That's a physical/procedural concern, not software.

## 4. Heat Re-Runs

**Problem:** A heat needs to be re-run due to broken cars, track problems, timing errors, or staging mistakes (wrong car in wrong lane). This is the single most common race-day disruption.

**Current behavior:** No way to void a completed heat or re-queue it.

**Proposed:**
- Add a "Void & Re-run" action on any completed heat
- Voided heats have their results cleared and status reset to pending
- The re-run heat is inserted as the next heat in the queue (not at the end)
- An audit note is attached: who voided it and why (free text)
- The voided heat's original results are soft-deleted (recoverable if voided by mistake)
- Standings are recalculated after voiding

**Edge case:** Voiding a heat that was the basis for a tiebreaker or award. The standings recalculation handles this automatically — no special logic needed.

## 5. Timing System Failures

**Problem:** The electronic timer gives wrong results, a sensor misaligns, USB drops, or the timer fails completely mid-event.

**Current behavior:** The app supports manual place entry (no timer integration yet). Times are optional.

**Proposed:**
- Since we already support manual placement entry, a full timer failure just means continuing without times — no software change needed
- If timer integration is added later:
  - Allow manual override of any individual lane time
  - Support switching between timed and untimed scoring mid-event (would require recalculating standings)
  - Flag anomalous times (e.g., a car suddenly 2x slower than its average — possible sensor error)
- **Lane masking:** If one lane's sensor is broken, allow disabling that lane and regenerating remaining heats to avoid it. This is a significant feature — defer until timer integration exists.

## 6. Staging Errors (Wrong Car in Wrong Lane)

**Problem:** A volunteer places Car #12 in Lane 3 instead of Lane 2. The heat runs with cars in the wrong lanes. Results are recorded against the wrong lane assignments.

**Current behavior:** No way to detect or correct this. The results are recorded as-is.

**Proposed:**
- The primary defense is a clear "On Deck" display showing car numbers per lane (we have this via the heat card display and the external display)
- If caught after the heat runs: use "Void & Re-run" (see section 4)
- If caught during result entry: the operator can simply not record results and re-run
- Future: a "Swap Lanes" action that corrects lane assignments on a completed heat without re-running (for cases where the results are still valid, just attributed to the wrong lanes)

## 7. Disqualifications (DQ)

**Problem:** A car fails post-race inspection, is found to have been modified after impound, or a racer causes repeated interference.

**Current behavior:** No DQ support. A racer can only be deleted entirely.

**Proposed:**
- Add a "Disqualify" action on a racer with a required reason field
- DQ'd racers are removed from standings and awards
- Their heat results remain in the database for audit purposes but don't count toward standings
- Standings below the DQ'd racer shift up (e.g., if 3rd place is DQ'd, 4th becomes 3rd)
- DQ'd racers appear in an "Admin" section of standings with a "DQ" badge and reason
- Support per-heat DQ (racer is only DQ'd from one heat, not the whole event) for interference calls
- A DQ'd racer can be un-DQ'd if the decision is reversed

## 8. Byes (Odd Racer Count)

**Problem:** When the number of racers isn't evenly divisible by the lane count, some heats have empty lanes.

**Current behavior:** The scheduling algorithm handles byes, but they may cluster in certain heats.

**Proposed:**
- Ensure bye lanes are evenly distributed across heats (no heat should have 2+ byes if avoidable)
- Visually distinguish bye lanes from no-show lanes in the UI (different styling)
- Empty lanes don't affect scoring — the racer in a 1v1 heat on a 4-lane track still earns a valid win
- Standings should note how many heats each racer actually ran (already tracked)

## 9. Ties and Tiebreakers

**Problem:** Two or more racers end up with identical records. Awards are at stake.

**Current behavior:** Ties are shown in standings but no tiebreaker mechanism exists.

**Proposed:**
- Automatic tie detection in standings (highlight tied positions)
- Configurable tiebreaker cascade:
  1. Head-to-head result (if the tied racers raced each other, who won?)
  2. Most 1st-place finishes
  3. Best single-heat time (if timed)
  4. If still tied: offer to generate a runoff heat
- One-click runoff heat generation: creates a new heat with just the tied racers
- Support declaring a "true tie" — both racers share the position, next position is skipped
- The tiebreaker logic should be visible to parents: "Tommy and Alex are tied at 8-2. Tommy wins the tiebreaker via head-to-head result in Heat 23."

## 10. Multiple Divisions / Championship Rounds

**Problem:** Events run separate divisions (by den/age) with a championship round for top finishers.

**Current behavior:** Events support dens and den-filtered standings, but no formal division racing or championship round generation.

**Proposed (future):**
- Allow creating an event with division-based scheduling (each den races separately)
- Per-division standings and awards
- Championship round auto-generation: top N from each division advance to a final bracket
- The championship round is a separate set of heats with its own standings
- This is a large feature — defer to a dedicated plan document

## Priority Order

Based on frequency and impact at real events:

| Priority | Feature | Effort | Why |
|----------|---------|--------|-----|
| 1 | Void & re-run heat | Medium | Happens at every event, currently no workaround |
| 2 | Withdraw racer | Medium | No-shows are inevitable, schedule gets messy |
| 3 | Disqualify racer | Small | Needed for fair competition |
| 4 | Late entry (add racer mid-event) | Large | Schedule regeneration is complex |
| 5 | Tie detection + tiebreaker cascade | Medium | Needed for awards |
| 6 | Runoff heat generation | Small | Quick follow-on after tie detection |
| 7 | Breakdown tracking | Small | Nice safety net for repeat offenders |
| 8 | Bye distribution improvement | Small | Polish for fairness perception |
| 9 | Per-heat DQ | Small | Rare but important for interference calls |
| 10 | Championship rounds | Large | Defer to separate plan |

## Implementation Notes

- **Schedule regeneration** (needed by features 1, 2, 4) is the core technical challenge. The algorithm must preserve completed heats while regenerating only pending ones. This should be built as a shared utility before tackling individual features.
- **Soft-delete pattern** (needed by features 1, 4, 7) — voided results and withdrawn racers should be flagged, not deleted. This supports audit trails and undo.
- **Standings recalculation** must be triggered after any result change (void, DQ, withdrawal). Currently standings are computed on the server after each heat; the recalc just needs to be callable on demand.
