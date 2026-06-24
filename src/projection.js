const { createHappening } = require("./happenings");
const { appendAdmittedHappening } = require("./continuity");
const { admittedReceipt, rejectedReceipt } = require("./receipts");
const {
  EVENT_KIND_EXTERNAL_SEAT_PROJECTION_ADMITTED,
  EVENT_KIND_EXTERNAL_REFERENT_ADMITTED,
} = require("./event-kinds");
const {
  deriveSeatMapState,
  deriveActiveSeatContext,
  computeOffset,
  applyOffset,
  inMap,
  BRANCH_TYPE,
} = require("./seat-map-domain");

function createProjectionReferent(input = {}) {
  const id = String(input.id || "").trim();
  if (!id) {
    throw new Error("projection referent id is required");
  }

  return {
    id,
    kind: "projection-referent",
    type: input.type || "projection",
    ownerObserverId: input.ownerObserverId || "unknown",
    sourceObserverId: input.sourceObserverId || input.ownerObserverId || "unknown",
    slot: input.slot,
    row: input.row,
    targetKind: input.targetKind || "referent",
    title: input.title || `Projection ${id}`,
  };
}

function hasProjectionEventForSeat(localContinuity, actorObserverId, sourceObserverId, seatReferentId) {
  return (localContinuity?.events || []).some((event) => {
    if (!event || typeof event !== "object") return false;
    if (event.kind !== EVENT_KIND_EXTERNAL_SEAT_PROJECTION_ADMITTED) return false;
    return (
      event.actorObserverId === actorObserverId &&
      event.sourceObserverId === sourceObserverId &&
      String(event.seatReferentId || event.sourceSeatReferentId || "").trim() === seatReferentId
    );
  });
}

function validateSeatProjectionSource(sourceContinuity, sourceObserverId, seatReferentId) {
  if (!sourceContinuity || !Array.isArray(sourceContinuity.events)) {
    return {
      valid: false,
      reasons: ["source continuity is required"],
    };
  }

  if (sourceContinuity.branchType && sourceContinuity.branchType !== BRANCH_TYPE) {
    return {
      valid: false,
      reasons: ["source continuity is not seat-map v2 branch"],
    };
  }

  const sourceState = deriveSeatMapState(sourceContinuity);
  if (!sourceState.seatBranchesById[seatReferentId]) {
    return {
      valid: false,
      reasons: ["source continuity does not contain seat referent"],
    };
  }

  if (String(sourceContinuity.ownerObserverId || "").trim() !== String(sourceObserverId || "").trim()) {
    return {
      valid: false,
      reasons: ["source observer id does not own source continuity"],
    };
  }

  return {
    valid: true,
    reasons: ["projection source seat validated"],
  };
}

function sourceSeatSnapshotFromState(sourceContinuity, seatReferentId) {
  const sourceState = deriveSeatMapState(sourceContinuity);
  const sourceSeat = sourceState.seatBranchesById[seatReferentId];
  if (!sourceSeat) {
    return null;
  }

  return {
    seatReferentId,
    slot: sourceSeat.slot,
    row: sourceSeat.row,
    sprite: sourceSeat.sprite || "S",
    title: sourceSeat.title || `source seat ${seatReferentId}`,
    ownerObserverId: sourceSeat.ownerObserverId || sourceContinuity.ownerObserverId,
    originHappeningId: sourceSeat.originHappeningId || null,
    sourceSeatId: seatReferentId,
    sourceObserverId: sourceContinuity.ownerObserverId,
  };
}

function admitSeatProjection({ localContinuity, actorObserverId, sourceObserverId, sourceContinuity, seatReferentId }) {
  if (!localContinuity || !localContinuity.ownerObserverId) {
    return {
      continuity: localContinuity,
      receipt: rejectedReceipt({
        observerId: localContinuity?.ownerObserverId || "unknown",
        actorObserverId: String(actorObserverId || "").trim() || localContinuity?.ownerObserverId || "unknown",
        reasons: ["local continuity is required"],
      }),
    };
  }

  const actor = String(actorObserverId || localContinuity.ownerObserverId || "").trim();
  const source = String(sourceObserverId || "").trim();
  const seat = String(seatReferentId || "").trim();

  if (!source) {
    return {
      continuity: localContinuity,
      receipt: rejectedReceipt({
        observerId: localContinuity.ownerObserverId,
        actorObserverId: actor,
        reasons: ["sourceObserverId is required"],
      }),
    };
  }

  if (!seat) {
    return {
      continuity: localContinuity,
      receipt: rejectedReceipt({
        observerId: localContinuity.ownerObserverId,
        actorObserverId: actor,
        reasons: ["seatReferentId is required"],
      }),
    };
  }

  if (!sourceContinuity || typeof sourceContinuity !== "object") {
    return {
      continuity: localContinuity,
      receipt: rejectedReceipt({
        observerId: localContinuity.ownerObserverId,
        actorObserverId: actor,
        reasons: ["sourceContinuity is required for projection admission"],
      }),
    };
  }

  if (hasProjectionEventForSeat(localContinuity, actor, source, seat)) {
    return {
      continuity: localContinuity,
      receipt: rejectedReceipt({
        observerId: localContinuity.ownerObserverId,
        actorObserverId: actor,
        reasons: ["Projection already admitted for this source/seat"],
      }),
    };
  }

  const sourceValidation = validateSeatProjectionSource(sourceContinuity, source, seat);
  if (!sourceValidation.valid) {
    return {
      continuity: localContinuity,
      receipt: rejectedReceipt({
        observerId: localContinuity.ownerObserverId,
        actorObserverId: actor,
        reasons: sourceValidation.reasons,
      }),
    };
  }

  const projectionEvent = createHappening({
    actorObserverId: actor,
    kind: EVENT_KIND_EXTERNAL_SEAT_PROJECTION_ADMITTED,
    sourceObserverId: source,
    throughSeatReferentId: seat,
    sourceSeatReferentId: seat,
    payload: {
      sourceObserverId: source,
      seatReferentId: seat,
      sourceSeatSnapshot: sourceSeatSnapshotFromState(sourceContinuity, seat),
    },
  });

  return {
    continuity: appendAdmittedHappening(localContinuity, projectionEvent),
    receipt: admittedReceipt({
      observerId: localContinuity.ownerObserverId,
      actorObserverId: actor,
      happeningId: projectionEvent.id,
      parentHappeningId: projectionEvent.parentHappeningId || null,
      seatReferentId: seat,
      sourceObserverId: source,
      reasons: ["seat projection admitted for local continuity context"],
    }),
  };
}

function admitSeatProjectionLegacy(localContinuity, sourceObserverId, seatReferentId, actorObserverId, sourceContinuity) {
  return admitSeatProjection({
    localContinuity,
    sourceObserverId,
    sourceContinuity,
    seatReferentId,
    actorObserverId,
  });
}

function admitExternalReferentClaim({ localContinuity, actorObserverId, sourceObserverId, referentId }) {
  if (!localContinuity || !localContinuity.ownerObserverId) {
    return {
      continuity: localContinuity,
      receipt: rejectedReceipt({
        observerId: localContinuity?.ownerObserverId || "unknown",
        actorObserverId: String(actorObserverId || "").trim() || localContinuity?.ownerObserverId || "unknown",
        reasons: ["local continuity is required"],
      }),
    };
  }

  const actor = String(actorObserverId || localContinuity.ownerObserverId).trim();
  const source = String(sourceObserverId || "").trim();
  const referent = String(referentId || "").trim();

  if (!source || !referent) {
    return {
      continuity: localContinuity,
      receipt: rejectedReceipt({
        observerId: localContinuity.ownerObserverId,
        actorObserverId: actor,
        reasons: ["sourceObserverId and referentId are required"],
      }),
    };
  }

  const alreadyAdmitted = (localContinuity.events || []).some((event) => {
    return (
      event &&
      event.kind === EVENT_KIND_EXTERNAL_REFERENT_ADMITTED &&
      event.actorObserverId === actor &&
      event.sourceObserverId === source &&
      event.referentId === referent &&
      event.payload?.claimOnly
    );
  });

  if (alreadyAdmitted) {
    return {
      continuity: localContinuity,
      receipt: rejectedReceipt({
        observerId: localContinuity.ownerObserverId,
        actorObserverId: actor,
        reasons: ["external referent claim already admitted"],
      }),
    };
  }

  const claim = createHappening({
    actorObserverId: actor,
    kind: EVENT_KIND_EXTERNAL_REFERENT_ADMITTED,
    sourceObserverId: source,
    referentId: referent,
    payload: {
      claimOnly: true,
      sourceObserverId: source,
    },
  });

  return {
    continuity: appendAdmittedHappening(localContinuity, claim),
    receipt: admittedReceipt({
      observerId: localContinuity.ownerObserverId,
      actorObserverId: actor,
      happeningId: claim.id,
      parentHappeningId: claim.parentHappeningId || null,
      seatReferentId: claim.seatReferentId || null,
      sourceObserverId: source,
      referentId: referent,
      reasons: ["external referent claim admitted without source realization"],
      nonClaims: ["claim admission does not prove the source referent exists"],
    }),
  };
}

function realizeExternalReferent({
  localContinuity,
  actorObserverId,
  sourceObserverId,
  sourceContinuity,
  referentId,
  projectionContinuityByObserver = {},
  context = {},
}) {
  if (!localContinuity || !localContinuity.ownerObserverId) {
    return {
      continuity: localContinuity,
      receipt: rejectedReceipt({
        observerId: localContinuity?.ownerObserverId || "unknown",
        actorObserverId: String(actorObserverId || "").trim() || localContinuity?.ownerObserverId || "unknown",
        reasons: ["local continuity is required"],
      }),
    };
  }

  const actor = String(actorObserverId || localContinuity.ownerObserverId).trim();
  const source = String(sourceObserverId || "").trim();
  const ref = String(referentId || "").trim();

  if (!source || !ref) {
    return {
      continuity: localContinuity,
      receipt: rejectedReceipt({
        observerId: localContinuity.ownerObserverId,
        actorObserverId: actor,
        reasons: ["sourceObserverId and referentId are required"],
      }),
    };
  }

  if (!sourceContinuity || !Array.isArray(sourceContinuity.events)) {
    return {
      continuity: localContinuity,
      receipt: rejectedReceipt({
        observerId: localContinuity.ownerObserverId,
        actorObserverId: actor,
        reasons: ["source continuity is required for source realization"],
      }),
    };
  }

  const sourceOwner = String(sourceContinuity.ownerObserverId || "").trim();
  if (sourceOwner && sourceOwner !== source) {
    return {
      continuity: localContinuity,
      receipt: rejectedReceipt({
        observerId: localContinuity.ownerObserverId,
        actorObserverId: actor,
        reasons: ["source continuity owner does not match sourceObserverId"],
      }),
    };
  }

  if (sourceContinuity.branchType && String(sourceContinuity.branchType) !== BRANCH_TYPE) {
    return {
      continuity: localContinuity,
      receipt: rejectedReceipt({
        observerId: localContinuity.ownerObserverId,
        actorObserverId: actor,
        reasons: ["source continuity is not seat-map v2 branch"],
      }),
    };
  }

  const localState = context.localState || deriveSeatMapState(localContinuity);
  const activeContext = deriveActiveSeatContext({
    observerId: actor,
    localContinuity,
    localState,
    projectionContinuityByObserver: {
      ...projectionContinuityByObserver,
      ...(context.projectionContinuityByObserver || {}),
      [source]: sourceContinuity,
    },
  });

  if (!activeContext || activeContext.mode === "invalid" || activeContext.mode === "unseated") {
    return {
      continuity: localContinuity,
      receipt: rejectedReceipt({
        observerId: localContinuity.ownerObserverId,
        actorObserverId: actor,
        reasons: ["active seat context is required to realize external referent"],
      }),
    };
  }

  if (activeContext.mode === "projection-only" && activeContext.sourceObserverId && activeContext.sourceObserverId !== source) {
    return {
      continuity: localContinuity,
      receipt: rejectedReceipt({
        observerId: localContinuity.ownerObserverId,
        actorObserverId: actor,
        reasons: ["active projection source does not match requested source observer"],
      }),
    };
  }

  if (activeContext.mode === "owned-local" && String(localContinuity.ownerObserverId) !== source) {
    return {
      continuity: localContinuity,
      receipt: rejectedReceipt({
        observerId: localContinuity.ownerObserverId,
        actorObserverId: actor,
        reasons: ["local occupied source does not match requested source observer"],
      }),
    };
  }

  const sourceState = deriveSeatMapState(sourceContinuity);
  const sourceSeat = sourceState.seatBranchesById[activeContext.sourceSeatReferentId];
  const localSeat = localState.observerSeatByObserverId[actor];

  if (!sourceSeat || !localSeat) {
    return {
      continuity: localContinuity,
      receipt: rejectedReceipt({
        observerId: localContinuity.ownerObserverId,
        actorObserverId: actor,
        reasons: ["projection source seat is unavailable for relative mapping"],
      }),
    };
  }

  if (!inMap(sourceSeat.slot, sourceSeat.row) || !inMap(localSeat.slot, localSeat.row)) {
    return {
      continuity: localContinuity,
      receipt: rejectedReceipt({
        observerId: localContinuity.ownerObserverId,
        actorObserverId: actor,
        reasons: ["projection seat context is not mappable"],
      }),
    };
  }

  const sourceReferent = sourceState.referentsById[ref];
  if (!sourceReferent || !inMap(sourceReferent.slot, sourceReferent.row)) {
    return {
      continuity: localContinuity,
      receipt: rejectedReceipt({
        observerId: localContinuity.ownerObserverId,
        actorObserverId: actor,
        reasons: ["source referent does not exist"],
      }),
    };
  }

  const offset = computeOffset(sourceSeat.slot, sourceSeat.row, sourceReferent.slot, sourceReferent.row);
  const projected = applyOffset(localSeat.slot, localSeat.row, offset.dslot, offset.drow);
  if (!projected) {
    return {
      continuity: localContinuity,
      receipt: rejectedReceipt({
        observerId: localContinuity.ownerObserverId,
        actorObserverId: actor,
        reasons: ["realization is outside local RBC map"],
      }),
    };
  }

  const resolved = createHappening({
    actorObserverId: actor,
    kind: EVENT_KIND_EXTERNAL_REFERENT_ADMITTED,
    sourceObserverId: source,
    referentId: ref,
    slot: projected.slot,
    row: projected.row,
    sourceSeatReferentId: localSeat.seatReferentId,
    sourceSeatSlot: sourceSeat.slot,
    sourceSeatRow: sourceSeat.row,
    sourceReferentSlot: sourceReferent.slot,
    sourceReferentRow: sourceReferent.row,
    projectedSlot: projected.slot,
    projectedRow: projected.row,
    projectionSourceSeatReferentId: sourceSeat.id || activeContext.sourceSeatReferentId,
  });

  return {
    continuity: appendAdmittedHappening(localContinuity, resolved),
    receipt: admittedReceipt({
      observerId: localContinuity.ownerObserverId,
      actorObserverId: actor,
      happeningId: resolved.id,
      parentHappeningId: resolved.parentHappeningId || null,
      seatReferentId: localSeat.seatReferentId,
      sourceObserverId: source,
      referentId: ref,
      reasons: ["external referent realized through projection-relative mapping"],
      nonClaims: ["realization does not mutate source continuity"],
    }),
  };
}

function realizeExternalReferentLegacy(localContinuity, args = {}) {
  return realizeExternalReferent({ localContinuity, ...args });
}

function validateProjection(projectionEvent, sourceContinuity) {
  if (!projectionEvent || typeof projectionEvent !== "object") {
    return {
      valid: false,
      reasons: ["projection event is required"],
    };
  }

  if (projectionEvent.kind !== EVENT_KIND_EXTERNAL_SEAT_PROJECTION_ADMITTED) {
    return {
      valid: false,
      reasons: ["projection event kind mismatch"],
    };
  }

  const sourceObserverId = String(projectionEvent.sourceObserverId || projectionEvent.payload?.sourceObserverId || "").trim();
  const seatReferentId = String(projectionEvent.seatReferentId || projectionEvent.payload?.seatReferentId || "").trim();

  if (!sourceObserverId || !seatReferentId) {
    return {
      valid: false,
      reasons: ["projection event requires sourceObserverId and seatReferentId"],
    };
  }

  return validateSeatProjectionSource(sourceContinuity, sourceObserverId, seatReferentId);
}

function rejectWriteThroughProjection(action = "write", actorObserverId = "unknown") {
  return rejectedReceipt({
    observerId: actorObserverId,
    reasons: [`projection is read-only and cannot perform action: ${action}`],
    nonClaims: ["projection does not grant write authority"],
  });
}

module.exports = {
  createProjectionReferent,
  admitSeatProjection,
  admitSeatProjectionLegacy,
  admitExternalReferentClaim,
  realizeExternalReferent,
  admitExternalReferentLegacy: realizeExternalReferentLegacy,
  validateProjection,
  rejectWriteThroughProjection,
  sourceSeatSnapshotFromState,
};
