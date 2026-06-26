const { createHappening } = require("./happenings");
const { appendAdmittedHappening } = require("./continuity");
const { admittedReceipt, rejectedReceipt, deferredReceipt } = require("./receipts");
const { validateRbcCompatibility } = require("./rbc-compatibility");
const { validateSegmentCompatibility } = require("./segments");
const { createRandomId } = require("./ids");
const {
  EVENT_KIND_CONTINUITY_BRIDGE_ADMITTED,
  EVENT_KIND_CONTINUITY_MOUNT_ADMITTED,
} = require("./event-kinds");

const TOPOLOGY_NON_CLAIMS = Object.freeze([
  "topology relation is observer-relative",
  "topology validation is not global truth",
  "topology admission is local continuity growth only",
]);

function uniqueId(prefix, input) {
  return String(input || "").trim() || createRandomId(prefix);
}

function normalizeNonClaims(nonClaims) {
  return Array.from(new Set((Array.isArray(nonClaims) ? nonClaims : [])
    .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
    .filter(Boolean)));
}

function normalizeReasons(reasons, fallback) {
  const normalized = (Array.isArray(reasons) ? reasons : [])
    .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
    .filter(Boolean);
  return normalized.length > 0 ? normalized : [fallback];
}

function normalizeConflicts(conflicts, conflictReport) {
  const entries = [];
  if (Array.isArray(conflicts)) entries.push(...conflicts.filter(Boolean));
  if (conflictReport) entries.push(conflictReport);
  return entries;
}

function topologyResult(decision, input = {}) {
  const normalizedDecision = String(decision || input.decision || "rejected").trim() || "rejected";
  return {
    valid: normalizedDecision === "admitted",
    decision: normalizedDecision,
    relationId: input.relationId || null,
    relationKind: input.relationKind || null,
    reasons: normalizeReasons(input.reasons, `${normalizedDecision} by topology validation`),
    nonClaims: normalizeNonClaims([
      ...TOPOLOGY_NON_CLAIMS,
      ...(input.nonClaims || []),
    ]),
    conflicts: normalizeConflicts(input.conflicts, input.conflictReport),
    conflictReport: input.conflictReport || null,
    rbcCompatibility: input.rbcCompatibility || null,
    segmentCompatibility: input.segmentCompatibility || null,
  };
}

function admittedTopologyResult(input = {}) {
  return topologyResult("admitted", input);
}

function rejectedTopologyResult(input = {}) {
  return topologyResult("rejected", input);
}

function deferredTopologyResult(input = {}) {
  return topologyResult("deferred", input);
}

function normalizeEndpoint(endpoint = {}) {
  return {
    continuityId: String(endpoint.continuityId || "").trim(),
    observerId: String(endpoint.observerId || endpoint.ownerObserverId || "").trim(),
    surfaceRef: String(endpoint.surfaceRef || "").trim(),
  };
}

function endpointValid(endpoint) {
  return !!(endpoint.continuityId && endpoint.observerId && endpoint.surfaceRef);
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

function normalizeSegmentPolicies(segmentPolicies) {
  if (!segmentPolicies) return [];
  if (Array.isArray(segmentPolicies)) return segmentPolicies;
  if (typeof segmentPolicies === "object") return Object.values(segmentPolicies);
  return [];
}

function validateSegmentPoliciesForContinuities({ segmentPolicies, continuities } = {}) {
  const policies = normalizeSegmentPolicies(segmentPolicies);
  const continuityList = normalizeContinuities(continuities);
  const reasons = [];
  const nonClaims = [];
  const results = [];

  for (const entry of policies) {
    const policy = entry?.policy || entry;
    const continuity = entry?.sourceContinuity || entry?.continuity || continuityList.find((item) =>
      !entry?.continuityId || item.continuityId === entry.continuityId || item.ownerObserverId === entry.continuityId
    );
    const validation = validateSegmentCompatibility({
      sourceContinuity: continuity,
      policy,
      checkpoint: entry?.checkpoint,
      seed: entry?.seed,
      stateReducer: entry?.stateReducer,
      expectedState: entry?.expectedState,
      expectedTailState: entry?.expectedTailState,
      initialState: entry?.initialState,
    });
    results.push(validation);
    reasons.push(...(validation.reasons || []));
    nonClaims.push(...(validation.nonClaims || []));
    if (!validation.valid) {
      return {
        valid: false,
        reasons,
        nonClaims: normalizeNonClaims(nonClaims),
        results,
      };
    }
  }

  return {
    valid: true,
    reasons,
    nonClaims: normalizeNonClaims(nonClaims),
    results,
  };
}

function normalizeRuleDecision(decision, fallbackReason) {
  if (!decision) return { decision: "admitted", reasons: [] };
  const normalized = String(decision.decision || (decision.conflict ? "rejected" : "admitted")).trim();
  return {
    decision: normalized,
    reasons: Array.isArray(decision.reasons) && decision.reasons.length > 0 ? decision.reasons : [fallbackReason],
    conflictReport: decision.conflictReport || decision.report || null,
    conflicts: Array.isArray(decision.conflicts) ? decision.conflicts : [],
  };
}

function relationIdFor(kind, referent) {
  if (kind === "bridge") return referent?.bridgeId || null;
  if (kind === "mount") return referent?.mountId || null;
  if (kind === "blend-candidate") return referent?.blendId || null;
  return referent?.relationId || null;
}

function createTopologyRelation(input = {}) {
  const relationKind = String(input.relationKind || input.type || "").trim();
  if (!["bridge", "mount", "overlap", "blend-candidate"].includes(relationKind)) {
    return {
      kind: "topology-relation-descriptor",
      relationKind,
      relationId: uniqueId("relation", input.relationId),
      referent: input.referent || null,
      relation: input.relation || null,
      nonClaims: normalizeNonClaims([...TOPOLOGY_NON_CLAIMS, ...(input.nonClaims || [])]),
    };
  }

  let referent = input.referent || null;
  if (!referent && relationKind === "bridge") referent = createContinuityBridge(input.bridge || input);
  if (!referent && relationKind === "mount") referent = createContinuityMount(input.mount || input);
  if (!referent && relationKind === "overlap") referent = input.relation || input.overlap || null;
  if (!referent && relationKind === "blend-candidate") referent = input.blendCandidate || input.blend || null;

  return {
    kind: "topology-relation-descriptor",
    relationKind,
    relationId: String(input.relationId || relationIdFor(relationKind, referent) || "").trim() || uniqueId("relation", null),
    referent,
    relation: input.relation || null,
    validationScope: input.validationScope || referent?.validationScope || null,
    nonClaims: normalizeNonClaims([
      ...TOPOLOGY_NON_CLAIMS,
      ...(referent?.nonClaims || []),
      ...(input.nonClaims || []),
    ]),
  };
}

function validateTopologyRelation(relation) {
  if (!relation || relation.kind !== "topology-relation-descriptor") {
    return rejectedTopologyResult({
      reasons: ["topology relation descriptor is required"],
    });
  }

  if (!["bridge", "mount", "overlap", "blend-candidate"].includes(relation.relationKind)) {
    return rejectedTopologyResult({
      relationId: relation.relationId || null,
      relationKind: relation.relationKind || null,
      reasons: ["topology relation kind is invalid"],
      nonClaims: relation.nonClaims,
    });
  }

  if (relation.relationKind === "bridge" && (!relation.referent || relation.referent.kind !== "continuity-bridge-referent")) {
    return rejectedTopologyResult({ relationId: relation.relationId, relationKind: relation.relationKind, reasons: ["bridge relation requires bridge referent"], nonClaims: relation.nonClaims });
  }
  if (relation.relationKind === "bridge" && (!Array.isArray(relation.referent.endpoints) || relation.referent.endpoints.length < 2 || !relation.referent.endpoints.every(endpointValid))) {
    return rejectedTopologyResult({ relationId: relation.relationId, relationKind: relation.relationKind, reasons: ["bridge relation requires valid endpoints"], nonClaims: relation.nonClaims });
  }
  if (relation.relationKind === "mount" && (!relation.referent || relation.referent.kind !== "continuity-mount-referent")) {
    return rejectedTopologyResult({ relationId: relation.relationId, relationKind: relation.relationKind, reasons: ["mount relation requires mount referent"], nonClaims: relation.nonClaims });
  }
  if (relation.relationKind === "mount" && (!endpointValid(relation.referent.parent) || !endpointValid(relation.referent.child))) {
    return rejectedTopologyResult({ relationId: relation.relationId, relationKind: relation.relationKind, reasons: ["mount relation requires parent and child surfaces"], nonClaims: relation.nonClaims });
  }
  if (relation.relationKind === "blend-candidate" && (!relation.referent || relation.referent.kind !== "blend-candidate-referent")) {
    return rejectedTopologyResult({ relationId: relation.relationId, relationKind: relation.relationKind, reasons: ["blend relation requires blend candidate referent"], nonClaims: relation.nonClaims });
  }
  if (relation.relationKind === "overlap" && !relation.referent && !relation.relation) {
    return rejectedTopologyResult({ relationId: relation.relationId, relationKind: relation.relationKind, reasons: ["overlap relation requires relation payload"], nonClaims: relation.nonClaims });
  }

  return admittedTopologyResult({
    relationId: relation.relationId,
    relationKind: relation.relationKind,
    reasons: ["topology relation descriptor is valid"],
    nonClaims: relation.nonClaims,
  });
}

function createContinuityBridge(input = {}) {
  const endpoints = (Array.isArray(input.endpoints) ? input.endpoints : []).map(normalizeEndpoint);
  return {
    kind: "continuity-bridge-referent",
    bridgeId: uniqueId("bridge", input.bridgeId),
    endpoints,
    direction: ["one-way", "bidirectional"].includes(input.direction) ? input.direction : "bidirectional",
    validationScope: input.validationScope || { mode: "endpoint-only" },
    rbcCompatibility: input.rbcCompatibility || null,
    nonClaims: normalizeNonClaims([
      "bridge does not merge continuities",
      "bridge validates only declared endpoints unless policy requires more",
      "passing through requires RBC admission",
      ...(input.nonClaims || []),
    ]),
  };
}

function validateBridgeCandidate({ bridge, continuities, rbcDescriptors, segmentPolicies, rulebook } = {}) {
  if (!bridge || bridge.kind !== "continuity-bridge-referent") {
    return rejectedTopologyResult({ relationKind: "bridge", reasons: ["bridge kind is invalid"] });
  }
  if (!Array.isArray(bridge.endpoints) || bridge.endpoints.length < 2) {
    return rejectedTopologyResult({ relationId: bridge.bridgeId, relationKind: "bridge", reasons: ["bridge requires at least two endpoints"], nonClaims: bridge.nonClaims });
  }
  if (!bridge.endpoints.every(endpointValid)) {
    return rejectedTopologyResult({ relationId: bridge.bridgeId, relationKind: "bridge", reasons: ["bridge endpoints must identify continuity, observer, and surface"], nonClaims: bridge.nonClaims });
  }

  const rbc = validateRbcCompatibility({
    descriptors: normalizeDescriptors(rbcDescriptors),
    policy: bridge.rbcCompatibility || {},
    requiredRuleKinds: bridge.rbcCompatibility?.requiredRuleKinds || [],
    operationKind: "continuity-bridge",
  });
  if (rbc.decision === "incompatible") {
    return rejectedTopologyResult({ relationId: bridge.bridgeId, relationKind: "bridge", reasons: rbc.reasons, rbcCompatibility: rbc, nonClaims: [...bridge.nonClaims, ...rbc.nonClaims] });
  }

  const segment = validateSegmentPoliciesForContinuities({ segmentPolicies, continuities });
  if (!segment.valid) {
    return rejectedTopologyResult({ relationId: bridge.bridgeId, relationKind: "bridge", reasons: segment.reasons, rbcCompatibility: rbc, segmentCompatibility: segment, nonClaims: [...bridge.nonClaims, ...rbc.nonClaims, ...segment.nonClaims] });
  }

  if (typeof rulebook === "function") {
    const ruleDecision = normalizeRuleDecision(rulebook({ operationKind: "continuity-bridge", bridge, continuities }), "bridge rejected by rulebook");
    if (ruleDecision.decision !== "admitted") {
      const result = ruleDecision.decision === "deferred" ? deferredTopologyResult : rejectedTopologyResult;
      return result({ relationId: bridge.bridgeId, relationKind: "bridge", reasons: ruleDecision.reasons, conflictReport: ruleDecision.conflictReport, conflicts: ruleDecision.conflicts, rbcCompatibility: rbc, segmentCompatibility: segment, nonClaims: [...bridge.nonClaims, ...rbc.nonClaims, ...segment.nonClaims] });
    }
  }

  return admittedTopologyResult({ relationId: bridge.bridgeId, relationKind: "bridge", reasons: ["bridge candidate is compatible"], rbcCompatibility: rbc, segmentCompatibility: segment, nonClaims: [...bridge.nonClaims, ...rbc.nonClaims, ...segment.nonClaims] });
}

function admitContinuityBridge(localContinuity, bridge, payload = {}) {
  if (!localContinuity || !localContinuity.ownerObserverId) {
    return { continuity: localContinuity, receipt: rejectedReceipt({ observerId: "unknown", reasons: ["local continuity is required"] }) };
  }
  if (!bridge || bridge.kind !== "continuity-bridge-referent") {
    return { continuity: localContinuity, receipt: rejectedReceipt({ observerId: localContinuity.ownerObserverId, reasons: ["bridge kind is invalid"] }) };
  }
  const actorObserverId = payload.actorObserverId || localContinuity.ownerObserverId;
  const event = createHappening({
    actorObserverId,
    parentHappeningId: payload.parentHappeningId || null,
    kind: EVENT_KIND_CONTINUITY_BRIDGE_ADMITTED,
    payload: { bridge, ...payload },
  });
  event.bridgeId = bridge.bridgeId;
  event.relationId = bridge.bridgeId;
  event.relationKind = "bridge";
  event.bridge = bridge;
  return {
    continuity: appendAdmittedHappening(localContinuity, event),
    receipt: admittedReceipt({
      observerId: localContinuity.ownerObserverId,
      actorObserverId,
      happeningId: event.id,
      parentHappeningId: event.parentHappeningId,
      relationId: bridge.bridgeId,
      relationKind: "bridge",
      bridgeId: bridge.bridgeId,
      reasons: ["continuity bridge admitted locally"],
      nonClaims: [...TOPOLOGY_NON_CLAIMS, ...bridge.nonClaims],
    }),
  };
}

function receiptForTopologyValidation(localContinuity, validation, fallbackObserverId = "unknown") {
  const observerId = localContinuity?.ownerObserverId || fallbackObserverId;
  const base = {
    observerId,
    actorObserverId: observerId,
    relationId: validation?.relationId || null,
    relationKind: validation?.relationKind || null,
    reasons: validation?.reasons || ["topology validation failed"],
    nonClaims: validation?.nonClaims || TOPOLOGY_NON_CLAIMS,
    conflicts: validation?.conflicts || [],
    conflictReport: validation?.conflictReport || null,
    rbcCompatibility: validation?.rbcCompatibility || null,
    segmentCompatibility: validation?.segmentCompatibility || null,
  };
  return validation?.decision === "deferred" ? deferredReceipt(base) : rejectedReceipt(base);
}

function validateAndAdmitContinuityBridge({
  localContinuity,
  bridge,
  continuities,
  rbcDescriptors,
  segmentPolicies,
  rulebook,
  payload = {},
} = {}) {
  const validation = validateBridgeCandidate({ bridge, continuities, rbcDescriptors, segmentPolicies, rulebook });
  if (validation.decision !== "admitted") {
    return {
      continuity: localContinuity,
      validation,
      receipt: receiptForTopologyValidation(localContinuity, validation),
    };
  }
  return {
    ...admitContinuityBridge(localContinuity, bridge, payload),
    validation,
  };
}

function createContinuityMount(input = {}) {
  return {
    kind: "continuity-mount-referent",
    mountId: uniqueId("mount", input.mountId),
    parent: normalizeEndpoint(input.parent || {}),
    child: normalizeEndpoint(input.child || {}),
    entrySurfaces: (Array.isArray(input.entrySurfaces) ? input.entrySurfaces : []).map((entry) => ({
      parentRef: String(entry.parentRef || "").trim(),
      childRef: String(entry.childRef || "").trim(),
    })),
    validationScope: input.validationScope || { mode: "mount-surface-only" },
    conflictPolicy: input.conflictPolicy || { mode: "reject-on-conflict" },
    rbcCompatibility: input.rbcCompatibility || null,
    nonClaims: normalizeNonClaims([
      "mount does not absorb child continuity",
      "parent ownership does not rewrite child history",
      "child continuity does not overwrite parent surface without admission",
      ...(input.nonClaims || []),
    ]),
  };
}

function validateMountCandidate({ mount, parentContinuity, childContinuity, rbcDescriptors, segmentPolicies, rulebook } = {}) {
  if (!mount || mount.kind !== "continuity-mount-referent") {
    return rejectedTopologyResult({ relationKind: "mount", reasons: ["mount kind is invalid"] });
  }
  if (!endpointValid(mount.parent) || !endpointValid(mount.child)) {
    return rejectedTopologyResult({ relationId: mount.mountId, relationKind: "mount", reasons: ["mount must identify parent and child surfaces"], nonClaims: mount.nonClaims });
  }

  const rbc = validateRbcCompatibility({
    descriptors: normalizeDescriptors(rbcDescriptors),
    policy: mount.rbcCompatibility || {},
    requiredRuleKinds: mount.rbcCompatibility?.requiredRuleKinds || [],
    operationKind: "continuity-mount",
  });
  if (rbc.decision === "incompatible") {
    return rejectedTopologyResult({ relationId: mount.mountId, relationKind: "mount", reasons: rbc.reasons, rbcCompatibility: rbc, nonClaims: [...mount.nonClaims, ...rbc.nonClaims] });
  }

  const segment = validateSegmentPoliciesForContinuities({ segmentPolicies, continuities: [parentContinuity, childContinuity].filter(Boolean) });
  if (!segment.valid) {
    return rejectedTopologyResult({ relationId: mount.mountId, relationKind: "mount", reasons: segment.reasons, rbcCompatibility: rbc, segmentCompatibility: segment, nonClaims: [...mount.nonClaims, ...rbc.nonClaims, ...segment.nonClaims] });
  }

  if (typeof rulebook === "function") {
    const ruleDecision = normalizeRuleDecision(rulebook({ operationKind: "continuity-mount", mount, parentContinuity, childContinuity }), "mount rejected by rulebook");
    if (ruleDecision.decision !== "admitted") {
      const policyMode = String(mount.conflictPolicy?.mode || "reject-on-conflict");
      const result = policyMode === "defer-on-conflict" && ruleDecision.decision !== "rejected" ? deferredTopologyResult : rejectedTopologyResult;
      return result({ relationId: mount.mountId, relationKind: "mount", reasons: ruleDecision.reasons, conflictReport: ruleDecision.conflictReport, conflicts: ruleDecision.conflicts, rbcCompatibility: rbc, segmentCompatibility: segment, nonClaims: [...mount.nonClaims, ...rbc.nonClaims, ...segment.nonClaims] });
    }
  }

  return admittedTopologyResult({ relationId: mount.mountId, relationKind: "mount", reasons: ["mount candidate is compatible"], rbcCompatibility: rbc, segmentCompatibility: segment, nonClaims: [...mount.nonClaims, ...rbc.nonClaims, ...segment.nonClaims] });
}

function admitContinuityMount(parentContinuity, mount, payload = {}) {
  if (!parentContinuity || !parentContinuity.ownerObserverId) {
    return { continuity: parentContinuity, receipt: rejectedReceipt({ observerId: "unknown", reasons: ["parent continuity is required"] }) };
  }
  if (!mount || mount.kind !== "continuity-mount-referent") {
    return { continuity: parentContinuity, receipt: rejectedReceipt({ observerId: parentContinuity.ownerObserverId, reasons: ["mount kind is invalid"] }) };
  }
  const actorObserverId = payload.actorObserverId || parentContinuity.ownerObserverId;
  const event = createHappening({
    actorObserverId,
    parentHappeningId: payload.parentHappeningId || null,
    kind: EVENT_KIND_CONTINUITY_MOUNT_ADMITTED,
    payload: { mount, ...payload },
  });
  event.mountId = mount.mountId;
  event.relationId = mount.mountId;
  event.relationKind = "mount";
  event.mount = mount;
  return {
    continuity: appendAdmittedHappening(parentContinuity, event),
    receipt: admittedReceipt({
      observerId: parentContinuity.ownerObserverId,
      actorObserverId,
      happeningId: event.id,
      parentHappeningId: event.parentHappeningId,
      relationId: mount.mountId,
      relationKind: "mount",
      mountId: mount.mountId,
      reasons: ["continuity mount admitted locally"],
      nonClaims: [...TOPOLOGY_NON_CLAIMS, ...mount.nonClaims],
    }),
  };
}

function validateAndAdmitContinuityMount({
  parentContinuity,
  childContinuity,
  mount,
  rbcDescriptors,
  segmentPolicies,
  rulebook,
  payload = {},
} = {}) {
  const validation = validateMountCandidate({ mount, parentContinuity, childContinuity, rbcDescriptors, segmentPolicies, rulebook });
  if (validation.decision !== "admitted") {
    return {
      continuity: parentContinuity,
      validation,
      receipt: receiptForTopologyValidation(parentContinuity, validation),
    };
  }
  return {
    ...admitContinuityMount(parentContinuity, mount, payload),
    validation,
  };
}

function createContinuityConflictReport(input = {}) {
  return {
    kind: "continuity-conflict-report",
    conflictSurface: String(input.conflictSurface || "").trim(),
    claims: Array.isArray(input.claims) ? input.claims.map((claim) => ({ ...claim })) : [],
    decision: String(input.decision || "requires-resolution").trim() || "requires-resolution",
    reasons: Array.isArray(input.reasons) ? input.reasons.slice() : [],
    nonClaims: normalizeNonClaims([
      "conflict report is not resolution",
      "overlap does not prove either claim globally true",
      ...(input.nonClaims || []),
    ]),
  };
}

function detectContinuityOverlap({ relation, continuities, rulebook } = {}) {
  if (typeof rulebook !== "function") {
    return { conflict: false, report: null, reasons: ["no overlap rulebook provided"] };
  }
  const decision = rulebook({ operationKind: "continuity-overlap", relation, continuities });
  if (!decision || decision.conflict === false || decision.decision === "admitted") {
    return { conflict: false, report: null, reasons: decision?.reasons || ["no overlap detected"] };
  }
  const report = createContinuityConflictReport(decision.conflictReport || decision.report || {
    conflictSurface: decision.conflictSurface || relation?.surfaceRef || "unknown",
    claims: decision.claims || [],
    decision: decision.decision || "requires-resolution",
    reasons: decision.reasons || ["overlap detected by rulebook"],
  });
  return { conflict: true, report, reasons: report.reasons };
}

module.exports = {
  TOPOLOGY_NON_CLAIMS,
  createTopologyRelation,
  validateTopologyRelation,
  admittedTopologyResult,
  rejectedTopologyResult,
  deferredTopologyResult,
  validateSegmentPoliciesForContinuities,
  createContinuityBridge,
  validateBridgeCandidate,
  admitContinuityBridge,
  validateAndAdmitContinuityBridge,
  createContinuityMount,
  validateMountCandidate,
  admitContinuityMount,
  validateAndAdmitContinuityMount,
  createContinuityConflictReport,
  detectContinuityOverlap,
};
