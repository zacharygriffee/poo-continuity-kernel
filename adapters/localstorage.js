function createLocalStorageStore({ prefix = "poo-continuity-kernel" } = {}) {
  if (typeof window === "undefined" || !window.localStorage) {
    throw new Error("localStorage adapter requires browser context");
  }

  const storage = window.localStorage;
  const key = (observerId, branchType = "default-continuity") =>
    `${String(prefix)}::${String(observerId)}::${String(branchType)}`;

  function normalizeContinuity(raw, observerId, branchType) {
    const normalized = {
      ownerObserverId: String(raw?.ownerObserverId || observerId),
      branchType: String(raw?.branchType || branchType || "default-continuity"),
      events: Array.isArray(raw?.events) ? raw.events.filter((event) => event && typeof event === "object") : [],
    };

    for (const event of normalized.events) {
      if (!event || typeof event !== "object" || !event.id) {
        event.id = null;
      }
    }

    return normalized;
  }

  function getContinuity(observerId, branchType = "default-continuity") {
    if (!observerId || !String(observerId).trim()) {
      throw new Error("observerId is required");
    }

    const payload = storage.getItem(key(observerId, branchType));
    if (!payload) return null;

    const parsed = JSON.parse(payload);
    const continuity = normalizeContinuity(parsed, observerId, branchType);
    return continuity;
  }

  function saveContinuity(continuity) {
    if (!continuity || !continuity.ownerObserverId) {
      throw new Error("continuity is required");
    }

    const id = continuity.ownerObserverId;
    const branchType = continuity.branchType || "default-continuity";
    storage.setItem(key(id, branchType), JSON.stringify(continuity));
    return continuity;
  }

  function clear() {
    const prefixFilter = `${String(prefix)}::`;
    const keys = [];

    for (let i = 0; i < storage.length; i += 1) {
      const candidate = storage.key(i);
      if (candidate && candidate.startsWith(prefixFilter)) {
        keys.push(candidate);
      }
    }

    for (const k of keys) {
      storage.removeItem(k);
    }
  }

  return {
    getContinuity,
    saveContinuity,
    clear,
  };
}

module.exports = {
  createLocalStorageStore,
};
