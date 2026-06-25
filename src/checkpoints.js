const { createHappening } = require("./happenings");
const { appendAdmittedHappening } = require("./continuity");
const { admittedReceipt, rejectedReceipt } = require("./receipts");
const { EVENT_KIND_CHECKPOINT_ADMITTED } = require("./event-kinds");
const { createRandomId } = require("./ids");

function createCheckpoint(input = {}) {
  const ownerObserverId = String(input.ownerObserverId || input.sourceObserverId || "unknown").trim();
  if (!ownerObserverId) {
    throw new Error("ownerObserverId is required");
  }

  const segmentId = String(input.segmentId || "").trim() || createRandomId("seg");
  const startIndex = Number.isInteger(input.startIndex) ? input.startIndex : 0;
  const endIndex = Number.isInteger(input.endIndex) ? input.endIndex : startIndex;
  if (startIndex < 0 || endIndex < startIndex) {
    throw new Error("checkpoint startIndex/endIndex are invalid");
  }

  return {
    kind: "segment-anchor",
    ownerObserverId,
    segmentId,
    startIndex,
    endIndex,
    endState: input.endState || null,
    claim: input.claim || "checkpoint for bounded alignment",
    nonClaims: ["checkpoint is alignment only, not full replay proof"],
  };
}

function admitCheckpoint(localContinuity, sourceObserverId, checkpoint, payload = {}) {
  if (!localContinuity || !localContinuity.ownerObserverId) {
    return {
      continuity: localContinuity,
      receipt: rejectedReceipt({
        observerId: localContinuity?.ownerObserverId || "unknown",
        reasons: ["local continuity is required"],
      }),
    };
  }
  if (!sourceObserverId || !checkpoint) {
    return {
      continuity: localContinuity,
      receipt: rejectedReceipt({
        observerId: localContinuity.ownerObserverId,
        reasons: ["sourceObserverId and checkpoint are required"],
      }),
    };
  }

  const event = createHappening({
    actorObserverId: localContinuity.ownerObserverId,
    kind: EVENT_KIND_CHECKPOINT_ADMITTED,
    sourceSeatReferentId: payload.sourceSeatReferentId || null,
    payload: {
      sourceObserverId,
      checkpoint,
    },
  });
  event.checkpoint = checkpoint;

  return {
    continuity: appendAdmittedHappening(localContinuity, event),
    receipt: admittedReceipt({
      observerId: localContinuity.ownerObserverId,
      actorObserverId: localContinuity.ownerObserverId,
      happeningId: event.id,
      sourceObserverId,
      reasons: ["checkpoint admitted as bounded replay anchor"],
      nonClaims: ["checkpoint is not global truth"],
    }),
  };
}

function validateFromCheckpoint(sourceContinuity, checkpoint, options = {}) {
  if (!sourceContinuity || !Array.isArray(sourceContinuity.events)) {
    return {
      valid: false,
      reasons: ["source continuity is required"],
    };
  }

  if (!checkpoint || checkpoint.kind !== "segment-anchor") {
    return {
      valid: false,
      reasons: ["checkpoint kind is invalid"],
    };
  }

  if (!Number.isInteger(checkpoint.startIndex) || !Number.isInteger(checkpoint.endIndex)) {
    return {
      valid: false,
      reasons: ["checkpoint indices must be integers"],
    };
  }
  if (checkpoint.startIndex < 0 || checkpoint.endIndex < checkpoint.startIndex) {
    return {
      valid: false,
      reasons: ["checkpoint indices are inconsistent"],
    };
  }

  if (checkpoint.endIndex > sourceContinuity.events.length) {
    return {
      valid: false,
      reasons: ["checkpoint endIndex exceeds source continuity length"],
    };
  }

  const targetOwner = String(checkpoint.ownerObserverId || "").trim();
  if (targetOwner && targetOwner !== sourceContinuity.ownerObserverId) {
    return {
      valid: false,
      reasons: ["checkpoint belongs to another observer"],
    };
  }

  if (typeof options.stateReducer === "function" && options.expectedState != null) {
    const { deriveState } = require("./continuity");
    const reducedState = deriveState(
      {
        ownerObserverId: sourceContinuity.ownerObserverId,
        events: sourceContinuity.events.slice(0, checkpoint.endIndex),
      },
      options.stateReducer,
      options.initialState || {}
    );
    if (JSON.stringify(reducedState) !== JSON.stringify(options.expectedState)) {
      return {
        valid: false,
        reasons: ["checkpoint state mismatch"],
      };
    }
  }

  return {
    valid: true,
    reasons: ["checkpoint validates bounded alignment"],
    nonClaims: ["checkpoint is admissibility alignment, not canonical history"],
  };
}

module.exports = {
  createCheckpoint,
  admitCheckpoint,
  validateFromCheckpoint,
};
