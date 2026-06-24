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

  async function loadContinuity(observerId, branchType = "default-continuity") {
    return getContinuity(observerId, branchType);
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

  async function removeContinuity(observerId, branchType = "default-continuity") {
    ensureRoot();
    const file = path.join(resolvedRoot, continuityKey(observerId, branchType));
    if (fs.existsSync(file)) {
      fs.unlinkSync(file);
    }
  }

  async function listContinuities({ branchType } = {}) {
    ensureRoot();
    const continuities = [];
    for (const name of fs.readdirSync(resolvedRoot)) {
      if (!name.endsWith(".json")) continue;
      const full = path.join(resolvedRoot, name);
      if (!fs.lstatSync(full).isFile()) continue;
      const parsed = JSON.parse(fs.readFileSync(full, "utf8"));
      const continuity = normalizeContinuity(parsed, parsed?.ownerObserverId || "unknown", parsed?.branchType);
      assertContinuity(continuity);
      if (branchType && continuity.branchType !== branchType) continue;
      continuities.push(continuity);
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
  createFileStore,
};
