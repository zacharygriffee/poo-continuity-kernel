const fs = require("fs");
const path = require("path");
const { assertContinuity } = require("../src/continuity");

function createFileStore({ rootDir = ".poo-continuity-store" } = {}) {
  const resolvedRoot = path.resolve(rootDir);

  function ensureRoot() {
    if (!fs.existsSync(resolvedRoot)) {
      fs.mkdirSync(resolvedRoot, { recursive: true });
    }
  }

  function normalizeContinuity(raw, observerId, branchType) {
    const continuity = {
      ownerObserverId: String(raw?.ownerObserverId || observerId),
      branchType: String(raw?.branchType || branchType || "default-continuity"),
      events: Array.isArray(raw?.events) ? raw.events.filter((event) => event && typeof event === "object") : [],
    };
    return continuity;
  }

  function continuityKey(observerId, branchType = "default-continuity") {
    return `${String(observerId)}::${String(branchType)}.json`;
  }

  function getContinuity(observerId, branchType = "default-continuity") {
    if (typeof observerId !== "string" || !observerId.trim()) {
      throw new Error("observerId is required");
    }
    ensureRoot();

    const file = path.join(resolvedRoot, continuityKey(observerId, branchType));
    if (!fs.existsSync(file)) {
      return null;
    }

    const raw = fs.readFileSync(file, "utf8");
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") {
      return null;
    }
    const continuity = normalizeContinuity(parsed, observerId, branchType);
    assertContinuity(continuity);
    return continuity;
  }

  function saveContinuity(continuity) {
    assertContinuity(continuity);
    ensureRoot();

    const file = path.join(
      resolvedRoot,
      continuityKey(continuity.ownerObserverId, continuity.branchType || "default-continuity")
    );
    const normalized = {
      ownerObserverId: String(continuity.ownerObserverId),
      branchType: String(continuity.branchType || "default-continuity"),
      events: Array.isArray(continuity.events) ? continuity.events : [],
    };
    assertContinuity(normalized);

    fs.writeFileSync(
      file,
      JSON.stringify(normalized, null, 2),
      "utf8"
    );
    return continuity;
  }

  function clear() {
    if (!fs.existsSync(resolvedRoot)) {
      return;
    }
    for (const name of fs.readdirSync(resolvedRoot)) {
      if (String(name).startsWith(".")) continue;
      const full = path.join(resolvedRoot, name);
      if (fs.lstatSync(full).isFile()) {
        fs.unlinkSync(full);
      }
    }
  }

  return {
    getContinuity,
    saveContinuity,
    clear,
  };
}

module.exports = {
  createFileStore,
};
