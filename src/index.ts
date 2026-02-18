import index from "./frontend/index.html";
import display from "./frontend/display.html";
import {
  getDb,
  EventRepository,
  RacerRepository,
  HeatRepository,
  ResultRepository,
  umzug,
} from "./db";
import {
  clampLookahead,
  planHeatQueue,
  planNextHeat,
  type PlannerHeat,
  type PlannerRacer,
  type PlannerStanding,
} from "./race/heat-planner";
import {
  selectSurvivorsForNextRound,
  type EliminationStanding,
} from "./race/elimination";

// Initialize database on startup
await umzug.up();
console.log("Database initialized");

// Repository instances
const eventsRepo = new EventRepository();
const racersRepo = new RacerRepository();
const heatsRepo = new HeatRepository();
const resultsRepo = new ResultRepository();

// Active heat state (for live race console)
type ActiveHeatState = {
  heatId: string | null;
  running: boolean;
  startTimeMs: number | null;
  elapsedMs: number;
};

const activeHeat: ActiveHeatState = {
  heatId: null,
  running: false,
  startTimeMs: null,
  elapsedMs: 0,
};

const jsonHeaders = {
  "Content-Type": "application/json",
};

const respondJson = (payload: unknown, status = 200) => {
  return new Response(JSON.stringify(payload), {
    status,
    headers: jsonHeaders,
  });
};

const getCurrentElapsedMs = () => {
  if (!activeHeat.running || activeHeat.startTimeMs === null) {
    return activeHeat.elapsedMs;
  }
  return Date.now() - activeHeat.startTimeMs;
};

type EventPlanningSettings = {
  laneCount: number;
  rounds: number;
  lookahead: 2 | 3;
};

const eventPlanningByEventId = new Map<string, EventPlanningSettings>();

const getPlanningSettings = (eventId: string, fallbackLaneCount: number): EventPlanningSettings => {
  const existing = eventPlanningByEventId.get(eventId);
  if (existing) return existing;

  return {
    laneCount: fallbackLaneCount,
    rounds: 1,
    lookahead: 3,
  };
};

const getPlannerRacers = (eventId: string): PlannerRacer[] => {
  return racersRepo.findInspectedByEvent(eventId).map((racer) => ({
    id: racer.id,
    car_number: racer.car_number,
  }));
};

const getEventStandings = (eventId: string): EliminationStanding[] => {
  return resultsRepo.getStandings(eventId).map((standing) => ({
    racer_id: standing.racer_id,
    wins: standing.wins,
    losses: standing.losses,
    heats_run: standing.heats_run,
    avg_time_ms: standing.avg_time_ms,
  }));
};

const toPlannerStandings = (standings: EliminationStanding[]): PlannerStanding[] => {
  return standings.map((standing) => ({
    racer_id: standing.racer_id,
    wins: standing.wins,
    losses: standing.losses,
    heats_run: standing.heats_run,
  }));
};

const toPlannerHeats = (
  heats: ReturnType<HeatRepository["findByEventWithLanes"]>
): PlannerHeat[] => {
  return heats.map((heat) => ({
    status: heat.status,
    lanes: heat.lanes.map((lane) => ({
      lane_number: lane.lane_number,
      racer_id: lane.racer_id,
    })),
  }));
};

const getHighestRound = (heats: { round: number }[]) => {
  if (heats.length === 0) {
    return 1;
  }

  return heats.reduce((maxRound, heat) => {
    return Math.max(maxRound, heat.round);
  }, 1);
};

const getRoundRacers = (
  allRacers: PlannerRacer[],
  roundHeats: ReturnType<HeatRepository["findByEventWithLanes"]>,
  roundNumber: number
) => {
  if (roundHeats.length === 0 && roundNumber === 1) {
    return allRacers;
  }

  const racerIds = new Set<string>();
  for (const heat of roundHeats) {
    for (const lane of heat.lanes) {
      racerIds.add(lane.racer_id);
    }
  }

  return allRacers.filter((racer) => racerIds.has(racer.id));
};

const getNextHeatNumber = (heats: ReturnType<HeatRepository["findByEvent"]>) => {
  return (
    heats.reduce((maxHeatNumber, heat) => {
      return Math.max(maxHeatNumber, heat.heat_number);
    }, 0) + 1
  );
};

const appendPlannedHeatsForRound = (
  eventId: string,
  roundNumber: number,
  racers: PlannerRacer[],
  existingRoundHeats: PlannerHeat[],
  standings: PlannerStanding[],
  settings: EventPlanningSettings
) => {
  const plannedHeats = planHeatQueue({
    racers,
    laneCount: settings.laneCount,
    rounds: settings.rounds,
    standings,
    existingHeats: existingRoundHeats,
    lookahead: settings.lookahead,
  });

  if (plannedHeats.length === 0) {
    return 0;
  }

  let nextHeatNumber = getNextHeatNumber(heatsRepo.findByEvent(eventId));

  for (const plannedHeat of plannedHeats) {
    heatsRepo.create({
      event_id: eventId,
      round: roundNumber,
      heat_number: nextHeatNumber,
      lanes: plannedHeat.lanes,
    });

    nextHeatNumber++;
  }

  return plannedHeats.length;
};

const topUpHeatQueue = (eventId: string, settings: EventPlanningSettings): number => {
  const allRacers = getPlannerRacers(eventId);
  if (allRacers.length === 0) {
    return 0;
  }

  const allHeatsWithLanes = heatsRepo.findByEventWithLanes(eventId);
  const currentRound = getHighestRound(allHeatsWithLanes);
  const currentRoundHeatsWithLanes = allHeatsWithLanes.filter((heat) => {
    return heat.round === currentRound;
  });
  const currentRoundPlannerHeats = toPlannerHeats(currentRoundHeatsWithLanes);
  const currentRoundRacers = getRoundRacers(
    allRacers,
    currentRoundHeatsWithLanes,
    currentRound
  );

  if (currentRoundRacers.length === 0) {
    return 0;
  }

  const eventStandings = getEventStandings(eventId);
  const plannerStandings = toPlannerStandings(eventStandings);
  const inFlightRoundHeatCount = currentRoundPlannerHeats.filter((heat) => {
    return heat.status !== "complete";
  }).length;
  const nextRoundHeat = planNextHeat({
    racers: currentRoundRacers,
    laneCount: settings.laneCount,
    rounds: settings.rounds,
    standings: plannerStandings,
    existingHeats: currentRoundPlannerHeats,
  });

  if (nextRoundHeat) {
    if (inFlightRoundHeatCount >= settings.lookahead) {
      return 0;
    }

    return appendPlannedHeatsForRound(
      eventId,
      currentRound,
      currentRoundRacers,
      currentRoundPlannerHeats,
      plannerStandings,
      settings
    );
  }

  if (inFlightRoundHeatCount > 0) {
    return 0;
  }

  if (currentRoundRacers.length <= 2) {
    return 0;
  }

  const survivors = selectSurvivorsForNextRound(currentRoundRacers, eventStandings);
  const nextRoundNumber = currentRound + 1;

  return appendPlannedHeatsForRound(
    eventId,
    nextRoundNumber,
    survivors,
    [],
    plannerStandings,
    settings
  );
};

const maybeMarkEventComplete = (eventId: string, settings: EventPlanningSettings) => {
  const allRacers = getPlannerRacers(eventId);
  if (allRacers.length === 0) {
    return;
  }

  const allHeatsWithLanes = heatsRepo.findByEventWithLanes(eventId);
  const currentRound = getHighestRound(allHeatsWithLanes);
  const currentRoundHeatsWithLanes = allHeatsWithLanes.filter((heat) => {
    return heat.round === currentRound;
  });
  const currentRoundPlannerHeats = toPlannerHeats(currentRoundHeatsWithLanes);

  if (currentRoundPlannerHeats.length === 0) {
    return;
  }

  const heatsInFlight = currentRoundPlannerHeats.filter((heat) => heat.status !== "complete");
  if (heatsInFlight.length > 0) {
    return;
  }

  const currentRoundRacers = getRoundRacers(
    allRacers,
    currentRoundHeatsWithLanes,
    currentRound
  );
  if (currentRoundRacers.length > 2) {
    return;
  }

  const nextHeat = planNextHeat({
    racers: currentRoundRacers,
    laneCount: settings.laneCount,
    rounds: settings.rounds,
    standings: toPlannerStandings(getEventStandings(eventId)),
    existingHeats: currentRoundPlannerHeats,
  });

  if (!nextHeat) {
    eventsRepo.update(eventId, { status: "complete" });
  }
};

Bun.serve({
  routes: {
    // Serve the main UI
    "/": index,
    "/register": index,
    "/heats": index,
    "/race": index,
    "/standings": index,
    "/format": index,
    "/display": display,

    // ===== EVENTS API =====
    "/api/events": {
      GET: () => {
        const events = eventsRepo.findAll();
        return respondJson(events);
      },
      POST: async (req) => {
        const body = (await req.json()) as {
          name: string;
          date: string;
          lane_count?: number;
        };
        if (!body.name || !body.date) {
          return respondJson({ error: "Name and date are required" }, 400);
        }
        const event = eventsRepo.create({
          name: body.name,
          date: body.date,
          lane_count: body.lane_count,
        });
        return respondJson(event, 201);
      },
    },

    "/api/events/:id": {
      GET: (req) => {
        const event = eventsRepo.findById(req.params.id);
        if (!event) return respondJson({ error: "Event not found" }, 404);
        return respondJson(event);
      },
      PATCH: async (req) => {
        const body = (await req.json()) as {
          name?: string;
          date?: string;
          lane_count?: number;
          status?: "draft" | "checkin" | "racing" | "complete";
        };
        const event = eventsRepo.update(req.params.id, body);
        if (!event) return respondJson({ error: "Event not found" }, 404);
        return respondJson(event);
      },
      DELETE: (req) => {
        const deleted = eventsRepo.delete(req.params.id);
        if (!deleted) return respondJson({ error: "Event not found" }, 404);
        return respondJson({ success: true });
      },
    },

    // ===== RACERS API (includes car info now) =====
    "/api/events/:eventId/racers": {
      GET: (req) => {
        const racers = racersRepo.findByEvent(req.params.eventId);
        return respondJson(racers);
      },
      POST: async (req) => {
        const body = (await req.json()) as {
          name: string;
          den?: string;
          car_number: string;
        };
        if (!body.name || !body.car_number) {
          return respondJson({ error: "Name and car number are required" }, 400);
        }
        const racer = racersRepo.create({
          event_id: req.params.eventId,
          name: body.name,
          den: body.den,
          car_number: body.car_number,
        });
        return respondJson(racer, 201);
      },
    },

    "/api/racers/:id": {
      GET: (req) => {
        const racer = racersRepo.findById(req.params.id);
        if (!racer) return respondJson({ error: "Racer not found" }, 404);
        return respondJson(racer);
      },
      PATCH: async (req) => {
        const body = (await req.json()) as {
          name?: string;
          den?: string;
          car_number?: string;
          weight_ok?: boolean;
        };
        const racer = racersRepo.update(req.params.id, body);
        if (!racer) return respondJson({ error: "Racer not found" }, 404);
        return respondJson(racer);
      },
      DELETE: (req) => {
        const deleted = racersRepo.delete(req.params.id);
        if (!deleted) return respondJson({ error: "Racer not found" }, 404);
        return respondJson({ success: true });
      },
    },

    "/api/racers/:id/inspect": {
      POST: async (req) => {
        const body = (await req.json()) as { weight_ok: boolean };
        const racer = racersRepo.inspect(req.params.id, body.weight_ok ?? false);
        if (!racer) return respondJson({ error: "Racer not found" }, 404);
        return respondJson(racer);
      },
    },

    // ===== HEATS API =====
    "/api/events/:eventId/heats": {
      GET: (req) => {
        const heats = heatsRepo.findByEventWithLanes(req.params.eventId);
        return respondJson(heats);
      },
      POST: async (req) => {
        const body = (await req.json()) as {
          round: number;
          heat_number: number;
          lanes: { lane_number: number; racer_id: string }[];
        };
        if (!body.lanes || body.lanes.length === 0) {
          return respondJson({ error: "Lanes are required" }, 400);
        }
        const heat = heatsRepo.create({
          event_id: req.params.eventId,
          round: body.round,
          heat_number: body.heat_number,
          lanes: body.lanes,
        });
        return respondJson(heat, 201);
      },
      DELETE: (req) => {
        // Delete all heats for event (for regeneration)
        heatsRepo.deleteByEvent(req.params.eventId);
        eventPlanningByEventId.delete(req.params.eventId);
        return respondJson({ success: true });
      },
    },

    "/api/heats/:id": {
      GET: (req) => {
        const heat = heatsRepo.findWithLanes(req.params.id);
        if (!heat) return respondJson({ error: "Heat not found" }, 404);
        return respondJson(heat);
      },
    },

    "/api/heats/:id/start": {
      POST: (req) => {
        const heat = heatsRepo.updateStatus(req.params.id, "running");
        if (!heat) return respondJson({ error: "Heat not found" }, 404);

        // Set as active heat
        activeHeat.heatId = req.params.id;
        activeHeat.running = true;
        activeHeat.startTimeMs = Date.now();
        activeHeat.elapsedMs = 0;

        return respondJson(heat);
      },
    },

    "/api/heats/:id/complete": {
      POST: (req) => {
        const existingHeat = heatsRepo.findById(req.params.id);
        if (!existingHeat) return respondJson({ error: "Heat not found" }, 404);

        const heat = heatsRepo.updateStatus(req.params.id, "complete");
        if (!heat) return respondJson({ error: "Heat not found" }, 404);

        // Clear active heat if this was it
        if (activeHeat.heatId === req.params.id) {
          activeHeat.heatId = null;
          activeHeat.running = false;
          activeHeat.startTimeMs = null;
          activeHeat.elapsedMs = 0;
        }

        const event = eventsRepo.findById(existingHeat.event_id);
        if (event) {
          const settings = getPlanningSettings(event.id, event.lane_count);
          topUpHeatQueue(event.id, settings);
          maybeMarkEventComplete(event.id, settings);
        }

        return respondJson(heat);
      },
    },

    // ===== HEAT GENERATION API =====
    "/api/events/:eventId/generate-heats": {
      POST: async (req) => {
        const body = (await req.json()) as {
          rounds?: number;
          lane_count?: number;
          lookahead?: number;
        };

        const event = eventsRepo.findById(req.params.eventId);
        if (!event) return respondJson({ error: "Event not found" }, 404);

        const racers = racersRepo.findInspectedByEvent(req.params.eventId);
        if (racers.length === 0) {
          return respondJson({ error: "No racers have passed inspection" }, 400);
        }

        // Delete existing heats
        heatsRepo.deleteByEvent(req.params.eventId);

        const laneCount = body.lane_count ?? event.lane_count;
        const rounds = Math.max(1, body.rounds ?? 1);
        const lookahead = clampLookahead(body.lookahead);

        const planningSettings: EventPlanningSettings = {
          laneCount,
          rounds,
          lookahead,
        };
        eventPlanningByEventId.set(req.params.eventId, planningSettings);

        topUpHeatQueue(req.params.eventId, planningSettings);

        // Update event status to racing
        eventsRepo.update(req.params.eventId, { status: "racing" });

        const createdHeats = heatsRepo.findByEventWithLanes(req.params.eventId);
        return respondJson(createdHeats);
      },
    },

    // ===== RESULTS API =====
    "/api/heats/:heatId/results": {
      GET: (req) => {
        const results = resultsRepo.findByHeat(req.params.heatId);
        return respondJson(results);
      },
      POST: async (req) => {
        const heat = heatsRepo.findById(req.params.heatId);
        if (!heat) return respondJson({ error: "Heat not found" }, 404);

        const body = (await req.json()) as {
          results: {
            lane_number: number;
            racer_id: string;
            place: number;
            time_ms?: number;
            dnf?: boolean;
          }[];
        };

        if (!body.results || body.results.length === 0) {
          return respondJson({ error: "Results are required" }, 400);
        }

        const savedResults = resultsRepo.createBatch(
          body.results.map(r => ({ ...r, heat_id: req.params.heatId }))
        );

        // Complete the heat
        heatsRepo.updateStatus(req.params.heatId, "complete");

        if (activeHeat.heatId === req.params.heatId) {
          activeHeat.heatId = null;
          activeHeat.running = false;
          activeHeat.startTimeMs = null;
          activeHeat.elapsedMs = 0;
        }

        const event = eventsRepo.findById(heat.event_id);
        if (event) {
          const settings = getPlanningSettings(event.id, event.lane_count);
          topUpHeatQueue(event.id, settings);
          maybeMarkEventComplete(event.id, settings);
        }

        return respondJson(savedResults);
      },
    },

    // ===== STANDINGS API =====
    "/api/events/:eventId/standings": {
      GET: (req) => {
        const standings = resultsRepo.getStandings(req.params.eventId);
        return respondJson(standings);
      },
    },

    // ===== LIVE RACE CONSOLE API =====
    "/api/race/active": {
      GET: () => {
        return respondJson({
          heatId: activeHeat.heatId,
          running: activeHeat.running,
          elapsedMs: getCurrentElapsedMs(),
        });
      },
    },

    "/api/race/stop": {
      POST: () => {
        activeHeat.elapsedMs = getCurrentElapsedMs();
        activeHeat.running = false;
        activeHeat.startTimeMs = null;

        return respondJson({
          heatId: activeHeat.heatId,
          running: activeHeat.running,
          elapsedMs: activeHeat.elapsedMs,
        });
      },
    },
  },
  development: {
    hmr: true,
    console: true,
  },
});

console.log("Derby Race Server running on http://localhost:3000");
