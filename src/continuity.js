const { ensureHappeningIdentity, validateHappeningShape } = require("./happenings");
const { nextHappeningId, nextReferentId } = require("./ids");
const { admittedReceipt, rejectedReceipt, deferredReceipt } = require("./receipts");

function normalizeEvaluationDecision(decision) {
  if (!decision || typeof decision !== "object") {
    return {
      decision: "admitted",
      reasons: [],
    };
  }

  const normalizedDecision = String(decision.decision || "admitted").trim() || "admitted";
  const reasons = Array.isArray(decision.reasons)
    ? decision.reasons
        .map((reason) => (typeof reason === "string" ? String(reason).trim() : ""))
        .filter(Boolean)
    : [];

  return {
    decision: normalizedDecision,
    reasons: reasons.length > 0 ? reasons : ["no reasons provided"],
  };
}

function normalizeActorObserverId(continuity, happening, observerId) {
  const fromActor = String(happening?.actorObserverId || "").trim();
  if (fromActor) {
    return fromActor;
  }
  return String(observerId || continuity.ownerObserverId || "").trim() || continuity.ownerObserverId;
}

function normalizeBranchType(branchType) {
  if (branchType === undefined || branchType === null) {
    return "default-continuity";
  }
  return String(branchType).trim() || "default-continuity";
}

function assertContinuity(continuity) {
  if (!continuity || typeof continuity !== "object") {
    throw new Error("continuity must be an object");
  }
  if (typeof continuity.ownerObserverId !== "string" || !continuity.ownerObserverId.trim()) {
    throw new Error("continuity.ownerObserverId is required");
  }
  if (!Array.isArray(continuity.events)) {
    throw new Error("continuity.events must be an array");
  }
}

function createContinuity(ownerObserverId, branchType = "default-continuity") {
  if (typeof ownerObserverId !== "string" || !ownerObserverId.trim()) {
    throw new Error("ownerObserverId is required");
  }

  return {
    ownerObserverId,
    branchType: normalizeBranchType(branchType),
    events: [],
  };
}

function appendEvent(continuity, event) {
  assertContinuity(continuity);
  if (!event || typeof event !== "object") {
    throw new Error("event must be an object");
  }

  return {
    ...continuity,
    branchType: normalizeBranchType(continuity.branchType),
    events: [...continuity.events, { ...event }],
  };
}

function appendAdmittedHappening(continuity, happening) {
  assertContinuity(continuity);
  const normalized = ensureHappeningIdentity(continuity, validateHappeningShape(happening));
  if (normalized.id && continuity.events.some((event) => event && event.id === normalized.id)) {
    throw new Error(`duplicate happening id ${normalized.id}`);
  }

  return appendEvent(continuity, normalized);
}

function evaluateAdmittance({
  continuity,
  happening,
  state = null,
  observerId,
  activeRbcRules = [],
  evaluateRbc,
  rulebook,
  context = {},
}) {
  const resolvedObserverId = String(observerId || continuity?.ownerObserverId || "unknown").trim();

  if (!continuity || typeof continuity !== "object") {
    return rejectedReceipt({
      observerId: resolvedObserverId,
      actorObserverId: resolvedObserverId,
      reasons: ["continuity is required"],
    });
  }
  if (!Array.isArray(continuity.events)) {
    return rejectedReceipt({
      observerId: String(continuity.ownerObserverId || resolvedObserverId),
      actorObserverId: resolvedObserverId,
      reasons: ["continuity.events must be an array"],
    });
  }

  let normalized;
  try {
    normalized = validateHappeningShape(happening);
  } catch (error) {
    return rejectedReceipt({
      observerId: String(continuity.ownerObserverId || resolvedObserverId),
      actorObserverId: resolvedObserverId,
      reasons: [String(error.message || "invalid happening")],
    });
  }

  const actorObserverId = normalizeActorObserverId(continuity, normalized, resolvedObserverId);
  if (!actorObserverId) {
    return rejectedReceipt({
      observerId: String(continuity.ownerObserverId || resolvedObserverId),
      actorObserverId: resolvedObserverId,
      reasons: ["actorObserverId is required"],
    });
  }

  const happeningId = normalized.id || null;
  const parentHappeningId = normalized.parentHappeningId || null;
  const seatReferentId =
    normalized.seatReferentId ||
    normalized.throughSeatReferentId ||
    normalized.sourceSeatReferentId ||
    null;

  if (typeof evaluateRbc === "function") {
    const rbcDecision = normalizeEvaluationDecision(
      evaluateRbc(normalized, activeRbcRules, {
        continuity,
        state,
        actorObserverId,
        ...context,
      })
    );

    if (rbcDecision.decision !== "admitted") {
      return rejectedReceipt({
        observerId: continuity.ownerObserverId,
        actorObserverId,
        happeningId,
        parentHappeningId,
        seatReferentId,
        reasons: rbcDecision.reasons,
      });
    }
  }

  if (typeof rulebook === "function") {
    const ruleDecision = normalizeEvaluationDecision(
      rulebook(normalized, state, {
        continuity,
        actorObserverId,
        activeRbcRules,
        ...context,
      })
    );

    if (ruleDecision.decision === "deferred") {
      return deferredReceipt({
        observerId: continuity.ownerObserverId,
        actorObserverId,
        happeningId,
        parentHappeningId,
        seatReferentId,
        reasons: ruleDecision.reasons,
      });
    }

    if (ruleDecision.decision !== "admitted") {
      return rejectedReceipt({
        observerId: continuity.ownerObserverId,
        actorObserverId,
        happeningId,
        parentHappeningId,
        seatReferentId,
        reasons: ruleDecision.reasons,
      });
    }
  }

  return admittedReceipt({
    observerId: continuity.ownerObserverId,
    actorObserverId,
    happeningId,
    parentHappeningId,
    seatReferentId,
    reasons: ["admission passes admissibility and rules"],
  });
}

function deriveState(continuity, reducer, initialState = {}) {
  assertContinuity(continuity);
  if (typeof reducer !== "function") {
    throw new Error("reducer must be a function");
  }

  let state = initialState;

  for (let i = 0; i < continuity.events.length; i += 1) {
    const event = continuity.events[i];
    state = reducer(state, event, {
      continuity,
      eventIndex: i,
    });
  }

  return state;
}

function normalizeContinuityBranchType(continuity, branchType) {
  return String(branchType || continuity?.branchType || "default-continuity").trim() || "default-continuity";
}

function cloneContinuityEnvelope(continuity) {
  return {
    ownerObserverId: continuity.ownerObserverId,
    branchType: normalizeContinuityBranchType(continuity),
    events: continuity.events.slice(0),
  };
}

function validateReplay(continuity, reducer, rulebook, initialState = {}) {
  assertContinuity(continuity);
  if (typeof reducer !== "function") {
    throw new Error("reducer must be a function");
  }
  const rulefn =
    typeof rulebook === "function"
      ? rulebook
      : () => ({
          decision: "admitted",
          reasons: [],
        });

  let state = initialState;
  const report = {
    valid: true,
    state: initialState,
    failures: [],
  };

  for (let i = 0; i < continuity.events.length; i += 1) {
    const event = continuity.events[i];
    const decision = rulefn(event, state, {
      continuity,
      eventIndex: i,
    }) || {};

    if (decision.decision !== "admitted") {
      report.valid = false;
      report.failures.push({
        happeningId: event.id || null,
        kind: event.kind || "unknown",
        reasons: Array.isArray(decision.reasons) && decision.reasons.length > 0
          ? decision.reasons
          : ["rulebook rejected event"],
      });
      continue;
    }

    state = reducer(state, event, {
      continuity,
      eventIndex: i,
    });
  }

  report.state = state;
  return report;
}

function createReferentId(continuity) {
  return nextReferentId(continuity);
}

module.exports = {
  createContinuity,
  appendEvent,
  appendAdmittedHappening,
  evaluateAdmittance,
  deriveState,
  validateReplay,
  assertContinuity,
  normalizeContinuityBranchType,
  cloneContinuityEnvelope,
  nextHappeningId,
  createReferentId,
};
