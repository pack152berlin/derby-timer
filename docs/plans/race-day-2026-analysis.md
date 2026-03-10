# Race Day 2026 — Post-Mortem Analysis

## Event Facts

- **Event**: Pinewood Derby 2026 (February 28, 2026)
- **Cars**: 43 inspected racers
- **Track**: 4 lanes
- **Algorithm**: Adaptive greedy with elimination (default settings)
- **Status**: `racing` (Round 3 never completed)
- **Scheduled start**: 2:15 PM local
- **Racing start**: 3:27 PM local (UTC+1)
- **Start delay**: 1 hour 12 minutes
- **Last heat**: 5:02 PM local
- **Total elapsed**: ~94 minutes (including racing and inter-round break)
- **Note**: All timestamps in the database are UTC; local time = UTC+1

## What Happened

| Round | Racers | Heats | Heats/Racer | Avg heat cadence | Notes |
|-------|--------|-------|:-----------:|:-----------:|-------|
| R1 | 43 | 49 | 4–7 (avg 4.5) | 47s | Full lane cycle |
| — | — | — | — | **37 min break** | Announcing cuts, staging confusion |
| R2 | 22 | 23 | 4–5 (avg 4.1) | 47s | Survivors run another full lane cycle |
| R3 | 6 | 2 | incomplete | — | Event abandoned |
| **Total** | | **74** | | | |

**Actual measured heat cadence: 47 seconds** start-to-start on average (min 14s, max 149s, excluding the inter-round break). That is not 2 minutes — the cars ran fast. The 2-minute perception came from the 37-minute break between Round 1 and Round 2 making everything feel slow.

### Timeline (local time, UTC+1)

| Time | Event |
|------|-------|
| 2:15 PM | **Scheduled Start** |
| 3:27 PM | First heat starts (1:12 delay for registration/inspection) |
| 4:06 PM | Heat 48 completes (Round 1 nearly done) |
| 4:24 PM | Heat 49 marked complete (no `started_at` — likely run without clicking Start) |
| 4:24–5:01 PM | **37-minute gap** — announcing who was cut, confusion, staging Round 2 |
| 5:01 PM | Round 2 starts |
| 5:02 PM | Last recorded heat (Round 2 ends, Round 3 abandoned) |

## Why So Many Heats?

### 1. Full lane coverage is expensive with 43 cars

For 43 cars on a 4-lane track, every car needs 4 heats (one per lane). That's 43×4 = 172 racer-lane assignments. At 4 per heat, the theoretical minimum is **43 heats**. The adaptive algorithm used 49 (14% overhead due to greedy fill decisions — some racers ran 5–7 heats while others ran exactly 4).

**49 heats for Round 1 alone is already a long event.** This is the irreducible cost of "every car races every lane" fairness for a 43-car field.

### 2. Elimination re-runs the entire process

After Round 1, the field was cut to 22 racers (top half). Those 22 then ran **another full lane cycle** — 23 more heats. Then cut to 6, started another cycle.

Each elimination round is essentially a complete mini-derby. The elimination system assumes that re-running full lane coverage is necessary for fair ranking at each stage. For 43 cars, this nearly doubled the total:

```
Without elimination:  49 heats (~50 min)
With elimination:     49 + 23 + 2 = 74 heats (~74 min) and incomplete
```

### 3. Eliminated kids sat idle

21 racers were cut after Round 1. They had nothing to do during the 23 heats of Round 2 — roughly 25 minutes of waiting. For elementary school kids, that's a long time.

### 4. Round 1 racer-lane distribution was uneven

| Heats run | Racers |
|:---------:|:------:|
| 4 | 26 |
| 5 | 14 |
| 6 | 2 |
| 7 | 1 |

In a perfect schedule, all 43 racers would run exactly 4 heats. The greedy algorithm over-assigned 17 racers to fill lanes, creating 21 extra racer-lane slots (193 used vs 172 minimum). This added ~5 heats to Round 1.

Some racers also appeared in the same lane twice (21 duplicate lane assignments), meaning the "every lane once" goal wasn't perfectly met — a few racers hit some lanes twice while others hit them once.

## Root Causes

1. **The 37-minute inter-round break was the biggest single problem.** The app gave no warning that cutting to Round 2 would require announcing eliminations, finding which kids were still eligible, explaining the cut to families, and re-staging cars. This chaos was entirely predictable but not surfaced to volunteers in advance.
2. **No duration guardrails** — the algorithm optimizes for fairness without any constraint on total heat count or event duration. Volunteers had no idea how long the event would take when they pressed "Generate Heats."
3. **Elimination is always-on** — there's no option to skip elimination rounds or choose a lighter finals format.
4. **Full lane coverage per elimination round** — each round demands every surviving car race every lane again. This is O(N) heats per round.
5. **Greedy fill creates overhead** — the heuristic over-schedules some racers to avoid empty lanes, adding ~14% more heats than the theoretical minimum.
6. **No scoring without times** — the K1 timer wasn't used, so no times were captured. Standings ran purely on win/loss. See "Standings Model" below.
7. **Monotony from over-optimization** — The focus on clearing 74+ heats quickly made the racing feel like a chore. The speed was efficient but the atmosphere felt monotonous because we were just "trying to get through it" rather than enjoying the event.

## What We'd Change

### For a 43-car / 4-lane event, target ~50 heats (under 1 hour):

**Option A: Single round, no elimination** — 49 heats. Final standings from one lane cycle determine all placements. Every kid races the whole event.

**Option B: Single round + championship heat** — 49 heats for everyone, then 1–4 extra heats for the top 4 finishers. Total: ~53 heats. Gives a "finals" moment without re-running a full cycle. 21 kids still watch, but only for ~4 minutes.

**Option C: Reduced coverage** — each car races 3 heats instead of 4 (skip one lane). Total: ~33 heats. Trades some lane fairness for a much shorter event. With electronic timing and lane handicaps, skipping a lane matters less.

### Configuration needed in the app:

1. **Elimination toggle** — on/off per event
2. **Finals format** — "Full elimination" (current) vs "Championship heat" (top N do a quick runoff) vs "None" (standings are final after one round)
3. **Duration target** — "Aim for under X minutes" that adjusts heats-per-car downward for large fields
4. **Progress visibility** — show "Heat 32 of ~49 · ~17 min remaining" so volunteers know where they are

## Standings Model: Win/Loss, Not Points

The current standings are **purely win/loss**. There are no points. Placement in a heat is binary: 1st = win, anything else = loss.

```
Ranking order:  wins DESC → losses ASC → avg_time_ms ASC (tiebreaker only)
```

From the actual 2026 data, the top of the standings shows the problem clearly:

| Name | Wins | Losses | Heats | Win Rate |
|------|:----:|:------:|:-----:|:--------:|
| Guhan puviyarrasan | 6 | 2 | 8 | 75% |
| Julios oberwagner | 4 | 4 | 8 | 50% |
| Maximilian Bodner | 4 | 4 | 8 | 50% |
| Holland Scott | 4 | 4 | 8 | 50% |

Racer 1 clearly dominated. But racers 2–4 are indistinguishable — all 4W/4L — and since no times were captured, there's no tiebreaker. Three kids tied for 2nd with no way to separate them.

**The structural problem with win/loss-only scoring:**
- A car that consistently finishes 2nd (very fast, always beat by one car) has the same record as a car that finishes dead last every heat
- With 43 cars and 4-per-heat, only 1 car wins each heat — 75% of participants get a loss even if they ran well
- No times = no tiebreaker = ties everywhere in the middle of the standings

**What time-based scoring would have changed:**
A car finishing 2nd in 3.002s vs a car finishing 3rd in 3.8s both get "loss" today. With time scoring, the 3.002s car ranks far above the 3.8s car regardless of heat matchups. This matters most for the kids in the middle of the pack.

## Awards Ceremony & Car Voting

After racing, cars were displayed and families voted on favorites using **paper ballots**. Awards were given for categories like Most Creative.

**Problems with paper:**
- Votes weren't captured digitally — no record exists
- Can't appear on certificates
- Counting ballots takes time and a volunteer
- No live excitement on the projector while voting is open

**The 37-minute inter-round break** would have been a natural voting window — cars were already staged, families were milling around, everyone had their phones. Instead it was dead time.

**Planned solution**: Phone-based voting via QR code on the projector. Families tap their favorite car, live vote counts tick up on the display, MC closes voting when ready, winner stored in the database and appears as a badge on their certificate.

→ [Voting Plan](./voting.md)

## Lessons for the Scheduling Plan

These findings should feed directly into the configurable scheduling plan (`heat-scheduling.md`):

### Duration & Estimation
- **Show the estimate before generating heats.** Volunteers pressed "Generate" with no idea they were signing up for 74+ heats.
- **47 seconds is the real heat cadence** for this crew — not 60s or 90s. Use actual measured data after a few heats.
- **Budget time for inter-round breaks.** Elimination cuts require announcements, family communication, and car re-staging. Add at least 15–20 minutes per elimination round to estimates.
- **Surface a "you started late" warning.** Racing didn't start until 3:27 PM local. With a 94-minute event that puts the finish at 5:02 PM — late for a pack event. If the event starts after a configurable time (e.g., after 2 PM) and the estimate runs past a configurable end time (e.g., 5 PM), warn the volunteer and suggest a shorter format.

### Logistics & Registration

Registration and inspection happened **at the same desk simultaneously** — `updated_at` on racers is nearly identical to `created_at` for all 43 kids. The desk was fast.

**Actual timeline breakdown:**
| Window | What | Duration |
|--------|------|----------|
| 2:23–2:56 PM | Registration + weigh-in together | 33 min |
| 2:56–3:27 PM | Car staging ("easy pull" order), family announcements, deliberate wait | **30 min** |
| 3:27 PM | First heat | — |

The 30-minute staging gap was intentional — cars had to be physically arranged on the staging table in heat order, and volunteers addressed the crowd. The app has no visibility into this window at all; it just sees silence between last inspection and first heat.

**One outlier**: Julios (car #1) had his record updated at 3:47 PM — 84 minutes after creation. Likely a mid-race correction.

**What the line felt like**: Registration peaked at 16 kids in 10 minutes (2:30–2:40 PM). With a 10+ person queue and 1–2 stations, individuals waited 6–10 minutes to reach the desk even though the desk itself was fast (~37s per racer).

**Next year's fixes:**
1. **Pre-load the roster** before race day (names, dens, car numbers) so desk check-in is a 5-second confirmation, not data entry — cuts the 33-min window roughly in half.
2. **Stage cars earlier** — don't wait until registration closes to start staging. Do it in parallel as kids check in.
3. **Time-box the staging gap** — set a hard "heats begin at X" target and announce it. The app should surface this: "First heat scheduled for 3:00 PM — 4 minutes away."
4. **The line had 10+ people most of the time.** More stations help with perceived wait, even if throughput is already fine.

### Scheduling Defaults
- **Optimize for Fun**: Efficiency is important, but not at the cost of the experience. The fast cadence felt like a factory line. Next time, aim for a pace that allows for commentary, cheers, and "moments" for the kids.
- **For 25+ cars, default to single round, no elimination.** Round 1 alone (49 heats × 47s = ~38 min) was a fair and complete race. Elimination added 37+ more minutes of racing plus 37 minutes of chaos.
- **Elimination should be opt-in** with a clear preview of what it adds ("This will add ~22 more heats and ~25 minutes, plus time to announce cuts").
- **Championship heat** (top 4 run 1 extra heat) gives drama without the full second round.

### Scoring
- **Wire up the K1 timer next year.** Without times, mid-pack standings are meaningless ties. With times, every placement is uniquely ranked.
- **Consider points-based scoring** (1st=4pts, 2nd=3pts, 3rd=2pts, 4th=1pt) as a no-timer alternative that gives credit for 2nd/3rd place instead of treating everything non-1st as a loss.
- **Winning a heat in a field of 4 is not the same as winning a heat of 2.** The current model doesn't account for heat size. Worth considering in any future scoring revamp.
