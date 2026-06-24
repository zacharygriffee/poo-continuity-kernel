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
  const owner = String(continuity?.ownerObserverId || "observer");
  const expectedPrefix = `ref-${owner}-`;
  let max = 0;

  for (const event of continuity?.events || []) {
    if (event?.kind !== "referent-created") continue;
    const raw = String(event?.referentId || "");
    if (!raw.startsWith(expectedPrefix)) continue;
    const tail = raw.slice(expectedPrefix.length);
    const n = Number(tail);
    if (Number.isInteger(n) && n > max) max = n;
  }

  return `${expectedPrefix}${max + 1}`;
}

function nextHappeningId(continuity) {
  const owner = String(continuity?.ownerObserverId || "observer");
  return `h-${owner}-${nextEventNumberFromContinuity(continuity, "h")}`;
}

module.exports = {
  nextEventNumberFromContinuity,
  nextReferentId,
  nextHappeningId,
};
