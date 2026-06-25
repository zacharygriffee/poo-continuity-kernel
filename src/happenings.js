const { nextHappeningId } = require("./ids");

function createHappening(input = {}) {
  if (!input || typeof input !== "object") {
    throw new Error("happening input must be an object");
  }

  const actorObserverId = String(input.actorObserverId || input.observerId || "").trim();
  if (!actorObserverId) {
    throw new Error("actorObserverId is required");
  }

  const kind = String(input.kind || "unclassified").trim();
  if (!kind) {
    throw new Error("happening kind is required");
  }

  const normalizedInput = {
    ...input,
  };
  const happeningId = input.id || input.happeningId || nextHappeningId();

  return {
    ...normalizedInput,
    id: happeningId,
    happeningId,
    kind,
    actorObserverId,
    parentHappeningId: input.parentHappeningId || null,
    throughSeatReferentId: input.throughSeatReferentId || null,
    sourceSeatReferentId: input.sourceSeatReferentId || null,
    throughReferentId: input.throughReferentId || input.throughSeatReferentId || null,
    payload: input.payload && typeof input.payload === "object" ? input.payload : {},
    timestamp: input.timestamp || new Date().toISOString(),
  };
}

function validateHappeningShape(happening) {
  return createHappening(happening);
}

function ensureHappeningIdentity(continuity, happening) {
  const normalized = validateHappeningShape(happening);
  if (!normalized.id) {
    return {
      ...normalized,
      id: nextHappeningId(continuity),
    };
  }
  return normalized;
}

module.exports = {
  createHappening,
  validateHappeningShape,
  ensureHappeningIdentity,
};
