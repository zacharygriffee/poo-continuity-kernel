const { createHappening } = require("./happenings");
const { appendAdmittedHappening } = require("./continuity");
const { admittedReceipt, rejectedReceipt } = require("./receipts");
const { EVENT_KIND_JOIN_POINT_ADMITTED } = require("./event-kinds");

function createJoinPoint(input = {}) {
  const sourceObserverId = String(input.sourceObserverId || "").trim();
  if (!sourceObserverId) {
    throw new Error("sourceObserverId is required");
  }

  const sourceHappeningId = String(input.sourceHappeningId || input.happeningId || "").trim();
  if (!sourceHappeningId) {
    throw new Error("sourceHappeningId is required");
  }

  return {
    kind: "join-point-referent",
    ownerObserverId: input.ownerObserverId || "unknown",
    sourceObserverId,
    sourceHappeningId,
    constraints: input.constraints || {},
    title: input.title || `join from ${sourceObserverId}`,
    nonClaims: ["join does not merge histories or retroactively infer causality"],
  };
};

function admitJoinPoint(localContinuity, joinPoint, sourceContinuity, observerId) {
  if (!localContinuity || !localContinuity.ownerObserverId) {
    return {
      continuity: localContinuity,
      receipt: rejectedReceipt({
        observerId: localContinuity?.ownerObserverId || "unknown",
        reasons: ["local continuity is required"],
      }),
    };
  }
  if (!joinPoint || joinPoint.kind !== "join-point-referent") {
    return {
      continuity: localContinuity,
      receipt: rejectedReceipt({
        observerId: localContinuity.ownerObserverId,
        reasons: ["join point kind is invalid"],
      }),
    };
  }
  if (!sourceContinuity || !Array.isArray(sourceContinuity.events)) {
    return {
      continuity: localContinuity,
      receipt: rejectedReceipt({
        observerId: localContinuity.ownerObserverId,
        actorObserverId: actorFromContinuity(localContinuity, observerId),
        reasons: ["source continuity required for join point admission"],
      }),
    };
  }

  const eventExists = (localContinuity.events || []).some(
    (event) =>
      event.kind === EVENT_KIND_JOIN_POINT_ADMITTED &&
      event.sourceObserverId === joinPoint.sourceObserverId &&
      event.sourceHappeningId === joinPoint.sourceHappeningId
  );
  if (eventExists) {
    return {
      continuity: localContinuity,
      receipt: rejectedReceipt({
        observerId: localContinuity.ownerObserverId,
        actorObserverId: actorFromContinuity(localContinuity, observerId),
        reasons: ["join point already admitted"],
      }),
    };
  }

  const sourceHasAnchor = sourceContinuity.events.some((event) => event.id === joinPoint.sourceHappeningId);
  if (!sourceHasAnchor) {
    return {
      continuity: localContinuity,
      receipt: rejectedReceipt({
        observerId: localContinuity.ownerObserverId,
        actorObserverId: actorFromContinuity(localContinuity, observerId),
        reasons: ["source continuity does not contain sourceHappeningId"],
      }),
    };
  }

  const event = createHappening({
    actorObserverId: actorFromContinuity(localContinuity, observerId),
    kind: EVENT_KIND_JOIN_POINT_ADMITTED,
    payload: {
      joinPoint,
      sourceObserverId: joinPoint.sourceObserverId,
      sourceHappeningId: joinPoint.sourceHappeningId,
    },
  });
  event.sourceObserverId = joinPoint.sourceObserverId;
  event.sourceHappeningId = joinPoint.sourceHappeningId;

  return {
    continuity: appendAdmittedHappening(localContinuity, event),
    receipt: admittedReceipt({
      observerId: localContinuity.ownerObserverId,
      actorObserverId: actorFromContinuity(localContinuity, observerId),
      happeningId: event.id,
      reasons: ["join point admitted", "history prior to join is unchanged"],
      sourceObserverId: joinPoint.sourceObserverId,
      sourceHappeningId: joinPoint.sourceHappeningId,
    }),
  };
}

function actorFromContinuity(continuity, actor) {
  return String(actor || continuity?.ownerObserverId || "unknown").trim();
}

function validateJoinCandidate(localContinuity, sourceContinuity, joinPoint, rulebook) {
  if (!localContinuity || !sourceContinuity || !joinPoint) {
    return {
      valid: false,
      reasons: ["continuities and join point are required"],
    };
  }
  if (joinPoint.kind !== "join-point-referent") {
    return {
      valid: false,
      reasons: ["join point kind is invalid"],
    };
  }
  if (!sourceContinuity.events.some((event) => event.id === joinPoint.sourceHappeningId)) {
    return {
      valid: false,
      reasons: ["source anchor does not exist in source continuity"],
    };
  }

  if (typeof rulebook === "function") {
    const decision = rulebook({
      localContinuity: localContinuity,
      sourceContinuity,
      joinPoint,
    });
    if (decision?.decision !== "admitted") {
      return {
        valid: false,
        reasons: Array.isArray(decision?.reasons) && decision.reasons.length > 0
          ? decision.reasons
          : ["join rejected by rulebook"],
      };
    }
  }

  return {
    valid: true,
    reasons: ["join candidate is forward-compatible admission"],
    nonClaims: ["join does not blend or merge continuities"],
  };
}

module.exports = {
  createJoinPoint,
  admitJoinPoint,
  validateJoinCandidate,
};
