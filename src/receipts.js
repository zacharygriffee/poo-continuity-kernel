const NON_CLAIMS = Object.freeze([
  "storage is not reality",
  "availability is not visibility",
  "visibility is not admission",
  "admission is not global truth",
  "projection is not write authority",
  "receipt is not canonical",
]);

const RECEIPT_KIND = "admission-receipt";

function normalizeReceiptKind(kind) {
  return typeof kind === "string" && kind.trim() ? String(kind).trim() : RECEIPT_KIND;
}

function normalizeReasons(reasons) {
  if (!Array.isArray(reasons)) {
    return [];
  }
  return reasons
    .map((reason) => (typeof reason === "string" ? String(reason).trim() : ""))
    .filter(Boolean);
}

function normalizeNonClaims(nonClaims = []) {
  if (!Array.isArray(nonClaims)) {
    return [];
  }
  return nonClaims
    .map((entry) => (typeof entry === "string" ? String(entry).trim() : ""))
    .filter(Boolean);
}

function normalizeActor(observerId, actorObserverId) {
  if (typeof actorObserverId === "string" && actorObserverId.trim()) {
    return actorObserverId.trim();
  }
  return observerId;
}

function baseReceipt({
  kind,
  observerId,
  actorObserverId,
  decision,
  reasons,
  nonClaims,
  ...extra
}) {
  if (typeof observerId !== "string" || !observerId.trim()) {
    throw new Error("observerId is required");
  }

  const normalized = {
    kind: normalizeReceiptKind(kind),
    observerId: observerId.trim(),
    actorObserverId: normalizeActor(observerId, actorObserverId),
    decision: String(decision || "admitted").trim(),
    reasons: normalizeReasons(reasons),
    happeningId: extra.happeningId || null,
    parentHappeningId: extra.parentHappeningId || null,
    seatReferentId: extra.seatReferentId || null,
    ...extra,
  };

  normalized.nonClaims = Array.from(
    new Set([
      ...NON_CLAIMS,
      ...normalizeNonClaims(normalized.nonClaims),
      ...normalizeNonClaims(nonClaims),
    ])
  );

  return normalized;
}

function withNonClaims(receipt, nonClaims = []) {
  return {
    ...receipt,
    nonClaims: Array.from(
      new Set([...(Array.isArray(receipt?.nonClaims) ? receipt.nonClaims : []), ...normalizeNonClaims(nonClaims)])
    ),
  };
}

function admittedReceipt({ observerId, actorObserverId, reasons = [], ...extra }) {
  return baseReceipt({
    kind: RECEIPT_KIND,
    observerId,
    actorObserverId,
    decision: "admitted",
    reasons,
    ...extra,
  });
}

function rejectedReceipt({ observerId, actorObserverId, reasons = [], ...extra }) {
  return baseReceipt({
    kind: RECEIPT_KIND,
    observerId,
    actorObserverId,
    decision: "rejected",
    reasons: reasons.length > 0 ? reasons : ["rejected by kernel rulebook"],
    ...extra,
  });
}

function deferredReceipt({ observerId, actorObserverId, reasons = [], ...extra }) {
  return baseReceipt({
    kind: RECEIPT_KIND,
    observerId,
    actorObserverId,
    decision: "deferred",
    reasons: reasons.length > 0 ? reasons : ["deferred by kernel rulebook"],
    ...extra,
  });
}

module.exports = {
  NON_CLAIMS,
  admittedReceipt,
  rejectedReceipt,
  deferredReceipt,
  withNonClaims,
  baseReceipt,
};
