import index from "./frontend/index.html";
import display from "./frontend/display.html";
import { existsSync, mkdirSync, unlinkSync } from "node:fs";
import { basename, join } from "node:path";
import {
  EventRepository,
  RacerRepository,
  HeatRepository,
  ResultRepository,
  PlanningStateRepository,
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
const planningStateRepo = new PlanningStateRepository();

const jsonHeaders = {
  "Content-Type": "application/json",
};

const photoUploadDir = Bun.env.DERBY_UPLOAD_DIR ?? "uploads/car-photos";
const parsedMaxPhotoBytes = Number(Bun.env.DERBY_MAX_PHOTO_BYTES ?? "1200000");
const maxPhotoBytes = Number.isFinite(parsedMaxPhotoBytes) && parsedMaxPhotoBytes > 0
  ? parsedMaxPhotoBytes
  : 1_200_000;

if (!existsSync(photoUploadDir)) {
  mkdirSync(photoUploadDir, { recursive: true });
}

const getPhotoExtension = (mimeType: string) => {
  const normalizedType = mimeType.toLowerCase();

  if (normalizedType === "image/jpeg") return "jpg";
  if (normalizedType === "image/png") return "png";
  if (normalizedType === "image/webp") return "webp";
  if (normalizedType === "image/heic") return "heic";
  if (normalizedType === "image/heif") return "heif";
  if (normalizedType === "image/avif") return "avif";
  if (normalizedType === "image/gif") return "gif";

  const subtype = normalizedType.split("/")[1] ?? "jpg";
  const sanitizedSubtype = subtype.replace(/[^a-z0-9]/g, "");
  return sanitizedSubtype || "jpg";
};

const getPhotoPath = (filename: string) => {
  return join(photoUploadDir, basename(filename));
};

const deletePhotoFile = (filename: string | null) => {
  if (!filename) {
    return;
  }

  try {
    unlinkSync(getPhotoPath(filename));
  } catch {
    // Ignore missing files while cleaning up old photos.
  }
};

const respondJson = (payload: unknown, status = 200) => {
  return new Response(JSON.stringify(payload), {
    status,
    headers: jsonHeaders,
  });
};

const isSqliteUniqueConstraintError = (
  error: unknown,
  expectedColumns: string[] = []
) => {
  if (!(error instanceof Error)) {
    return false;
  }

  const sqliteCode = (error as { code?: string }).code;
  if (sqliteCode !== "SQLITE_CONSTRAINT_UNIQUE") {
    return false;
  }

  if (expectedColumns.length === 0) {
    return true;
  }

  return expectedColumns.every((column) => error.message.includes(column));
};

const getElapsedMsFromStartedAt = (startedAt: string | null) => {
  if (!startedAt) {
    return 0;
  }

  const startedAtMs = Date.parse(startedAt);
  if (Number.isNaN(startedAtMs)) {
    return 0;
  }

  return Math.max(0, Date.now() - startedAtMs);
};

const getActiveHeatStatus = () => {
  const runningHeat = heatsRepo.findRunning();
  if (!runningHeat) {
    return {
      heatId: null,
      running: false,
      elapsedMs: 0,
    };
  }

  return {
    heatId: runningHeat.id,
    running: true,
    elapsedMs: getElapsedMsFromStartedAt(runningHeat.started_at),
  };
};

type EventPlanningSettings = {
  laneCount: number;
  rounds: number;
  lookahead: 2 | 3;
};

const clearRoundRacerCache = (eventId: string) => {
  planningStateRepo.clearRoundRosters(eventId);
};

const setRoundRacerCache = (eventId: string, roundNumber: number, racers: PlannerRacer[]) => {
  planningStateRepo.replaceRoundRacerIds(
    eventId,
    roundNumber,
    racers.map((racer) => racer.id)
  );
};

const getRoundRacersFromCache = (
  eventId: string,
  roundNumber: number,
  allRacers: PlannerRacer[]
) => {
  const cachedRacerIds = planningStateRepo.getRoundRacerIds(eventId, roundNumber);
  if (!cachedRacerIds || cachedRacerIds.length === 0) {
    return null;
  }

  const racersById = new Map<string, PlannerRacer>();
  for (const racer of allRacers) {
    racersById.set(racer.id, racer);
  }

  const racers = cachedRacerIds
    .map((racerId) => racersById.get(racerId))
    .filter((racer): racer is PlannerRacer => racer !== undefined);

  if (racers.length === 0) {
    return null;
  }

  return racers;
};

const getPlanningSettings = (eventId: string, fallbackLaneCount: number): EventPlanningSettings => {
  const existing = planningStateRepo.getSettings(eventId);
  if (existing) {
    return {
      laneCount: existing.lane_count,
      rounds: Math.max(1, existing.rounds),
      lookahead: existing.lookahead === 2 ? 2 : 3,
    };
  }

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
  eventId: string,
  allRacers: PlannerRacer[],
  roundHeats: ReturnType<HeatRepository["findByEventWithLanes"]>,
  roundNumber: number
) => {
  const cachedRacers = getRoundRacersFromCache(eventId, roundNumber, allRacers);
  if (cachedRacers) {
    return cachedRacers;
  }

  if (roundHeats.length === 0 && roundNumber === 1) {
    setRoundRacerCache(eventId, roundNumber, allRacers);
    return allRacers;
  }

  if (roundNumber === 1) {
    setRoundRacerCache(eventId, roundNumber, allRacers);
    return allRacers;
  }

  const racerIds = new Set<string>();
  for (const heat of roundHeats) {
    for (const lane of heat.lanes) {
      racerIds.add(lane.racer_id);
    }
  }

  const roundRacers = allRacers.filter((racer) => racerIds.has(racer.id));
  if (roundRacers.length > 0) {
    setRoundRacerCache(eventId, roundNumber, roundRacers);
  }

  return roundRacers;
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
    eventId,
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
  setRoundRacerCache(eventId, nextRoundNumber, survivors);

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
    eventId,
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

const parsedPort = Number(Bun.env.PORT ?? "3000");
const port = Number.isFinite(parsedPort) && parsedPort > 0 ? parsedPort : 3000;

Bun.serve({
  port,
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
        const eventRacers = racersRepo.findByEvent(req.params.id);
        const deleted = eventsRepo.delete(req.params.id);
        if (!deleted) return respondJson({ error: "Event not found" }, 404);
        for (const racer of eventRacers) {
          deletePhotoFile(racer.car_photo_filename);
        }
        planningStateRepo.clearSettings(req.params.id);
        clearRoundRacerCache(req.params.id);
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

        try {
          const racer = racersRepo.create({
            event_id: req.params.eventId,
            name: body.name,
            den: body.den,
            car_number: body.car_number,
          });
          return respondJson(racer, 201);
        } catch (error) {
          if (
            isSqliteUniqueConstraintError(error, ["racers.event_id", "racers.car_number"])
          ) {
            return respondJson(
              {
                error: `Car #${body.car_number} is already registered for this event. Choose a different car number.`,
              },
              409
            );
          }

          throw error;
        }
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
        const racer = racersRepo.findById(req.params.id);
        if (!racer) return respondJson({ error: "Racer not found" }, 404);

        const deleted = racersRepo.delete(req.params.id);
        if (!deleted) return respondJson({ error: "Racer not found" }, 404);
        deletePhotoFile(racer.car_photo_filename);
        return respondJson({ success: true });
      },
    },

    "/api/racers/:id/photo": {
      GET: async (req) => {
        const racer = racersRepo.findById(req.params.id);
        if (!racer) {
          return respondJson({ error: "Racer not found" }, 404);
        }

        if (!racer.car_photo_filename) {
          return respondJson({ error: "Photo not found" }, 404);
        }

        const photo = Bun.file(getPhotoPath(racer.car_photo_filename));
        if (!(await photo.exists())) {
          return respondJson({ error: "Photo not found" }, 404);
        }

        return new Response(photo, {
          headers: {
            "Content-Type": (racer.car_photo_mime_type ?? photo.type) || "application/octet-stream",
            "Cache-Control": "public, max-age=300",
          },
        });
      },

      POST: async (req) => {
        const racer = racersRepo.findById(req.params.id);
        if (!racer) {
          return respondJson({ error: "Racer not found" }, 404);
        }

        const formData = await req.formData();
        const photoEntry = formData.get("photo");

        if (!(photoEntry instanceof File)) {
          return respondJson({ error: "Photo file is required" }, 400);
        }

        if (photoEntry.size <= 0) {
          return respondJson({ error: "Photo file is empty" }, 400);
        }

        const mimeType = (photoEntry.type || "").toLowerCase();
        if (!mimeType.startsWith("image/")) {
          return respondJson({ error: "Only image uploads are supported" }, 400);
        }

        if (photoEntry.size > maxPhotoBytes) {
          return respondJson(
            {
              error: `Photo is too large. Please upload an image under ${Math.floor(
                maxPhotoBytes / 1024
              )}KB`,
            },
            413
          );
        }

        const extension = getPhotoExtension(mimeType);
        const filename = `${racer.id}-${Date.now()}-${crypto.randomUUID()}.${extension}`;
        const photoPath = getPhotoPath(filename);

        try {
          await Bun.write(photoPath, await photoEntry.arrayBuffer());
        } catch {
          return respondJson({ error: "Failed to store photo" }, 500);
        }

        const updatedRacer = racersRepo.update(req.params.id, {
          car_photo_filename: filename,
          car_photo_mime_type: mimeType,
          car_photo_bytes: photoEntry.size,
        });

        if (!updatedRacer) {
          deletePhotoFile(filename);
          return respondJson({ error: "Racer not found" }, 404);
        }

        if (racer.car_photo_filename && racer.car_photo_filename !== filename) {
          deletePhotoFile(racer.car_photo_filename);
        }

        return respondJson(updatedRacer);
      },

      DELETE: (req) => {
        const racer = racersRepo.findById(req.params.id);
        if (!racer) {
          return respondJson({ error: "Racer not found" }, 404);
        }

        deletePhotoFile(racer.car_photo_filename);

        const updatedRacer = racersRepo.update(req.params.id, {
          car_photo_filename: null,
          car_photo_mime_type: null,
          car_photo_bytes: null,
        });

        if (!updatedRacer) {
          return respondJson({ error: "Racer not found" }, 404);
        }

        return respondJson(updatedRacer);
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
        const runningHeat = heatsRepo.findRunning();
        if (runningHeat?.event_id === req.params.eventId) {
          heatsRepo.updateStatus(runningHeat.id, "pending");
        }

        // Delete all heats for event (for regeneration)
        heatsRepo.deleteByEvent(req.params.eventId);
        planningStateRepo.clearSettings(req.params.eventId);
        clearRoundRacerCache(req.params.eventId);
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
        const runningHeat = heatsRepo.findRunning();
        if (runningHeat && runningHeat.id !== req.params.id) {
          return respondJson({ error: "Another heat is already running" }, 409);
        }

        const heat = heatsRepo.updateStatus(req.params.id, "running");
        if (!heat) return respondJson({ error: "Heat not found" }, 404);

        return respondJson(heat);
      },
    },

    "/api/heats/:id/complete": {
      POST: (req) => {
        const existingHeat = heatsRepo.findById(req.params.id);
        if (!existingHeat) return respondJson({ error: "Heat not found" }, 404);

        const heat = heatsRepo.updateStatus(req.params.id, "complete");
        if (!heat) return respondJson({ error: "Heat not found" }, 404);

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

        const runningHeat = heatsRepo.findRunning();
        if (runningHeat?.event_id === req.params.eventId) {
          heatsRepo.updateStatus(runningHeat.id, "pending");
        }

        // Delete existing heats
        heatsRepo.deleteByEvent(req.params.eventId);
        planningStateRepo.clearSettings(req.params.eventId);
        clearRoundRacerCache(req.params.eventId);

        const laneCount = body.lane_count ?? event.lane_count;
        const rounds = Math.max(1, body.rounds ?? 1);
        const lookahead = clampLookahead(body.lookahead);

        const planningSettings: EventPlanningSettings = {
          laneCount,
          rounds,
          lookahead,
        };
        planningStateRepo.upsertSettings({
          event_id: req.params.eventId,
          lane_count: planningSettings.laneCount,
          rounds: planningSettings.rounds,
          lookahead: planningSettings.lookahead,
        });
        setRoundRacerCache(
          req.params.eventId,
          1,
          racers.map((racer) => ({
            id: racer.id,
            car_number: racer.car_number,
          }))
        );

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
        return respondJson(getActiveHeatStatus());
      },
    },

    "/api/race/stop": {
      POST: () => {
        const runningHeat = heatsRepo.findRunning();
        if (!runningHeat) {
          return respondJson({
            heatId: null,
            running: false,
            elapsedMs: 0,
          });
        }

        const elapsedMs = getElapsedMsFromStartedAt(runningHeat.started_at);
        heatsRepo.updateStatus(runningHeat.id, "pending");

        return respondJson({
          heatId: runningHeat.id,
          running: false,
          elapsedMs,
        });
      },
    },
  },
  development: {
    hmr: true,
    console: true,
  },
});

console.log(`Derby Race Server running on http://localhost:${port}`);
