const SLOT_ORDER = ["left", "center", "right"];
const SLOT_INDEX = Object.freeze({
  left: 0,
  center: 1,
  right: 2,
});
const SLOT_SET = new Set(SLOT_ORDER);
const HEIGHT = 14;
const MAX_STEP = 1;

const { SEAT_MAP_BRANCH_TYPE, ...EVENT_KIND } = require("./event-kinds");

const BRANCH_TYPE = SEAT_MAP_BRANCH_TYPE;
const BASE_EVENT_BRANCH_TYPE = SEAT_MAP_BRANCH_TYPE;

function normalizeBranchType(branchType) {
  if (branchType === undefined || branchType === null) {
    return "";
  }
  return String(branchType).trim();
}

function isSeatMapContinuity(continuity) {
  return normalizeBranchType(continuity?.branchType) === BRANCH_TYPE;
}

function normalizeSlot(slot) {
  return String(slot || "").trim().toLowerCase();
}

function normalizeRow(row) {
  const parsed = Number(row);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : null;
}

function normalizeSeat(slot, row) {
  return {
    slot: normalizeSlot(slot),
    row: normalizeRow(row),
  };
}

function inMap(slot, row) {
  const slotValue = normalizeSlot(slot);
  const rowValue = normalizeRow(row);
  return SLOT_SET.has(slotValue) && Number.isInteger(rowValue) && rowValue >= 0 && rowValue < HEIGHT;
}

function slotIndex(slot) {
  return SLOT_INDEX[String(slot || "").trim().toLowerCase()];
}

function slotFromIndex(index) {
  const normalized = Number.isInteger(index) ? index : Number(index);
  return SLOT_ORDER[normalized] || "";
}

function manhattan(aSlot, aRow, bSlot, bRow) {
  const from = slotIndex(aSlot);
  const to = slotIndex(bSlot);
  if (!Number.isInteger(from) || !Number.isInteger(to)) {
    return Number.POSITIVE_INFINITY;
  }
  const rowDelta = Number(aRow) - Number(bRow);
  if (!Number.isFinite(rowDelta)) {
    return Number.POSITIVE_INFINITY;
  }
  return Math.abs(from - to) + Math.abs(rowDelta);
}

function computeOffset(sourceSeatSlot, sourceSeatRow, sourceTargetSlot, sourceTargetRow) {
  return {
    dslot: slotIndex(sourceTargetSlot) - slotIndex(sourceSeatSlot),
    drow: normalizeRow(sourceTargetRow) - normalizeRow(sourceSeatRow),
  };
}

function applyOffset(baseSlot, baseRow, dslot, drow) {
  const baseIndex = slotIndex(baseSlot);
  if (!Number.isInteger(baseIndex)) {
    return null;
  }

  const row = normalizeRow(baseRow) + Number(drow || 0);
  const slot = slotFromIndex(baseIndex + Number(dslot || 0));
  if (!inMap(slot, row)) {
    return null;
  }
  return { slot, row };
}

function createSeatMapState() {
  return {
    branchType: BRANCH_TYPE,
    referentsById: {},
    seatBranchesById: {},
    occupancyBySeatId: {},
    observerSeatByObserverId: {},
    latestValidHappeningBySeatId: {},
    fallenOutAtHappeningId: {},
    admittedExternalReferents: [],
    projections: [],
  };
}

function seatOccupancyForSeat(state, seatReferentId) {
  if (!state.occupancyBySeatId[seatReferentId]) {
    state.occupancyBySeatId[seatReferentId] = {};
  }
  return state.occupancyBySeatId[seatReferentId];
}

function removeObserverFromAllSeats(state, observerId) {
  if (!observerId) {
    return;
  }

  for (const [seatId, branch] of Object.entries(state.seatBranchesById)) {
    if (branch?.occupants) {
      delete branch.occupants[observerId];
      if (Object.keys(branch.occupants).length === 0) {
        delete branch.occupants;
      }
    }

    const seatOccupants = state.occupancyBySeatId[seatId];
    if (seatOccupants && typeof seatOccupants === "object") {
      delete seatOccupants[observerId];
      if (Object.keys(seatOccupants).length === 0) {
        delete state.occupancyBySeatId[seatId];
      }
    }
  }

  delete state.observerSeatByObserverId[observerId];
}

function setSeatOccupant(state, seatReferentId, actorObserverId, metadata) {
  const branch = state.seatBranchesById[seatReferentId];
  if (!branch) {
    return;
  }

  branch.occupants = branch.occupants || {};
  branch.occupants[actorObserverId] = metadata;
  const seatOccupants = seatOccupancyForSeat(state, seatReferentId);
  seatOccupants[actorObserverId] = metadata;
}

function computeReferentPositionFromEvent(event) {
  const slot = normalizeSlot(event.slot);
  const row = normalizeRow(event.row);
  return {
    hasPosition: SLOT_SET.has(slot) && Number.isInteger(row),
    slot,
    row,
  };
}

function normalizeProjectionSeatBranchFromEvent(event, continuity) {
  const sourceObserverId = String(event.sourceObserverId || "").trim();
  const seatReferentId = String(event.seatReferentId || event.sourceSeatReferentId || "").trim();
  const seatPayload = event.payload || {};
  const snapshot = seatPayload.sourceSeatSnapshot || {};
  const slot = normalizeSlot(snapshot.slot || seatPayload.sourceSlot || snapshot.sourceSlot || "");
  const row = normalizeRow(snapshot.row != null ? snapshot.row : snapshot.sourceRow);

  if (!seatReferentId || !SLOT_SET.has(slot) || !Number.isInteger(row)) {
    return null;
  }

  return {
    id: seatReferentId,
    kind: "seat-branch",
    type: "seat",
    slot,
    row,
    sprite: snapshot.sprite || "S",
    title: snapshot.title || `source seat ${seatReferentId}`,
    ownerObserverId: snapshot.ownerObserverId || sourceObserverId || continuity.ownerObserverId,
    sourceObserverId: sourceObserverId || continuity.ownerObserverId,
    createdByObserverId: event.actorObserverId || continuity.ownerObserverId,
    originHappeningId: snapshot.originHappeningId || event.parentHappeningId || null,
    creationHappeningId: event.id || null,
    throughSeatReferentId: snapshot.throughSeatReferentId || null,
    sourceSeatSnapshot: snapshot,
    isProjectionSeat: true,
    latestValidHappeningId: event.id || null,
    occupants: {},
  };
}

function markProjectionSeatOccupancy(state, event, continuity) {
  const actorObserverId = String(event.actorObserverId || "").trim();
  const seatReferentId = String(event.seatReferentId || event.sourceSeatReferentId || "").trim();
  if (!actorObserverId || !seatReferentId) {
    return;
  }

  const branch = state.seatBranchesById[seatReferentId];
  if (!branch) {
    return;
  }

  removeObserverFromAllSeats(state, actorObserverId);
  setSeatOccupant(state, seatReferentId, actorObserverId, {
    observerId: actorObserverId,
    seatReferentId,
    sourceObserverId: branch.sourceObserverId || continuity.ownerObserverId,
    occupiedAtHappeningId: event.id || null,
    mode: "projection",
  });

  state.observerSeatByObserverId[actorObserverId] = {
    observerId: actorObserverId,
    sourceObserverId: branch.sourceObserverId || continuity.ownerObserverId,
    seatReferentId,
    slot: branch.slot,
    row: branch.row,
    occupiedAtHappeningId: event.id || null,
    latestValidHappeningId: event.id || branch.latestValidHappeningId,
    mode: "projection",
  };
  branch.latestValidHappeningId = event.id || branch.latestValidHappeningId;
  state.latestValidHappeningBySeatId[seatReferentId] = event.id || state.latestValidHappeningBySeatId[seatReferentId];
}

function deriveSeatMapState(continuity) {
  const state = createSeatMapState();

  if (!isSeatMapContinuity(continuity)) {
    return state;
  }

  const events = Array.isArray(continuity.events) ? continuity.events : [];

  for (const event of events) {
    if (!event || typeof event !== "object") {
      continue;
    }

    const kind = String(event.kind || "");
    const seatReferentId = String(event.seatReferentId || event.throughSeatReferentId || event.sourceSeatReferentId || "");
    const actorObserverId = event.actorObserverId;

    if (kind === EVENT_KIND.EVENT_KIND_REFERENT_CREATED) {
      const referentId = String(event.referentId || "").trim();
      const { hasPosition, slot, row } = computeReferentPositionFromEvent(event);
      if (!referentId || !hasPosition || !inMap(slot, row)) {
        continue;
      }

      const referent = {
        id: referentId,
        kind: "referent",
        type: String(event.type || "artifact"),
        sprite: event.sprite,
        title: event.title || `${event.type || "referent"} ${referentId}`,
        slot,
        row,
        ownerObserverId: event.ownerObserverId || event.actorObserverId || continuity.ownerObserverId,
        createdByObserverId: event.createdByObserverId || event.actorObserverId || continuity.ownerObserverId,
        originHappeningId: event.originHappeningId || null,
        creationHappeningId: event.id || null,
        throughSeatReferentId: event.throughSeatReferentId || null,
      };
      state.referentsById[referentId] = referent;

      if (referent.type === "seat") {
        state.seatBranchesById[referentId] = {
          ...referent,
          latestValidHappeningId: event.id || null,
          occupants: {},
          isProjectionSeat: false,
        };
        if (!state.latestValidHappeningBySeatId[referentId]) {
          state.latestValidHappeningBySeatId[referentId] = event.id || null;
        }
      }
      continue;
    }

    if (kind === EVENT_KIND.EVENT_KIND_SEAT_OCCUPIED) {
      if (!seatReferentId || !actorObserverId) {
        continue;
      }

      const branch = state.seatBranchesById[seatReferentId];
      if (!branch) {
        continue;
      }

      const current = {
        observerId: actorObserverId,
        seatReferentId,
        sourceObserverId: event.sourceObserverId || branch.sourceObserverId || continuity.ownerObserverId,
        occupiedAtHappeningId: event.id || null,
        mode: branch.isProjectionSeat ? "projection" : "local",
      };

      removeObserverFromAllSeats(state, actorObserverId);
      setSeatOccupant(state, seatReferentId, actorObserverId, current);
      state.observerSeatByObserverId[actorObserverId] = {
        observerId: actorObserverId,
        sourceObserverId: branch.sourceObserverId || continuity.ownerObserverId,
        seatReferentId,
        slot: branch.slot,
        row: branch.row,
        occupiedAtHappeningId: event.id || null,
        latestValidHappeningId: event.id || branch.latestValidHappeningId,
        mode: branch.isProjectionSeat ? "projection" : "local",
      };
      branch.latestValidHappeningId = event.id || branch.latestValidHappeningId;
      state.latestValidHappeningBySeatId[seatReferentId] = event.id || state.latestValidHappeningBySeatId[seatReferentId];
      continue;
    }

    if (kind === EVENT_KIND.EVENT_KIND_SEAT_VACATED) {
      if (!seatReferentId || !actorObserverId) {
        continue;
      }

      const branch = state.seatBranchesById[seatReferentId];
      if (branch && branch.occupants) {
        delete branch.occupants[actorObserverId];
        if (Object.keys(branch.occupants).length === 0) {
          delete branch.occupants;
        }
      }

      const seatOccupants = seatOccupancyForSeat(state, seatReferentId);
      delete seatOccupants[actorObserverId];
      if (Object.keys(seatOccupants).length === 0) {
        delete state.occupancyBySeatId[seatReferentId];
      }

      delete state.observerSeatByObserverId[actorObserverId];
      if (branch) {
        branch.latestValidHappeningId = event.id || branch.latestValidHappeningId;
      }
      state.latestValidHappeningBySeatId[seatReferentId] = event.id || state.latestValidHappeningBySeatId[seatReferentId];
      continue;
    }

    if (kind === EVENT_KIND.EVENT_KIND_SEAT_POSITION_CHANGED) {
      const branch = state.seatBranchesById[seatReferentId];
      if (!branch) {
        if (actorObserverId) {
          state.fallenOutAtHappeningId[actorObserverId] = event.id || null;
        }
        continue;
      }

      const actorSeat = state.observerSeatByObserverId[actorObserverId];
      if (!actorSeat || actorSeat.seatReferentId !== seatReferentId) {
        if (actorObserverId) {
          state.fallenOutAtHappeningId[actorObserverId] = event.id || null;
        }
        continue;
      }

      const from = event.from || actorSeat;
      if (branch.slot !== normalizeSlot(from.slot) || branch.row !== normalizeRow(from.row)) {
        state.fallenOutAtHappeningId[actorObserverId] = event.id || null;
        continue;
      }

      if (!inMap(from.slot, from.row) || !inMap(event.to?.slot, event.to?.row)) {
        state.fallenOutAtHappeningId[actorObserverId] = event.id || null;
        continue;
      }

      const distance = manhattan(from.slot, from.row, event.to.slot, event.to.row);
      if (!Number.isFinite(distance) || distance > MAX_STEP) {
        state.fallenOutAtHappeningId[actorObserverId] = event.id || null;
        continue;
      }

      branch.slot = normalizeSlot(event.to.slot);
      branch.row = normalizeRow(event.to.row);
      branch.latestValidHappeningId = event.id || branch.latestValidHappeningId;
      state.latestValidHappeningBySeatId[seatReferentId] = event.id || state.latestValidHappeningBySeatId[seatReferentId];

      if (state.referentsById[seatReferentId]) {
        state.referentsById[seatReferentId].slot = branch.slot;
        state.referentsById[seatReferentId].row = branch.row;
      }

      for (const occupantId of Object.keys(branch.occupants || {})) {
        if (!state.observerSeatByObserverId[occupantId]) {
          continue;
        }
        state.observerSeatByObserverId[occupantId] = {
          ...state.observerSeatByObserverId[occupantId],
          slot: branch.slot,
          row: branch.row,
          latestValidHappeningId: event.id || state.observerSeatByObserverId[occupantId].latestValidHappeningId,
        };
      }

      continue;
    }

    if (kind === EVENT_KIND.EVENT_KIND_EXTERNAL_SEAT_PROJECTION_ADMITTED) {
      state.projections.push(event);

      const projectedBranch = normalizeProjectionSeatBranchFromEvent(event, continuity);
      if (projectedBranch) {
        const existing = state.seatBranchesById[projectedBranch.id];
        state.seatBranchesById[projectedBranch.id] = existing
          ? {
              ...existing,
              ...projectedBranch,
              occupants: existing.occupants || {},
              latestValidHappeningId: event.id || existing.latestValidHappeningId || null,
            }
          : projectedBranch;
      }

      markProjectionSeatOccupancy(state, event, continuity);
      continue;
    }

    if (kind === EVENT_KIND.EVENT_KIND_EXTERNAL_REFERENT_ADMITTED) {
      state.admittedExternalReferents.push(event);
      continue;
    }
  }

  return state;
}

function getObserverSeat(state, observerId) {
  if (!state || !observerId) {
    return null;
  }
  const seat = state.observerSeatByObserverId[observerId];
  if (!seat || state.fallenOutAtHappeningId[observerId]) {
    return null;
  }
  return seat;
}

function currentSeatForObserver(continuity, observerId) {
  const state = deriveSeatMapState(continuity);
  return getObserverSeat(state, observerId);
}

function latestProjectionForObserver(state, observerId) {
  if (!state || !observerId) {
    return null;
  }
  return (state.projections || []).filter((event) => event.actorObserverId === observerId).slice(-1)[0] || null;
}

function resolveActorSeatContext(state, actorObserverId, options = {}) {
  if (!state || !actorObserverId) {
    return null;
  }

  const localSeat = state.observerSeatByObserverId[actorObserverId];
  if (localSeat && !state.fallenOutAtHappeningId[actorObserverId]) {
    return {
      ...localSeat,
      actorObserverId,
      mode: localSeat.mode || "local",
    };
  }

  const latestProjection = latestProjectionForObserver(state, actorObserverId);
  if (!latestProjection) {
    return null;
  }

  const sourceObserverId = String(
    latestProjection.sourceObserverId || latestProjection.payload?.sourceObserverId || ""
  ).trim();
  if (!sourceObserverId) {
    return {
      mode: "projection",
      actorObserverId,
      sourceObserverId: "",
      seatReferentId: String(latestProjection.seatReferentId || "").trim(),
      reasons: ["projection source observer id missing"],
    };
  }

  const projectionContinuity =
    options.projectionContinuityByObserver?.[sourceObserverId] ||
    options.sourceContinuities?.[sourceObserverId] ||
    options.projectionContinuities?.[sourceObserverId];

  if (!projectionContinuity) {
    return {
      mode: "projection",
      actorObserverId,
      sourceObserverId,
      seatReferentId: String(latestProjection.seatReferentId || "").trim(),
      reasons: ["projection source continuity missing for derivation context"],
    };
  }

  if (!isSeatMapContinuity(projectionContinuity)) {
    return {
      mode: "projection",
      actorObserverId,
      sourceObserverId,
      seatReferentId: String(latestProjection.seatReferentId || "").trim(),
      reasons: ["projection source continuity uses non-seat branch"],
    };
  }

  const sourceState = deriveSeatMapState(projectionContinuity);
  const sourceSeatReferentId = String(
    latestProjection.seatReferentId || latestProjection.sourceSeatReferentId || ""
  ).trim();
  const sourceSeat = sourceState.seatBranchesById[sourceSeatReferentId];
  if (!sourceSeat) {
    return {
      mode: "projection",
      actorObserverId,
      sourceObserverId,
      seatReferentId: sourceSeatReferentId,
      reasons: ["projection source seat no longer exists"],
    };
  }

  return {
    mode: "projection",
    actorObserverId,
    sourceObserverId,
    seatReferentId: sourceSeatReferentId,
    slot: sourceSeat.slot,
    row: sourceSeat.row,
    sourceSeat: sourceSeat,
  };
}

function validateSeatCreationOriginContinuity(state) {
  return Object.keys(state.seatBranchesById || {}).length === 0;
}

function validateSeatLineageThroughSource(state, sourceSeatReferentId) {
  if (!sourceSeatReferentId) {
    return false;
  }
  const branch = state.seatBranchesById[sourceSeatReferentId];
  return !!branch;
}

function validateSeatMapHappening(continuity, happening, options = {}) {
  const state = options.state || deriveSeatMapState(continuity);
  if (!continuity || typeof continuity !== "object") {
    return {
      decision: "rejected",
      reasons: ["continuity is required"],
      nonClaims: ["continuity envelope is required for admission checks"],
    };
  }

    if (!isSeatMapContinuity(continuity)) {
      return {
        decision: "rejected",
        reasons: [`branchType is not ${BRANCH_TYPE}`],
      };
    }

  if (!happening || typeof happening !== "object") {
    return {
      decision: "rejected",
      reasons: ["happening is required"],
      nonClaims: ["happening envelope is required for admission checks"],
    };
  }

  const actorObserverId = String(happening.actorObserverId || "").trim();
  if (!actorObserverId) {
    return {
      decision: "rejected",
      reasons: ["actorObserverId is required"],
    };
  }

  const kind = String(happening.kind || "");
  const seatReferentId = String(
    happening.seatReferentId || happening.throughSeatReferentId || happening.sourceSeatReferentId || ""
  ).trim();
  const actorSeatContext = resolveActorSeatContext(state, actorObserverId, options);

    if (kind === EVENT_KIND.EVENT_KIND_REFERENT_CREATED) {
    const type = String(happening.type || "artifact").trim() || "artifact";
    const referentId = String(happening.referentId || "").trim();
    const slot = normalizeSlot(happening.slot);
    const row = normalizeRow(happening.row);

    if (!referentId) {
      return {
        decision: "rejected",
        reasons: ["referentId is required for referent-created"],
      };
    }
    if (!inMap(slot, row)) {
      return {
        decision: "rejected",
        reasons: ["position must be inside map bounds"],
      };
    }

    if (type === "seat") {
      if (!happening.throughSeatReferentId && !validateSeatCreationOriginContinuity(state)) {
        return {
          decision: "rejected",
          reasons: ["origin seat creation is only allowed from empty continuity"],
        };
      }

      const lineageSeat = String(happening.throughSeatReferentId || actorSeatContext?.seatReferentId || "").trim();
      if (lineageSeat && !validateSeatLineageThroughSource(state, lineageSeat)) {
        return {
          decision: "rejected",
          reasons: ["new seat must reference an existing seat referent branch"],
        };
      }

      if (!lineageSeat && actorSeatContext && actorSeatContext.mode === "projection") {
        return {
          decision: "rejected",
          reasons: ["projection seat creation requires explicit throughSeatReferentId"],
        };
      }

      if (lineageSeat && actorSeatContext && actorSeatContext.mode === "projection" && actorSeatContext.seatReferentId !== lineageSeat) {
        return {
          decision: "rejected",
          reasons: ["actor is not in the lineage seat branch"],
        };
      }

      return {
        decision: "admitted",
        reasons: ["seat creation is continuity-bearing"],
      };
    }

    if (!actorSeatContext) {
      return {
        decision: "rejected",
        reasons: ["non-seat referent creation requires occupied seat context"],
      };
    }

    if (actorSeatContext.mode && actorSeatContext.mode.startsWith("projection") && !actorSeatContext.sourceObserverId) {
      return {
        decision: "rejected",
        reasons: ["projection context missing source observer id"],
      };
    }

    return {
      decision: "admitted",
      reasons: ["referent creation admitted"],
    };
  }

    if (kind === EVENT_KIND.EVENT_KIND_SEAT_OCCUPIED) {
    if (!seatReferentId) {
      return {
        decision: "rejected",
        reasons: ["seat-occupied requires seat referent id"],
      };
    }

    const targetSeat = state.seatBranchesById[seatReferentId];
    if (!targetSeat) {
      return {
        decision: "rejected",
        reasons: ["target seat branch does not exist"],
      };
    }

    if (actorSeatContext && actorSeatContext.mode === "projection" && actorSeatContext.seatReferentId !== seatReferentId) {
      return {
        decision: "rejected",
        reasons: ["projection actor can only occupy projection seat context"],
      };
    }

    return {
      decision: "admitted",
      reasons: ["seat occupation admitted"],
    };
  }

    if (kind === EVENT_KIND.EVENT_KIND_SEAT_VACATED) {
    if (!seatReferentId) {
      return {
        decision: "rejected",
        reasons: ["seat-vacated requires seat referent id"],
      };
    }

    if (!actorSeatContext || actorSeatContext.seatReferentId !== seatReferentId) {
      return {
        decision: "rejected",
        reasons: ["actor is not currently occupying this seat branch"],
      };
    }

    return {
      decision: "admitted",
      reasons: ["seat vacate admitted"],
    };
  }

    if (kind === EVENT_KIND.EVENT_KIND_SEAT_POSITION_CHANGED) {
    if (!seatReferentId) {
      return {
        decision: "rejected",
        reasons: ["seat-position-changed requires seat referent id"],
      };
    }

    if (!actorSeatContext || actorSeatContext.seatReferentId !== seatReferentId) {
      return {
        decision: "rejected",
        reasons: ["actor must occupy the seat branch to move it"],
      };
    }

    if (!inMap(actorSeatContext.slot, actorSeatContext.row)) {
      return {
        decision: "rejected",
        reasons: ["active actor seat is outside map bounds"],
      };
    }

    const branch = state.seatBranchesById[seatReferentId];
    if (!branch) {
      return {
        decision: "rejected",
        reasons: ["target seat branch does not exist"],
      };
    }

    if (!inMap(happening.to?.slot, happening.to?.row)) {
      return {
        decision: "rejected",
        reasons: ["target position is out of map bounds"],
      };
    }

    const from = happening.from || actorSeatContext;
    if (branch.slot !== normalizeSlot(from.slot) || branch.row !== normalizeRow(from.row)) {
      return {
        decision: "rejected",
        reasons: ["event from position does not match current branch position"],
      };
    }

    const distance = manhattan(from.slot, from.row, happening.to.slot, happening.to.row);
    if (!Number.isFinite(distance) || distance > MAX_STEP) {
      return {
        decision: "rejected",
        reasons: ["movement exceeds max step"],
      };
    }

    return {
      decision: "admitted",
      reasons: ["seat movement admitted"],
    };
  }

  return {
    decision: "deferred",
    reasons: ["event kind is not handled by seat-map rulebook"],
  };
}

function isSeatMapEventKind(kind) {
  return [
    EVENT_KIND.EVENT_KIND_REFERENT_CREATED,
    EVENT_KIND.EVENT_KIND_SEAT_OCCUPIED,
    EVENT_KIND.EVENT_KIND_SEAT_VACATED,
    EVENT_KIND.EVENT_KIND_SEAT_POSITION_CHANGED,
    EVENT_KIND.EVENT_KIND_EXTERNAL_SEAT_PROJECTION_ADMITTED,
    EVENT_KIND.EVENT_KIND_EXTERNAL_REFERENT_ADMITTED,
  ].includes(String(kind || ""));
}

function createSeatMapRulebook(context = {}) {
  return function seatMapRulebook(happening, _state, options = {}) {
    return validateSeatMapHappening(options.continuity || context.continuity, happening, {
      ...context,
      ...options,
      state: options.state || _state,
    });
  };
}

function deriveActiveSeatContext({
  observerId,
  localContinuity,
  localState = deriveSeatMapState(localContinuity || {}),
  projectionContinuityByObserver = {},
}) {
  const normalizedObserver = String(observerId || "").trim();
  if (!normalizedObserver) {
    return {
      mode: "invalid",
      reasons: ["observerId is required"],
    };
  }

  const localSeat = getObserverSeat(localState, normalizedObserver);
  if (localSeat) {
    const projectionSourceContinuity = projectionContinuityByObserver[localSeat.sourceObserverId] || null;
    const projectionSourceState = projectionSourceContinuity ? deriveSeatMapState(projectionSourceContinuity) : null;
    const projectedSeat = localSeat.mode === "projection" && projectionSourceState
      ? projectionSourceState.seatBranchesById[localSeat.seatReferentId]
      : null;

    return {
      mode: localSeat.mode === "projection" ? "projection-only" : "owned-local",
      activeObserverId: normalizedObserver,
      localContinuity: localContinuity || null,
      activeSeat: {
        ...localSeat,
        sourceSeat: projectedSeat || null,
      },
      projection: {
        seatReferentId: localSeat.seatReferentId,
        sourceObserverId: localSeat.sourceObserverId || null,
        projectionSourceContinuity,
      },
      projectionSourceContinuity,
      sourceObserverId: localSeat.sourceObserverId || null,
      sourceSeatReferentId: localSeat.seatReferentId,
    };
  }

  const latestProjection = (localState.projections || [])
    .filter((projection) => projection.actorObserverId === normalizedObserver)
    .slice(-1)[0];

  if (!latestProjection) {
    return {
      mode: "unseated",
      reasons: ["observer has no occupied local seat and no projection"],
      activeSeat: null,
      localState,
      localContinuity: localContinuity || null,
      projection: null,
      projectionSourceContinuity: null,
      sourceObserverId: null,
      sourceSeatReferentId: null,
    };
  }

  const sourceObserverId = String(latestProjection.sourceObserverId || "").trim();
  const sourceState = deriveSeatMapState(projectionContinuityByObserver[sourceObserverId] || {});
  const sourceSeat = sourceState.seatBranchesById[latestProjection.seatReferentId];
  if (!sourceObserverId || !sourceSeat) {
    return {
      mode: "projection-only",
      reasons: ["projection source not found or has no source seat"],
      activeSeat: null,
      localState,
      localContinuity: localContinuity || null,
      projection: latestProjection,
      projectionSourceContinuity: projectionContinuityByObserver[sourceObserverId] || null,
      sourceObserverId,
      sourceSeatReferentId: latestProjection.seatReferentId || null,
    };
  }

  return {
    mode: "projection-only",
    reasons: [],
    activeSeat: {
      sourceObserverId,
      seatReferentId: latestProjection.seatReferentId,
      slot: sourceSeat.slot,
      row: sourceSeat.row,
      sourceSeat,
      sourceSeatReferentId: latestProjection.seatReferentId,
    },
    localState,
    localContinuity: localContinuity || null,
    projection: latestProjection,
    projectionSourceContinuity: projectionContinuityByObserver[sourceObserverId] || null,
    sourceObserverId,
    sourceSeatReferentId: latestProjection.seatReferentId,
  };
}

function mapLineForState(state, options = {}) {
  const slots = options.slots || SLOT_ORDER;
  const height = Number.isFinite(options.height) ? options.height : HEIGHT;
  const rows = [];

  for (let row = 0; row < height; row += 1) {
    const cells = [];
    for (const slot of slots) {
      let cell = " . ";
      const seatForCell = Object.values(state.seatBranchesById || {}).find(
        (seat) => seat.slot === slot && seat.row === row
      );
      const artifactForCell = Object.values(state.referentsById || {}).find(
        (ref) => ref.type !== "seat" && ref.slot === slot && ref.row === row
      );

      if (artifactForCell) {
        cell = ` ${artifactForCell.sprite || artifactForCell.type || "?"} `;
      }
      if (seatForCell) {
        cell = ` ${seatForCell.sprite || "S"} `;
      }
      cells.push(cell);
    }
    rows.push(`r=${String(row).padStart(2, "0")} | ${cells.join("|")}`);
  }
  return rows.join("\n");
}

module.exports = {
  BRANCH_TYPE,
  BASE_EVENT_BRANCH_TYPE,
  SLOT_ORDER,
  SLOT_SET,
  HEIGHT,
  MAX_STEP,
  normalizeSlot,
  normalizeRow,
  inMap,
  slotIndex,
  slotFromIndex,
  manhattan,
  computeOffset,
  applyOffset,
  isSeatMapEventKind,
  isSeatMapContinuity,
  resolveActorSeatContext,
  validateSeatCreationOriginContinuity,
  validateSeatLineageThroughSource,
  validateSeatMapHappening,
  createSeatMapRulebook,
  createSeatMapState,
  deriveSeatMapState,
  currentSeatForObserver,
  deriveActiveSeatContext,
  mapLineForState,
};
