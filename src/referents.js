function createObserver(input = {}) {
  const id = String(input.id || input.observerId || "").trim();
  if (!id) {
    throw new Error("observer id is required");
  }

  return {
    id,
    kind: "observer",
    title: input.title || `Observer ${id}`,
    canAdmit: input.canAdmit !== false,
    branchType: input.branchType || "default-continuity",
  };
}

function isObserver(value) {
  return !!value && typeof value === "object" && value.kind === "observer" && typeof value.id === "string";
}

function assertObserver(value) {
  if (!isObserver(value)) {
    throw new Error("not a valid observer");
  }
}

function createReferent(input = {}) {
  const id = String(input.id || "").trim();
  if (!id) {
    throw new Error("referent id is required");
  }

  const type = String(input.type || "artifact").trim() || "artifact";
  const ownerObserverId = String(input.ownerObserverId || input.sourceObserverId || "unknown").trim() || "unknown";

  return {
    id,
    kind: input.kind || "referent",
    type,
    ownerObserverId,
    sourceObserverId: input.sourceObserverId || ownerObserverId,
    payload: input.payload && typeof input.payload === "object" ? input.payload : {},
    slot: input.slot,
    row: input.row,
    sprite: input.sprite,
    title: input.title || `${type} ${id}`,
    createdByObserverId: input.createdByObserverId || ownerObserverId,
    originHappeningId: input.originHappeningId || null,
  };
}

function isReferent(value) {
  return !!value && typeof value === "object" && typeof value.id === "string" && !!value.kind;
}

function normalizeReferent(value) {
  return isReferent(value) ? value : createReferent(value || {});
}

module.exports = {
  createObserver,
  isObserver,
  assertObserver,
  createReferent,
  isReferent,
  normalizeReferent,
};
