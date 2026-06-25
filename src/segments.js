const { validateFromCheckpoint } = require("./checkpoints");
const { validateTailFromSeed } = require("./seeds");

const BOUNDED_NON_CLAIM = "bounded compatibility is not full history proof";

function normalizeNonClaims(nonClaims) {
  return Array.from(
    new Set(
      (Array.isArray(nonClaims) ? nonClaims : [])
        .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
        .filter(Boolean)
    )
  );
}

function createSegmentCompatibilityPolicy(input = {}) {
  const mode = String(input.mode || "full").trim() || "full";
  if (!["full", "checkpoint", "seed", "happenings"].includes(mode)) {
    throw new Error("segment compatibility mode is invalid");
  }

  const maxHappenings = input.maxHappenings === null || input.maxHappenings === undefined
    ? null
    : Number(input.maxHappenings);
  const maxSegments = input.maxSegments === null || input.maxSegments === undefined
    ? null
    : Number(input.maxSegments);

  if (maxHappenings !== null && (!Number.isInteger(maxHappenings) || maxHappenings < 0)) {
    throw new Error("maxHappenings must be a non-negative integer or null");
  }
  if (maxSegments !== null && (!Number.isInteger(maxSegments) || maxSegments < 0)) {
    throw new Error("maxSegments must be a non-negative integer or null");
  }

  const acceptedAnchors = Array.isArray(input.acceptedAnchors)
    ? input.acceptedAnchors.map((entry) => String(entry).trim()).filter(Boolean)
    : ["checkpoint", "seed"];

  return {
    kind: "segment-compatibility-policy",
    mode,
    maxHappenings,
    maxSegments,
    requiresHotSegmentReplay: Boolean(input.requiresHotSegmentReplay),
    acceptedAnchors,
    nonClaims: normalizeNonClaims(input.nonClaims),
  };
}

function validResult(reasons, nonClaims = []) {
  return {
    valid: true,
    reasons,
    nonClaims: normalizeNonClaims(nonClaims),
  };
}

function invalidResult(reasons, nonClaims = []) {
  return {
    valid: false,
    reasons,
    nonClaims: normalizeNonClaims(nonClaims),
  };
}

function assertSource(sourceContinuity) {
  return !!(sourceContinuity && Array.isArray(sourceContinuity.events));
}

function validateSegmentCompatibility({
  sourceContinuity,
  policy,
  checkpoint,
  seed,
  stateReducer,
  expectedState,
  expectedTailState,
  initialState,
} = {}) {
  const normalizedPolicy = policy && policy.kind === "segment-compatibility-policy"
    ? policy
    : createSegmentCompatibilityPolicy(policy || {});

  if (!assertSource(sourceContinuity)) {
    return invalidResult(["source continuity is required"], normalizedPolicy.nonClaims);
  }

  if (normalizedPolicy.mode === "full") {
    return validResult(
      ["full source continuity is available for replay"],
      normalizedPolicy.nonClaims
    );
  }

  const boundedNonClaims = [...normalizedPolicy.nonClaims, BOUNDED_NON_CLAIM];

  if (normalizedPolicy.mode === "checkpoint") {
    if (!normalizedPolicy.acceptedAnchors.includes("checkpoint")) {
      return invalidResult(["checkpoint anchor is not accepted by policy"], boundedNonClaims);
    }
    if (!checkpoint) {
      return invalidResult(["checkpoint is required by segment policy"], boundedNonClaims);
    }
    const validation = validateFromCheckpoint(sourceContinuity, checkpoint, {
      stateReducer,
      expectedState,
      initialState,
    });
    return validation.valid
      ? validResult(["checkpoint satisfies segment compatibility", ...(validation.reasons || [])], [
          ...boundedNonClaims,
          ...(validation.nonClaims || []),
        ])
      : invalidResult(validation.reasons || ["checkpoint validation failed"], boundedNonClaims);
  }

  if (normalizedPolicy.mode === "seed") {
    if (!normalizedPolicy.acceptedAnchors.includes("seed")) {
      return invalidResult(["seed anchor is not accepted by policy"], boundedNonClaims);
    }
    if (!seed) {
      return invalidResult(["seed is required by segment policy"], boundedNonClaims);
    }
    const validation = validateTailFromSeed(null, sourceContinuity, seed, {
      stateReducer,
      expectedTailState,
      initialState,
    });
    return validation.valid
      ? validResult(["seed satisfies segment compatibility", ...(validation.reasons || [])], [
          ...boundedNonClaims,
          ...(validation.nonClaims || []),
        ])
      : invalidResult(validation.reasons || ["seed validation failed"], boundedNonClaims);
  }

  if (normalizedPolicy.mode === "happenings") {
    const required = normalizedPolicy.maxHappenings;
    if (!Number.isInteger(required)) {
      return invalidResult(["maxHappenings is required for happenings compatibility"], boundedNonClaims);
    }
    if (sourceContinuity.events.length < required) {
      return invalidResult(["source continuity is shorter than required maxHappenings"], boundedNonClaims);
    }
    return validResult(["recent happenings satisfy bounded compatibility"], boundedNonClaims);
  }

  return invalidResult(["unsupported segment compatibility mode"], normalizedPolicy.nonClaims);
}

module.exports = {
  BOUNDED_NON_CLAIM,
  createSegmentCompatibilityPolicy,
  validateSegmentCompatibility,
};
