const { createHappening } = require("./happenings");
const { appendAdmittedHappening } = require("./continuity");
const { admittedReceipt, rejectedReceipt } = require("./receipts");
const { validateRbcCompatibility } = require("./rbc-compatibility");
const { validateSegmentCompatibility } = require("./segments");
const {
  EVENT_KIND_CONTINUITY_BRIDGE_ADMITTED,
  EVENT_KIND_CONTINUITY_MOUNT_ADMITTED,
} = require("./event-kinds");

function uniqueId(prefix, input) {
  return String(input || "").trim() || `${prefix}-${Date.now()}`;
}

function normalizeNonClaims(nonClaims) {
  return Array.from(new Set((Array.isArray(nonClaims) ? nonClaims : [])
    .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
    .filter(Boolean)));
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

function validateSegments(segmentPolicies, continuities) {
  const policies = normalizeSegmentPolicies(segmentPolicies);
  const reasons = [];
  const nonClaims = [];
  for (const entry of policies) {
    const policy = entry?.policy || entry;
    const continuity = entry?.sourceContinuity || entry?.continuity || continuities.find((item) =>
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
    reasons.push(...(validation.reasons || []));
    nonClaims.push(...(validation.nonClaims || []));
    if (!validation.valid) {
      return { valid: false, reasons, nonClaims: normalizeNonClaims(nonClaims) };
    }
  }
  return { valid: true, reasons, nonClaims: normalizeNonClaims(nonClaims) };
}

function normalizeRuleDecision(decision, fallbackReason) {
  if (!decision) return { decision: "admitted", reasons: [] };
  const normalized = String(decision.decision || (decision.conflict ? "rejected" : "admitted")).trim();
  return {
    decision: normalized,
    reasons: Array.isArray(decision.reasons) && decision.reasons.length > 0 ? decision.reasons : [fallbackReason],
    conflictReport: decision.conflictReport || decision.report || null,
  };
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
    return { valid: false, decision: "rejected", reasons: ["bridge kind is invalid"], nonClaims: [] };
  }
  if (!Array.isArray(bridge.endpoints) || bridge.endpoints.length < 2) {
    return { valid: false, decision: "rejected", reasons: ["bridge requires at least two endpoints"], nonClaims: bridge.nonClaims };
  }
  if (!bridge.endpoints.every(endpointValid)) {
    return { valid: false, decision: "rejected", reasons: ["bridge endpoints must identify continuity, observer, and surface"], nonClaims: bridge.nonClaims };
  }

  const descriptors = normalizeDescriptors(rbcDescriptors);
  const rbc = validateRbcCompatibility({
    descriptors,
    policy: bridge.rbcCompatibility || {},
    requiredRuleKinds: bridge.rbcCompatibility?.requiredRuleKinds || [],
    operationKind: "continuity-bridge",
  });
  if (rbc.decision === "incompatible") {
    return { valid: false, decision: "rejected", reasons: rbc.reasons, rbcCompatibility: rbc, nonClaims: normalizeNonClaims([...bridge.nonClaims, ...rbc.nonClaims]) };
  }

  const segment = validateSegments(segmentPolicies, normalizeContinuities(continuities));
  if (!segment.valid) {
    return { valid: false, decision: "rejected", reasons: segment.reasons, rbcCompatibility: rbc, nonClaims: normalizeNonClaims([...bridge.nonClaims, ...rbc.nonClaims, ...segment.nonClaims]) };
  }

  if (typeof rulebook === "function") {
    const ruleDecision = normalizeRuleDecision(rulebook({ operationKind: "continuity-bridge", bridge, continuities }), "bridge rejected by rulebook");
    if (ruleDecision.decision !== "admitted") {
      return { valid: false, decision: ruleDecision.decision, reasons: ruleDecision.reasons, conflictReport: ruleDecision.conflictReport, rbcCompatibility: rbc, nonClaims: normalizeNonClaims([...bridge.nonClaims, ...rbc.nonClaims, ...segment.nonClaims]) };
    }
  }

  return { valid: true, decision: "admitted", reasons: ["bridge candidate is compatible"], rbcCompatibility: rbc, nonClaims: normalizeNonClaims([...bridge.nonClaims, ...rbc.nonClaims, ...segment.nonClaims]) };
}

function admitContinuityBridge(localContinuity, bridge, payload = {}) {
  if (!localContinuity || !localContinuity.ownerObserverId) {
    return { continuity: localContinuity, receipt: rejectedReceipt({ observerId: "unknown", reasons: ["local continuity is required"] }) };
  }
  if (!bridge || bridge.kind !== "continuity-bridge-referent") {
    return { continuity: localContinuity, receipt: rejectedReceipt({ observerId: localContinuity.ownerObserverId, reasons: ["bridge kind is invalid"] }) };
  }
  const event = createHappening({
    actorObserverId: payload.actorObserverId || localContinuity.ownerObserverId,
    kind: EVENT_KIND_CONTINUITY_BRIDGE_ADMITTED,
    payload: { bridge, ...payload },
  });
  event.bridgeId = bridge.bridgeId;
  event.bridge = bridge;
  return {
    continuity: appendAdmittedHappening(localContinuity, event),
    receipt: admittedReceipt({
      observerId: localContinuity.ownerObserverId,
      actorObserverId: payload.actorObserverId || localContinuity.ownerObserverId,
      happeningId: event.id,
      reasons: ["continuity bridge admitted locally"],
      nonClaims: bridge.nonClaims,
    }),
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
    return { valid: false, decision: "rejected", reasons: ["mount kind is invalid"], nonClaims: [] };
  }
  if (!endpointValid(mount.parent) || !endpointValid(mount.child)) {
    return { valid: false, decision: "rejected", reasons: ["mount must identify parent and child surfaces"], nonClaims: mount.nonClaims };
  }

  const rbc = validateRbcCompatibility({
    descriptors: normalizeDescriptors(rbcDescriptors),
    policy: mount.rbcCompatibility || {},
    requiredRuleKinds: mount.rbcCompatibility?.requiredRuleKinds || [],
    operationKind: "continuity-mount",
  });
  if (rbc.decision === "incompatible") {
    return { valid: false, decision: "rejected", reasons: rbc.reasons, rbcCompatibility: rbc, nonClaims: normalizeNonClaims([...mount.nonClaims, ...rbc.nonClaims]) };
  }

  const segment = validateSegments(segmentPolicies, [parentContinuity, childContinuity].filter(Boolean));
  if (!segment.valid) {
    return { valid: false, decision: "rejected", reasons: segment.reasons, rbcCompatibility: rbc, nonClaims: normalizeNonClaims([...mount.nonClaims, ...rbc.nonClaims, ...segment.nonClaims]) };
  }

  if (typeof rulebook === "function") {
    const ruleDecision = normalizeRuleDecision(rulebook({ operationKind: "continuity-mount", mount, parentContinuity, childContinuity }), "mount rejected by rulebook");
    if (ruleDecision.decision !== "admitted") {
      const policyMode = String(mount.conflictPolicy?.mode || "reject-on-conflict");
      const decision = policyMode === "defer-on-conflict" && ruleDecision.decision !== "rejected" ? "deferred" : "rejected";
      return { valid: false, decision, reasons: ruleDecision.reasons, conflictReport: ruleDecision.conflictReport, rbcCompatibility: rbc, nonClaims: normalizeNonClaims([...mount.nonClaims, ...rbc.nonClaims, ...segment.nonClaims]) };
    }
  }

  return { valid: true, decision: "admitted", reasons: ["mount candidate is compatible"], rbcCompatibility: rbc, nonClaims: normalizeNonClaims([...mount.nonClaims, ...rbc.nonClaims, ...segment.nonClaims]) };
}

function admitContinuityMount(parentContinuity, mount, payload = {}) {
  if (!parentContinuity || !parentContinuity.ownerObserverId) {
    return { continuity: parentContinuity, receipt: rejectedReceipt({ observerId: "unknown", reasons: ["parent continuity is required"] }) };
  }
  if (!mount || mount.kind !== "continuity-mount-referent") {
    return { continuity: parentContinuity, receipt: rejectedReceipt({ observerId: parentContinuity.ownerObserverId, reasons: ["mount kind is invalid"] }) };
  }
  const event = createHappening({
    actorObserverId: payload.actorObserverId || parentContinuity.ownerObserverId,
    kind: EVENT_KIND_CONTINUITY_MOUNT_ADMITTED,
    payload: { mount, ...payload },
  });
  event.mountId = mount.mountId;
  event.mount = mount;
  return {
    continuity: appendAdmittedHappening(parentContinuity, event),
    receipt: admittedReceipt({
      observerId: parentContinuity.ownerObserverId,
      actorObserverId: payload.actorObserverId || parentContinuity.ownerObserverId,
      happeningId: event.id,
      reasons: ["continuity mount admitted locally"],
      nonClaims: mount.nonClaims,
    }),
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
  createContinuityBridge,
  validateBridgeCandidate,
  admitContinuityBridge,
  createContinuityMount,
  validateMountCandidate,
  admitContinuityMount,
  createContinuityConflictReport,
  detectContinuityOverlap,
};
