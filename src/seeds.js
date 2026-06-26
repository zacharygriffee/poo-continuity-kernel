const { createHappening } = require("./happenings");
const { appendAdmittedHappening } = require("./continuity");
const { admittedReceipt, rejectedReceipt } = require("./receipts");
const { EVENT_KIND_CONTINUITY_SEED_ADMITTED } = require("./event-kinds");

function computeDemoSliceFingerprint(events) {
  if (!Array.isArray(events)) return "";
  return events
    .map((event) => String(event.id || event.happeningId || ""))
    .join("|")
    .split("")
    .reduce((acc, char) => (acc * 31 + char.charCodeAt(0)) >>> 0, 0)
    .toString(16);
}

function createContinuitySeed(continuity, startIndex, endIndex, options = {}) {
  if (!continuity || !Array.isArray(continuity.events)) {
    throw new Error("continuity is required");
  }
  if (!Number.isInteger(startIndex) || !Number.isInteger(endIndex) || startIndex < 0 || endIndex < startIndex) {
    throw new Error("invalid seed indices");
  }
  if (endIndex > continuity.events.length) {
    throw new Error("endIndex exceeds continuity length");
  }

  const optionsSafe = options || {};
  const startSlice = continuity.events.slice(0, startIndex);
  const seedSlice = continuity.events.slice(startIndex, endIndex);
  const normalized = {
    kind: "continuity-seed-referent",
    ownerObserverId: continuity.ownerObserverId,
    branchType: continuity.branchType,
    startIndex,
    endIndex,
    startState: optionsSafe.startState || null,
    endState: optionsSafe.endState || null,
    startTailHash: computeDemoSliceFingerprint(startSlice),
    endTailHash: computeDemoSliceFingerprint(seedSlice),
    requiredHappenings: seedSlice.map((event) => event.id),
    stateReducer: optionsSafe.stateReducer ? "stateReducer-provided" : null,
    nonClaims: [
      "seed is bounded alignment only, not canonical history",
      "seed fingerprint is not cryptographic integrity",
      "demo fingerprint only; not a trust anchor",
    ],
  };
  return normalized;
}

function admitContinuitySeed(localContinuity, sourceObserverId, seed) {
  if (!localContinuity || !localContinuity.ownerObserverId) {
    return {
      continuity: localContinuity,
      receipt: rejectedReceipt({
        observerId: localContinuity?.ownerObserverId || "unknown",
        reasons: ["local continuity is required"],
      }),
    };
  }
  if (!seed || seed.kind !== "continuity-seed-referent") {
    return {
      continuity: localContinuity,
      receipt: rejectedReceipt({
        observerId: localContinuity.ownerObserverId,
        reasons: ["seed kind is invalid"],
      }),
    };
  }
  if (!sourceObserverId) {
    return {
      continuity: localContinuity,
      receipt: rejectedReceipt({
        observerId: localContinuity.ownerObserverId,
        reasons: ["sourceObserverId is required"],
      }),
    };
  }

  const event = createHappening({
    actorObserverId: localContinuity.ownerObserverId,
    kind: EVENT_KIND_CONTINUITY_SEED_ADMITTED,
    payload: {
      sourceObserverId,
      seed,
    },
  });
  event.seed = seed;

  return {
    continuity: appendAdmittedHappening(localContinuity, event),
    receipt: admittedReceipt({
      observerId: localContinuity.ownerObserverId,
      actorObserverId: localContinuity.ownerObserverId,
      happeningId: event.id,
      reasons: ["continuity seed admitted", "seed is bounded admissibility aid, not history"],
      sourceObserverId,
    }),
  };
}

function validateTailFromSeed(observerContinuity, sourceContinuity, seed, options = {}) {
  if (!sourceContinuity || !Array.isArray(sourceContinuity.events)) {
    return {
      valid: false,
      reasons: ["source continuity is required"],
    };
  }
  if (!seed || seed.kind !== "continuity-seed-referent") {
    return {
      valid: false,
      reasons: ["seed kind is invalid"],
    };
  }
  if (!Number.isInteger(seed.startIndex) || !Number.isInteger(seed.endIndex)) {
    return {
      valid: false,
      reasons: ["seed indices are invalid"],
    };
  }
  if (seed.endIndex > sourceContinuity.events.length) {
    return {
      valid: false,
      reasons: ["seed endIndex exceeds source continuity length"],
    };
  }

  if (seed.branchType && String(seed.branchType) !== String(sourceContinuity.branchType || "")) {
    return {
      valid: false,
      reasons: ["seed branchType does not match source continuity"],
    };
  }

  const sourceHead = sourceContinuity.events.slice(0, seed.startIndex);
  const sourceTail = sourceContinuity.events.slice(seed.startIndex, seed.endIndex);

  if (computeDemoSliceFingerprint(sourceHead) !== seed.startTailHash) {
    return {
      valid: false,
      reasons: ["startTailHash mismatch"],
    };
  }
  if (computeDemoSliceFingerprint(sourceTail) !== seed.endTailHash) {
    return {
      valid: false,
      reasons: ["endTailHash mismatch"],
    };
  }

  if (!Array.isArray(seed.requiredHappenings) || seed.requiredHappenings.length !== sourceTail.length) {
    return {
      valid: false,
      reasons: ["requiredHappenings length mismatch"],
    };
  }

  for (let i = 0; i < seed.requiredHappenings.length; i += 1) {
    if (String(seed.requiredHappenings[i] || "") !== String(sourceTail[i]?.id || "")) {
      return {
        valid: false,
        reasons: ["seed event list does not match source tail"],
      };
    }
  }

  if (
    typeof options.stateReducer === "function" &&
    options.expectedTailState != null &&
    options.initialState !== undefined
  ) {
    const { deriveState } = require("./continuity");
    const reduced = deriveState(
      {
        ownerObserverId: sourceContinuity.ownerObserverId,
        events: sourceTail,
      },
      options.stateReducer,
      options.initialState || {}
    );
    if (JSON.stringify(reduced) !== JSON.stringify(options.expectedTailState)) {
      return {
        valid: false,
        reasons: ["seed tail state mismatch"],
      };
    }
  }

  return {
    valid: true,
    reasons: ["seed validates bounded tail"],
    nonClaims: ["seed is bounded and not full replay proof"],
  };
}

module.exports = {
  computeDemoSliceFingerprint,
  computeContinuitySliceDemoFingerprint: computeDemoSliceFingerprint,
  computeContinuitySliceHash: computeDemoSliceFingerprint,
  createContinuitySeed,
  admitContinuitySeed,
  validateTailFromSeed,
};
