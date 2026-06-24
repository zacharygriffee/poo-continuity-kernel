function createMemoryStore() {
  const state = new Map();

  function key(observerId, branchType = "default-continuity") {
    return `${String(observerId)}::${String(branchType)}`;
  }

  function getContinuity(observerId, branchType = "default-continuity") {
    if (typeof observerId !== "string" || !observerId.trim()) {
      throw new Error("observerId is required");
    }
    return state.get(key(observerId, branchType)) || null;
  }

  function saveContinuity(continuity) {
    if (!continuity || !continuity.ownerObserverId) {
      throw new Error("continuity is required");
    }
    state.set(key(continuity.ownerObserverId, continuity.branchType || "default-continuity"), {
      ...continuity,
      events: [...continuity.events],
    });
    return continuity;
  }

  function clear() {
    state.clear();
  }

  return {
    getContinuity,
    saveContinuity,
    clear,
  };
}

module.exports = {
  createMemoryStore,
};
