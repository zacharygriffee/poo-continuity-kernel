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

  async function loadContinuity(observerId, branchType = "default-continuity") {
    return getContinuity(observerId, branchType);
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

  async function removeContinuity(observerId, branchType = "default-continuity") {
    state.delete(key(observerId, branchType));
  }

  async function listContinuities({ branchType } = {}) {
    const continuities = [];
    for (const continuity of state.values()) {
      if (branchType && continuity.branchType !== branchType) continue;
      continuities.push({
        ...continuity,
        events: [...continuity.events],
      });
    }
    return continuities;
  }

  async function* streamContinuity(observerId, branchType = "default-continuity") {
    const continuity = getContinuity(observerId, branchType);
    for (const event of continuity?.events || []) {
      yield event;
    }
  }

  async function appendHappening(observerId, branchType = "default-continuity", happening) {
    const { createContinuity, appendAdmittedHappening } = require("../src/continuity");
    const current = getContinuity(observerId, branchType) || createContinuity(observerId, branchType);
    const next = appendAdmittedHappening(current, happening);
    saveContinuity(next);
    return next;
  }

  function clear() {
    state.clear();
  }

  return {
    getContinuity,
    loadContinuity,
    saveContinuity,
    removeContinuity,
    listContinuities,
    streamContinuity,
    appendHappening,
    clear,
  };
}

module.exports = {
  createMemoryStore,
};
