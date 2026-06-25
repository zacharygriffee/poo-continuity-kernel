const crypto = require("crypto");

const DEFAULT_RANDOM_BYTES = 32;
const DEFAULT_DIGEST_LENGTH = 32;

function randomDigest({ bytes = DEFAULT_RANDOM_BYTES, algorithm = "sha256", length = DEFAULT_DIGEST_LENGTH } = {}) {
  return crypto
    .createHash(algorithm)
    .update(crypto.randomBytes(bytes))
    .digest("hex")
    .slice(0, length);
}

function createRandomId(prefix, options = {}) {
  const normalizedPrefix = String(prefix || "id").trim() || "id";
  return `${normalizedPrefix}-${randomDigest(options)}`;
}

function createObserverId(options = {}) {
  return createRandomId("obs", options);
}

function nextEventNumberFromContinuity(continuity, prefix) {
  if (!continuity || !Array.isArray(continuity.events)) return 1;
  const owner = String(continuity.ownerObserverId || "");
  const expectedPrefix = `${prefix}-${owner}-`;
  let max = 0;

  for (const event of continuity.events) {
    const raw = String(event?.id || "");
    if (!raw.startsWith(expectedPrefix)) continue;
    const tail = raw.slice(expectedPrefix.length);
    const n = Number(tail);
    if (Number.isInteger(n) && n > max) max = n;
  }

  return max + 1;
}

function nextReferentId(continuity) {
  return createRandomId("ref");
}

function nextHappeningId(continuity) {
  return createRandomId("h");
}

module.exports = {
  createRandomId,
  createObserverId,
  randomDigest,
  nextEventNumberFromContinuity,
  nextReferentId,
  nextHappeningId,
};
