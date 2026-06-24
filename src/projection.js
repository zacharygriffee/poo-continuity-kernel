const { createHappening } = require("./happenings");
const { appendAdmittedHappening } = require("./continuity");
const { admittedReceipt, rejectedReceipt } = require("./receipts");
const { EVENT_KIND_EXTERNAL_SEAT_PROJECTION_ADMITTED, EVENT_KIND_EXTERNAL_REFERENT_ADMITTED } = require("./event-kinds");
const {
  deriveSeatMapState,
  deriveActiveSeatContext,
  inMap,
  resolveActorSeatContext,
  computeOffset,
  applyOffset,
  slotIndex,
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

  if (sourceContinuity.branchType && sourceContinuity.branchType !== "seat-dag-continuity-v2") {
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
};

function normalizeAdmitSeatProjectionArgs(localContinuity, sourceOrObserverId, seatOrSourceObserverId, maybeSeatOrActorId, maybeActorOrSourceContinuity) {
  const actorFromContinuity = String(localContinuity?.ownerObserverId || "unknown").trim();

  if (typeof sourceOrObserverId === "string") {
    const sourceContinuity =
      typeof maybeActorOrSourceContinuity === "object" && maybeActorOrSourceContinuity !== null
        ? maybeActorOrSourceContinuity
        : undefined;

    return {
      actorObserverId: sourceContinuity
        ? String(maybeSeatOrActorId || actorFromContinuity).trim() || actorFromContinuity
        : String(
            typeof maybeActorOrSourceContinuity !== "undefined" ? maybeActorOrSourceContinuity : actorFromContinuity
          )
            .trim()
            .trim() || actorFromContinuity,
      sourceObserverId: String(sourceOrObserverId || "").trim(),
      seatReferentId: String(seatOrSourceObserverId || "").trim(),
      sourceContinuity,
    };
  }

  if (typeof sourceOrObserverId === "object" && sourceOrObserverId !== null) {
    return {
      actorObserverId: String(maybeSeatOrActorId || actorFromContinuity).trim() || actorFromContinuity,
      sourceObserverId: String(seatOrSourceObserverId || "").trim(),
      seatReferentId: String(maybeActorOrSourceContinuity || "").trim(),
      sourceContinuity: sourceOrObserverId,
    };
  }

  return {
    actorObserverId: actorFromContinuity,
    sourceObserverId: "",
    seatReferentId: "",
    sourceContinuity: undefined,
  };
}

function admitSeatProjection(localContinuity, sourceOrObserverId, seatOrSourceObserverId, maybeSeatOrActorId, maybeActorOrSourceContinuity) {
  if (!localContinuity || !localContinuity.ownerObserverId) {
    return {
      continuity: localContinuity,
      receipt: rejectedReceipt({
        observerId: localContinuity?.ownerObserverId || "unknown",
        reasons: ["local continuity is required"],
      }),
    };
  }

  const parsed = normalizeAdmitSeatProjectionArgs(
    localContinuity,
    sourceOrObserverId,
    seatOrSourceObserverId,
    maybeSeatOrActorId,
    maybeActorOrSourceContinuity
  );

  const actorObserverId = parsed.actorObserverId;
  const sourceObserverId = parsed.sourceObserverId;
  const seatReferentId = parsed.seatReferentId;
  const sourceContinuity = parsed.sourceContinuity;

  if (!sourceObserverId) {
    return {
      continuity: localContinuity,
      receipt: rejectedReceipt({
        observerId: localContinuity.ownerObserverId,
        actorObserverId,
        reasons: ["sourceObserverId is required"],
      }),
    };
  }

  if (!seatReferentId) {
    return {
      continuity: localContinuity,
      receipt: rejectedReceipt({
        observerId: localContinuity.ownerObserverId,
        actorObserverId,
        reasons: ["seatReferentId is required"],
      }),
    };
  }

  if (!sourceContinuity || typeof sourceContinuity !== "object") {
    return {
      continuity: localContinuity,
      receipt: rejectedReceipt({
        observerId: localContinuity.ownerObserverId,
        actorObserverId,
        reasons: ["sourceContinuity is required for projection admission"],
      }),
    };
  }

  if (hasProjectionEventForSeat(localContinuity, actorObserverId, sourceObserverId, seatReferentId)) {
    return {
      continuity: localContinuity,
      receipt: rejectedReceipt({
        observerId: localContinuity.ownerObserverId,
        actorObserverId,
        reasons: ["Projection already admitted for this source/seat"],
      }),
    };
  }

  const sourceValidation = validateSeatProjectionSource(sourceContinuity, sourceObserverId, seatReferentId);
  if (!sourceValidation.valid) {
    return {
      continuity: localContinuity,
      receipt: rejectedReceipt({
        observerId: localContinuity.ownerObserverId,
        actorObserverId,
        reasons: sourceValidation.reasons,
      }),
    };
  }

  const projectionEvent = createHappening({
    actorObserverId,
    kind: EVENT_KIND_EXTERNAL_SEAT_PROJECTION_ADMITTED,
    sourceObserverId,
    throughSeatReferentId: seatReferentId,
    sourceSeatReferentId: seatReferentId,
    payload: {
      sourceObserverId,
      seatReferentId,
      sourceSeatSnapshot: sourceSeatSnapshotFromState(sourceContinuity, seatReferentId),
    },
  });

  return {
    continuity: appendAdmittedHappening(localContinuity, projectionEvent),
    receipt: admittedReceipt({
      observerId: localContinuity.ownerObserverId,
      actorObserverId,
      happeningId: projectionEvent.id,
      seatReferentId,
      sourceObserverId,
      reasons: ["seat projection admitted for local continuity context"],
    }),
  };
}

function admitExternalReferent(localContinuity, sourceObserverId, referentId, actorObserverId, sourceContinuity, options = {}) {
  if (!localContinuity || !localContinuity.ownerObserverId) {
    return {
      continuity: localContinuity,
      receipt: rejectedReceipt({
        observerId: actorObserverId || "unknown",
        reasons: ["local continuity is required"],
      }),
    };
  }

  const actor = String(actorObserverId || localContinuity.ownerObserverId).trim();
  const source = String(sourceObserverId || "").trim();
  const ref = String(referentId || "").trim();
  const projectionContinuationMap = options.projectionContinuationByObserver || options.projectionContinuityByObserver || {};
  const maybeContext = options.context || {};

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

  const alreadyAdmitted = (localContinuity.events || []).some((event) => {
    if (!event || typeof event !== "object") return false;
    if (event.kind !== EVENT_KIND_EXTERNAL_REFERENT_ADMITTED) return false;
    return event.actorObserverId === actor && event.sourceObserverId === source && event.referentId === ref;
  });

  if (alreadyAdmitted) {
    return {
      continuity: localContinuity,
      receipt: rejectedReceipt({
        observerId: localContinuity.ownerObserverId,
        actorObserverId: actor,
        reasons: ["External referent already admitted"],
      }),
    };
  }

  const baseEvent = {
    actorObserverId: actor,
    kind: EVENT_KIND_EXTERNAL_REFERENT_ADMITTED,
    sourceObserverId: source,
    referentId: ref,
  };

  if (!sourceContinuity || typeof sourceContinuity !== "object") {
    return {
      continuity: appendAdmittedHappening(localContinuity, createHappening(baseEvent)),
      receipt: admittedReceipt({
        observerId: localContinuity.ownerObserverId,
        actorObserverId: actor,
        reasons: ["external referent admitted as visible-only"],
        sourceObserverId: source,
        referentId: ref,
      }),
    };
  }

  const sourceState = deriveSeatMapState(sourceContinuity);
  const sourceReferent = sourceState.referentsById[ref];
  if (!sourceReferent) {
    return {
      continuity: localContinuity,
      receipt: rejectedReceipt({
        observerId: localContinuity.ownerObserverId,
        actorObserverId: actor,
        reasons: ["source referent does not exist"],
      }),
    };
  }

  const activeContext = deriveActiveSeatContext({
    observerId: actor,
    localContinuity,
    localState: maybeContext.localState || deriveSeatMapState(localContinuity),
    projectionContinuityByObserver: {
      ...(projectionContinuationMap || {}),
      [source]: sourceContinuity,
    },
  });
  const seatContext = resolveActorSeatContext(maybeContext.localState || deriveSeatMapState(localContinuity), actor, {
    projectionContinuityByObserver: {
      ...(projectionContinuationMap || {}),
      [source]: sourceContinuity,
    },
  });

  const isProjectionMode = activeContext && activeContext.mode === "projection-only";

  if (
    !activeContext ||
    activeContext.mode === "unseated" ||
    !seatContext ||
    (seatContext.mode === "projection" && !seatContext.slot && !seatContext.row)
  ) {
    const admitted = {
      actorObserverId: actor,
      kind: EVENT_KIND_EXTERNAL_REFERENT_ADMITTED,
      sourceObserverId: source,
      referentId: ref,
      reasons: ["no active local or projection seat; realization mapped to source-only coordinates"],
    };
    return {
      continuity: appendAdmittedHappening(localContinuity, createHappening(admitted)),
      receipt: admittedReceipt({
        observerId: localContinuity.ownerObserverId,
        actorObserverId: actor,
        reasons: ["external referent admitted without projection mapping"],
        sourceObserverId: source,
        referentId: ref,
      }),
    };
  }

  if (typeof slotIndex(sourceReferent.slot) !== "number" || typeof seatContext.slot !== "string" || !inMap(seatContext.slot, seatContext.row)) {
    return {
      continuity: localContinuity,
      receipt: rejectedReceipt({
        observerId: localContinuity.ownerObserverId,
        actorObserverId: actor,
        reasons: ["projection seat context is not mappable"],
      }),
    };
  }

  const sourceSeat = isProjectionMode
    ? sourceContextSeatFromProjection(activeContext) || sourceState.seatBranchesById[activeContext.sourceSeatReferentId]
    : sourceState.seatBranchesById[seatContext.seatReferentId];

  if (isProjectionMode && !sourceSeat) {
    return {
      continuity: localContinuity,
      receipt: rejectedReceipt({
        observerId: localContinuity.ownerObserverId,
        actorObserverId: actor,
        reasons: ["projection source seat is unavailable for relative mapping"],
      }),
    };
  }

  if (!isProjectionMode && !sourceSeat) {
    return {
      continuity: localContinuity,
      receipt: rejectedReceipt({
        observerId: localContinuity.ownerObserverId,
        actorObserverId: actor,
        reasons: ["projection mapping requires an active projected seat context"],
      }),
    };
  }

  if (!sourceSeat) {
    return {
      continuity: localContinuity,
      receipt: rejectedReceipt({
        observerId: localContinuity.ownerObserverId,
        actorObserverId: actor,
        reasons: ["projection source seat is unavailable for relative mapping"],
      }),
    };
  }

  const offset = computeOffset(sourceSeat.slot, sourceSeat.row, sourceReferent.slot, sourceReferent.row);
  const projected = applyOffset(seatContext.slot, seatContext.row, offset.dslot, offset.drow);
  if (!projected) {
    return {
      continuity: localContinuity,
      receipt: rejectedReceipt({
        observerId: localContinuity.ownerObserverId,
        actorObserverId: actor,
        reasons: ["realized external referent is outside local RBC map"],
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
    sourceSeatReferentId: seatContext.seatReferentId,
    sourceSlot: sourceReferent.slot,
    sourceRow: sourceReferent.row,
    projectedSlot: projected.slot,
    projectedRow: projected.row,
  });

  return {
    continuity: appendAdmittedHappening(localContinuity, resolved),
    receipt: admittedReceipt({
      observerId: localContinuity.ownerObserverId,
      actorObserverId: actor,
      happeningId: resolved.id,
      sourceObserverId: source,
      referentId: ref,
      reasons: ["external referent realized through projection-relative mapping"],
      nonClaims: ["realization does not mutate source continuity"],
    }),
  };
}

function sourceContextSeatFromProjection(activeContext) {
  if (!activeContext || activeContext.mode !== "projection-only") {
    return null;
  }
  const sourceContinuity = activeContext.projectionSourceContinuity;
  if (!sourceContinuity) {
    return null;
  }
  const sourceState = deriveSeatMapState(sourceContinuity);
  const seatRef = activeContext.sourceSeatReferentId;
  return sourceState.seatBranchesById[seatRef] || null;
}

function realizeExternalReferent(localContinuity, args = {}) {
  const {
    sourceObserverId,
    referentId,
    actorObserverId,
    sourceContinuity,
    projectionContinuityByObserver = {},
  } = args;

  return admitExternalReferent(
    localContinuity,
    sourceObserverId,
    referentId,
    actorObserverId,
    sourceContinuity,
    {
      projectionContinuityByObserver,
      context: {},
      localState: deriveSeatMapState(localContinuity),
    }
  );
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

  const sourceObserverId = String(
    projectionEvent.sourceObserverId || projectionEvent.payload?.sourceObserverId || ""
  ).trim();
  const seatReferentId = String(
    projectionEvent.seatReferentId || projectionEvent.payload?.seatReferentId || ""
  ).trim();

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
  admitExternalReferent,
  realizeExternalReferent,
  validateProjection,
  rejectWriteThroughProjection,
  sourceSeatSnapshotFromState,
};
