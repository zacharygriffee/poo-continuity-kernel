const { createHappening } = require("./happenings");
const { appendAdmittedHappening } = require("./continuity");
const { admittedReceipt, rejectedReceipt } = require("./receipts");
const { validateRbcCompatibility } = require("./rbc-compatibility");
const { validateSegmentCompatibility } = require("./segments");
const { createContinuityConflictReport } = require("./topology");
const { EVENT_KIND_BLEND_CANDIDATE_ADMITTED } = require("./event-kinds");

function normalizeNonClaims(nonClaims) {
  return Array.from(new Set((Array.isArray(nonClaims) ? nonClaims : [])
    .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
    .filter(Boolean)));
}

function normalizeContinuities(continuities) {
  if (Array.isArray(continuities)) return continuities.filter(Boolean);
  if (continuities && typeof continuities === "object") return Object.values(continuities).filter(Boolean);
  return [];
}

function createBlendCandidate(input = {}) {
  return {
    kind: "blend-candidate-referent",
    blendId: String(input.blendId || "").trim() || `blend-${Date.now()}`,
    inputContinuities: (Array.isArray(input.inputContinuities) ? input.inputContinuities : []).map((entry) => ({
      continuityId: String(entry.continuityId || "").trim(),
      ownerObserverId: String(entry.ownerObserverId || entry.observerId || "").trim(),
      fromIndex: Number.isInteger(entry.fromIndex) ? entry.fromIndex : 0,
      toIndex: Number.isInteger(entry.toIndex) ? entry.toIndex : null,
    })),
    validationScope: input.validationScope || { mode: "bounded-slices" },
    rbcCompatibility: input.rbcCompatibility || null,
    conflicts: Array.isArray(input.conflicts) ? input.conflicts.slice() : [],
    proposedEvents: Array.isArray(input.proposedEvents) ? input.proposedEvents.slice() : [],
    nonClaims: normalizeNonClaims([
      "blend candidate is not global truth",
      "blend does not prove causal history",
      "blend requires domain RBC admission",
      ...(input.nonClaims || []),
    ]),
  };
}

function normalizeDescriptors(rbcDescriptors) {
  if (Array.isArray(rbcDescriptors)) return rbcDescriptors.filter(Boolean);
  if (rbcDescriptors && typeof rbcDescriptors === "object") return Object.values(rbcDescriptors).filter(Boolean);
  return [];
}

function validateSegments(segmentPolicies, continuities) {
  const entries = Array.isArray(segmentPolicies) ? segmentPolicies : Object.values(segmentPolicies || {});
  const reasons = [];
  const nonClaims = [];
  for (const entry of entries) {
    const continuity = entry?.sourceContinuity || entry?.continuity || continuities.find((item) =>
      !entry?.continuityId || item.continuityId === entry.continuityId || item.ownerObserverId === entry.continuityId
    );
    const validation = validateSegmentCompatibility({
      sourceContinuity: continuity,
      policy: entry?.policy || entry,
      checkpoint: entry?.checkpoint,
      seed: entry?.seed,
    });
    reasons.push(...(validation.reasons || []));
    nonClaims.push(...(validation.nonClaims || []));
    if (!validation.valid) return { valid: false, reasons, nonClaims: normalizeNonClaims(nonClaims) };
  }
  return { valid: true, reasons, nonClaims: normalizeNonClaims(nonClaims) };
}

function validateBlendCandidate({ blendCandidate, continuities, rbcDescriptors, segmentPolicies, rulebook } = {}) {
  if (!blendCandidate || blendCandidate.kind !== "blend-candidate-referent") {
    return { valid: false, decision: "rejected", reasons: ["blend candidate kind is invalid"], nonClaims: [] };
  }
  if (!Array.isArray(blendCandidate.inputContinuities) || blendCandidate.inputContinuities.length < 2) {
    return { valid: false, decision: "rejected", reasons: ["blend candidate requires at least two input continuities"], nonClaims: blendCandidate.nonClaims };
  }

  const rbc = validateRbcCompatibility({
    descriptors: normalizeDescriptors(rbcDescriptors),
    policy: blendCandidate.rbcCompatibility || {},
    requiredRuleKinds: blendCandidate.rbcCompatibility?.requiredRuleKinds || [],
    operationKind: "blend-candidate",
  });
  if (rbc.decision === "incompatible") {
    return { valid: false, decision: "rejected", reasons: rbc.reasons, rbcCompatibility: rbc, nonClaims: normalizeNonClaims([...blendCandidate.nonClaims, ...rbc.nonClaims]) };
  }

  const continuityList = normalizeContinuities(continuities);
  const segment = validateSegments(segmentPolicies, continuityList);
  if (!segment.valid) {
    return { valid: false, decision: "rejected", reasons: segment.reasons, rbcCompatibility: rbc, nonClaims: normalizeNonClaims([...blendCandidate.nonClaims, ...rbc.nonClaims, ...segment.nonClaims]) };
  }

  if (blendCandidate.conflicts.length > 0) {
    return { valid: false, decision: "deferred", reasons: ["blend candidate has unresolved conflicts"], conflicts: blendCandidate.conflicts, rbcCompatibility: rbc, nonClaims: normalizeNonClaims([...blendCandidate.nonClaims, ...rbc.nonClaims, ...segment.nonClaims]) };
  }

  if (typeof rulebook === "function") {
    const decision = rulebook({ operationKind: "blend-candidate", blendCandidate, continuities });
    if (decision && decision.decision !== "admitted") {
      const report = decision.conflictReport || decision.report
        ? createContinuityConflictReport(decision.conflictReport || decision.report)
        : null;
      return { valid: false, decision: decision.decision || "rejected", reasons: decision.reasons || ["blend candidate rejected by rulebook"], conflictReport: report, rbcCompatibility: rbc, nonClaims: normalizeNonClaims([...blendCandidate.nonClaims, ...rbc.nonClaims, ...segment.nonClaims]) };
    }
  }

  return { valid: true, decision: "admitted", reasons: ["blend candidate is compatible for admission flow"], rbcCompatibility: rbc, nonClaims: normalizeNonClaims([...blendCandidate.nonClaims, ...rbc.nonClaims, ...segment.nonClaims]) };
}

function admitBlendCandidate(localContinuity, blendCandidate, payload = {}) {
  if (!localContinuity || !localContinuity.ownerObserverId) {
    return { continuity: localContinuity, receipt: rejectedReceipt({ observerId: "unknown", reasons: ["local continuity is required"] }) };
  }
  if (!blendCandidate || blendCandidate.kind !== "blend-candidate-referent") {
    return { continuity: localContinuity, receipt: rejectedReceipt({ observerId: localContinuity.ownerObserverId, reasons: ["blend candidate kind is invalid"] }) };
  }
  const event = createHappening({
    actorObserverId: payload.actorObserverId || localContinuity.ownerObserverId,
    kind: EVENT_KIND_BLEND_CANDIDATE_ADMITTED,
    payload: { blendCandidate, ...payload },
  });
  event.blendId = blendCandidate.blendId;
  event.blendCandidate = blendCandidate;
  return {
    continuity: appendAdmittedHappening(localContinuity, event),
    receipt: admittedReceipt({
      observerId: localContinuity.ownerObserverId,
      actorObserverId: payload.actorObserverId || localContinuity.ownerObserverId,
      happeningId: event.id,
      reasons: ["blend candidate admitted locally"],
      nonClaims: blendCandidate.nonClaims,
    }),
  };
}

module.exports = {
  createBlendCandidate,
  validateBlendCandidate,
  admitBlendCandidate,
};
