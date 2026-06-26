const { createHappening } = require("./happenings");
const { appendAdmittedHappening } = require("./continuity");
const { admittedReceipt, rejectedReceipt, deferredReceipt } = require("./receipts");
const { validateRbcCompatibility } = require("./rbc-compatibility");
const topology = require("./topology");
const { EVENT_KIND_BLEND_CANDIDATE_ADMITTED } = require("./event-kinds");
const { createRandomId } = require("./ids");

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

function normalizeDescriptors(rbcDescriptors) {
  if (Array.isArray(rbcDescriptors)) return rbcDescriptors.filter(Boolean);
  if (rbcDescriptors && typeof rbcDescriptors === "object") return Object.values(rbcDescriptors).filter(Boolean);
  return [];
}

function createBlendCandidate(input = {}) {
  return {
    kind: "blend-candidate-referent",
    blendId: String(input.blendId || "").trim() || createRandomId("blend"),
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

function validateBlendCandidate({ blendCandidate, continuities, rbcDescriptors, segmentPolicies, rulebook } = {}) {
  if (!blendCandidate || blendCandidate.kind !== "blend-candidate-referent") {
    return topology.rejectedTopologyResult({ relationKind: "blend-candidate", reasons: ["blend candidate kind is invalid"] });
  }
  if (!Array.isArray(blendCandidate.inputContinuities) || blendCandidate.inputContinuities.length < 2) {
    return topology.rejectedTopologyResult({ relationId: blendCandidate.blendId, relationKind: "blend-candidate", reasons: ["blend candidate requires at least two input continuities"], nonClaims: blendCandidate.nonClaims });
  }

  const rbc = validateRbcCompatibility({
    descriptors: normalizeDescriptors(rbcDescriptors),
    policy: blendCandidate.rbcCompatibility || {},
    requiredRuleKinds: blendCandidate.rbcCompatibility?.requiredRuleKinds || [],
    operationKind: "blend-candidate",
  });
  if (rbc.decision === "incompatible") {
    return topology.rejectedTopologyResult({ relationId: blendCandidate.blendId, relationKind: "blend-candidate", reasons: rbc.reasons, rbcCompatibility: rbc, nonClaims: [...blendCandidate.nonClaims, ...rbc.nonClaims] });
  }

  const continuityList = normalizeContinuities(continuities);
  const segment = topology.validateSegmentPoliciesForContinuities({ segmentPolicies, continuities: continuityList });
  if (!segment.valid) {
    return topology.rejectedTopologyResult({ relationId: blendCandidate.blendId, relationKind: "blend-candidate", reasons: segment.reasons, rbcCompatibility: rbc, segmentCompatibility: segment, nonClaims: [...blendCandidate.nonClaims, ...rbc.nonClaims, ...segment.nonClaims] });
  }

  if (blendCandidate.conflicts.length > 0) {
    return topology.deferredTopologyResult({ relationId: blendCandidate.blendId, relationKind: "blend-candidate", reasons: ["blend candidate has unresolved conflicts"], conflicts: blendCandidate.conflicts, rbcCompatibility: rbc, segmentCompatibility: segment, nonClaims: [...blendCandidate.nonClaims, ...rbc.nonClaims, ...segment.nonClaims] });
  }

  if (typeof rulebook === "function") {
    const decision = rulebook({ operationKind: "blend-candidate", blendCandidate, continuities });
    if (decision && decision.decision !== "admitted") {
      const report = decision.conflictReport || decision.report
        ? topology.createContinuityConflictReport(decision.conflictReport || decision.report)
        : null;
      const result = decision.decision === "deferred" ? topology.deferredTopologyResult : topology.rejectedTopologyResult;
      return result({ relationId: blendCandidate.blendId, relationKind: "blend-candidate", reasons: decision.reasons || ["blend candidate rejected by rulebook"], conflictReport: report, rbcCompatibility: rbc, segmentCompatibility: segment, nonClaims: [...blendCandidate.nonClaims, ...rbc.nonClaims, ...segment.nonClaims] });
    }
  }

  return topology.admittedTopologyResult({ relationId: blendCandidate.blendId, relationKind: "blend-candidate", reasons: ["blend candidate is compatible for admission flow"], rbcCompatibility: rbc, segmentCompatibility: segment, nonClaims: [...blendCandidate.nonClaims, ...rbc.nonClaims, ...segment.nonClaims] });
}

function admitBlendCandidate(localContinuity, blendCandidate, payload = {}) {
  if (!localContinuity || !localContinuity.ownerObserverId) {
    return { continuity: localContinuity, receipt: rejectedReceipt({ observerId: "unknown", reasons: ["local continuity is required"] }) };
  }
  if (!blendCandidate || blendCandidate.kind !== "blend-candidate-referent") {
    return { continuity: localContinuity, receipt: rejectedReceipt({ observerId: localContinuity.ownerObserverId, reasons: ["blend candidate kind is invalid"] }) };
  }
  const actorObserverId = payload.actorObserverId || localContinuity.ownerObserverId;
  const event = createHappening({
    actorObserverId,
    parentHappeningId: payload.parentHappeningId || null,
    kind: EVENT_KIND_BLEND_CANDIDATE_ADMITTED,
    payload: { blendCandidate, ...payload },
  });
  event.blendId = blendCandidate.blendId;
  event.relationId = blendCandidate.blendId;
  event.relationKind = "blend-candidate";
  event.blendCandidate = blendCandidate;
  return {
    continuity: appendAdmittedHappening(localContinuity, event),
    receipt: admittedReceipt({
      observerId: localContinuity.ownerObserverId,
      actorObserverId,
      happeningId: event.id,
      parentHappeningId: event.parentHappeningId,
      relationId: blendCandidate.blendId,
      relationKind: "blend-candidate",
      blendId: blendCandidate.blendId,
      reasons: ["blend candidate admitted locally"],
      nonClaims: [...topology.TOPOLOGY_NON_CLAIMS, ...blendCandidate.nonClaims],
    }),
  };
}

function receiptForBlendValidation(localContinuity, validation) {
  const observerId = localContinuity?.ownerObserverId || "unknown";
  const base = {
    observerId,
    actorObserverId: observerId,
    relationId: validation?.relationId || null,
    relationKind: validation?.relationKind || "blend-candidate",
    blendId: validation?.relationId || null,
    reasons: validation?.reasons || ["blend validation failed"],
    nonClaims: validation?.nonClaims || topology.TOPOLOGY_NON_CLAIMS,
    conflicts: validation?.conflicts || [],
    conflictReport: validation?.conflictReport || null,
    rbcCompatibility: validation?.rbcCompatibility || null,
    segmentCompatibility: validation?.segmentCompatibility || null,
  };
  return validation?.decision === "deferred" ? deferredReceipt(base) : rejectedReceipt(base);
}

function validateAndAdmitBlendCandidate({
  localContinuity,
  blendCandidate,
  continuities,
  rbcDescriptors,
  segmentPolicies,
  rulebook,
  payload = {},
} = {}) {
  const validation = validateBlendCandidate({ blendCandidate, continuities, rbcDescriptors, segmentPolicies, rulebook });
  if (validation.decision !== "admitted") {
    return {
      continuity: localContinuity,
      validation,
      receipt: receiptForBlendValidation(localContinuity, validation),
    };
  }
  return {
    ...admitBlendCandidate(localContinuity, blendCandidate, payload),
    validation,
  };
}

module.exports = {
  createBlendCandidate,
  validateBlendCandidate,
  admitBlendCandidate,
  validateAndAdmitBlendCandidate,
};
