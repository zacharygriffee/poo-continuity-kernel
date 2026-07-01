const { createRandomId } = require("./ids");

const RULEBOOK_CASCADE_KIND = "rulebook-cascade";
const RBC_LAYER_KIND = "rbc-layer";
const RBC_SUBJECT_KIND = "rbc-subject";
const RBC_FINDING_KIND = "rbc-finding";
const RBC_CONSTRAINT_KIND = "rbc-constraint";
const RBC_LAYER_RESULT_KIND = "rbc-layer-result";
const RBC_CASCADE_RESULT_KIND = "rbc-cascade-result";
const RBC_DECISION_RECEIPT_KIND = "rbc-decision-receipt";
const RBC_PARTICIPATION_POLICY_KIND = "rbc-participation-policy";

const RBC_SUBJECT_KINDS = Object.freeze([
  "happening",
  "branch",
  "branch-composite",
  "observer-seat",
  "referent",
  "context",
  "render-surface",
  "renderer-branch",
  "asset-branch",
  "import",
  "transport-envelope",
  "lineage",
  "fork",
  "capability",
  "rulebook-change",
  "projection-claim",
  "debug-branch",
  "candidate-package",
]);

const RBC_SCOPES = Object.freeze([
  "admission",
  "review",
  "import",
  "mount",
  "merge",
  "fork",
  "sandbox",
  "render",
  "project",
  "transport",
  "debug",
  "exchange",
  "operator-review",
  "local-participation",
]);

const RBC_DECISIONS = Object.freeze([
  "admitted",
  "accepted",
  "rejected",
  "deferred",
  "ignored",
  "hidden",
  "sandboxed",
  "quarantined",
  "fork-required",
  "admitted-with-constraints",
  "candidate-only",
  "summarized",
  "unsupported",
]);

const RBC_FINDING_KINDS = Object.freeze([
  "schema-mismatch",
  "missing-required-branch",
  "branch-closure-gap",
  "unsupported-branch-role",
  "privileged-power",
  "authority-claim",
  "rulebook-change",
  "rbc-incompatibility",
  "malicious-affordance",
  "hidden-dependency",
  "unbounded-codec",
  "renderer-authority-leak",
  "provenance-gap",
  "custody-conflict",
  "fork-lineage-conflict",
  "stale-branch-head",
  "summary-omission",
  "debug-branch-leak",
  "projection-delta-risk",
  "transport-source-mismatch",
  "unknown-risk",
]);

const RBC_FINDING_SEVERITIES = Object.freeze([
  "info",
  "warning",
  "risk",
  "critical",
]);

const RBC_DECISION_NOTES = Object.freeze({
  accepted: "compatible for limited/local use or inspection",
  admitted: "contributes to local continuity/projection",
  hidden: "not projected in this renderer/view",
  ignored: "out of scope for this cascade",
  sandboxed: "usable only under constrained execution/projection",
  "fork-required": "cannot join current branch head without forking",
  "candidate-only": "preserved for review but not admitted",
});

const DEFAULT_RBC_CASCADE_NON_CLAIMS = Object.freeze([
  "RBC cascade result is local participation policy",
  "RBC cascade result is not global proof authority",
  "RBC cascade result is not global truth",
  "RBC cascade result does not perform automatic merge",
  "RBC cascade result is not hidden engine authority",
  "RBC cascade result does not make transport/import truthful",
  "RBC cascade result does not make renderer output authority",
]);

const DECISION_RANK = Object.freeze({
  rejected: 100,
  quarantined: 95,
  "fork-required": 90,
  deferred: 80,
  unsupported: 70,
  "admitted-with-constraints": 60,
  sandboxed: 55,
  hidden: 50,
  "candidate-only": 45,
  summarized: 40,
  admitted: 30,
  accepted: 20,
  ignored: 10,
});

function cloneJson(value) {
  if (value === undefined) return undefined;
  return JSON.parse(JSON.stringify(value));
}

function normalizeToken(value, fallback = "unknown") {
  const normalized = String(value || "").trim();
  return normalized || fallback;
}

function normalizeOptionalToken(value) {
  const normalized = String(value || "").trim();
  return normalized || null;
}

function uniqueStrings(values) {
  return Array.from(new Set((Array.isArray(values) ? values : [])
    .map((value) => (typeof value === "string" ? value.trim() : ""))
    .filter(Boolean)));
}

function mergeNonClaims(...sets) {
  return uniqueStrings(sets.flat());
}

function assertKnown(value, known, label, fallback) {
  const normalized = normalizeToken(value, fallback);
  if (!known.includes(normalized)) {
    throw new Error(`unsupported ${label} ${normalized}`);
  }
  return normalized;
}

function createRbcSubject(input = {}) {
  if (!input || typeof input !== "object") {
    throw new Error("RBC subject must be an object");
  }
  return {
    kind: assertKnown(input.kind, RBC_SUBJECT_KINDS, "RBC subject kind", "candidate-package"),
    id: normalizeToken(input.id, "unknown-subject"),
    ref: input.ref == null ? null : String(input.ref),
  };
}

function createRbcFinding(input = {}) {
  if (!input || typeof input !== "object") {
    throw new Error("RBC finding input must be an object");
  }
  return {
    kind: assertKnown(input.kind || input.findingKind, RBC_FINDING_KINDS, "RBC finding kind", "unknown-risk"),
    receiptKind: RBC_FINDING_KIND,
    severity: assertKnown(input.severity, RBC_FINDING_SEVERITIES, "RBC finding severity", "info"),
    message: String(input.message || "RBC finding recorded"),
    evidenceRefs: uniqueStrings(input.evidenceRefs),
    nonClaims: mergeNonClaims(input.nonClaims || []),
  };
}

function createRbcConstraint(input = {}) {
  if (!input || typeof input !== "object") {
    throw new Error("RBC constraint input must be an object");
  }
  return {
    kind: normalizeToken(input.kind, "rbc-constraint"),
    receiptKind: RBC_CONSTRAINT_KIND,
    reason: String(input.reason || "constraint required by RBC cascade"),
    appliesTo: uniqueStrings(input.appliesTo),
    nonClaims: mergeNonClaims(input.nonClaims || []),
  };
}

function createRbcLayer(input = {}) {
  return {
    kind: RBC_LAYER_KIND,
    layerId: normalizeToken(input.layerId || input.id, createRandomId("rbc-layer")),
    title: input.title || null,
    scope: input.scope ? assertKnown(input.scope, RBC_SCOPES, "RBC scope", "local-participation") : null,
    subjectKinds: uniqueStrings(input.subjectKinds),
    nonClaims: mergeNonClaims(input.nonClaims || []),
  };
}

function createRbcLayerResult(input = {}) {
  if (!input || typeof input !== "object") {
    throw new Error("RBC layer result input must be an object");
  }
  const layer = createRbcLayer({ layerId: input.layerId || input.id, title: input.title, scope: input.scope });
  return {
    kind: RBC_LAYER_RESULT_KIND,
    layerId: layer.layerId,
    title: layer.title,
    decision: assertKnown(input.decision, RBC_DECISIONS, "RBC decision", "candidate-only"),
    subjectRef: input.subjectRef ? createRbcSubject(input.subjectRef) : null,
    scope: input.scope ? assertKnown(input.scope, RBC_SCOPES, "RBC scope", "local-participation") : null,
    findings: (Array.isArray(input.findings) ? input.findings : []).map(createRbcFinding),
    constraints: (Array.isArray(input.constraints) ? input.constraints : []).map(createRbcConstraint),
    childDecisions: Array.isArray(input.childDecisions) ? input.childDecisions.map(cloneJson) : [],
    reasons: uniqueStrings(input.reasons),
    nonClaims: mergeNonClaims(input.nonClaims || []),
  };
}

function createRbcParticipationPolicy(input = {}) {
  return {
    kind: RBC_PARTICIPATION_POLICY_KIND,
    scope: assertKnown(input.scope, RBC_SCOPES, "RBC scope", "local-participation"),
    defaultDecision: assertKnown(input.defaultDecision, RBC_DECISIONS, "RBC decision", "candidate-only"),
    atomicComposite: input.atomicComposite === true,
    requiredLayers: uniqueStrings(input.requiredLayers),
    nonClaims: mergeNonClaims(input.nonClaims || []),
  };
}

function decideFinal(layerResults, fallbackDecision) {
  if (!Array.isArray(layerResults) || layerResults.length === 0) return fallbackDecision;
  return layerResults
    .map((entry) => entry.decision)
    .sort((a, b) => (DECISION_RANK[b] || 0) - (DECISION_RANK[a] || 0))[0] || fallbackDecision;
}

function createRulebookCascade(input = {}) {
  return {
    kind: RULEBOOK_CASCADE_KIND,
    cascadeId: normalizeToken(input.cascadeId || input.id, createRandomId("rbc-cascade")),
    scope: assertKnown(input.scope, RBC_SCOPES, "RBC scope", "local-participation"),
    layers: (Array.isArray(input.layers) ? input.layers : []).map(createRbcLayer),
    policy: createRbcParticipationPolicy(input.policy || { scope: input.scope }),
    nonClaims: mergeNonClaims(DEFAULT_RBC_CASCADE_NON_CLAIMS, input.nonClaims || []),
  };
}

function createRbcCascadeResult(input = {}) {
  if (!input || typeof input !== "object") {
    throw new Error("RBC cascade result input must be an object");
  }
  const subjectRef = createRbcSubject(input.subjectRef || input.subject || {});
  const scope = assertKnown(input.scope, RBC_SCOPES, "RBC scope", "local-participation");
  const policy = createRbcParticipationPolicy(input.policy || { scope });
  const layerResults = (Array.isArray(input.layerResults) ? input.layerResults : []).map((result) =>
    createRbcLayerResult({ scope, subjectRef, ...result })
  );
  const finalDecision = input.finalDecision
    ? assertKnown(input.finalDecision, RBC_DECISIONS, "RBC decision", "candidate-only")
    : decideFinal(layerResults, policy.defaultDecision);
  const childBranchDecisions = Array.isArray(input.childBranchDecisions)
    ? input.childBranchDecisions.map((entry) => ({
        branchId: normalizeToken(entry.branchId, "unknown-branch"),
        role: normalizeOptionalToken(entry.role),
        decision: assertKnown(entry.decision, RBC_DECISIONS, "RBC decision", "candidate-only"),
        layerId: normalizeOptionalToken(entry.layerId),
        reasons: uniqueStrings(entry.reasons),
      }))
    : [];

  return {
    kind: RBC_CASCADE_RESULT_KIND,
    subjectRef,
    scope,
    finalDecision,
    decisionNotes: RBC_DECISION_NOTES,
    layerResults,
    childBranchDecisions,
    constraints: (Array.isArray(input.constraints) ? input.constraints : [])
      .map(createRbcConstraint)
      .concat(layerResults.flatMap((entry) => entry.constraints)),
    findings: layerResults.flatMap((entry) => entry.findings),
    policy,
    nonClaims: mergeNonClaims(DEFAULT_RBC_CASCADE_NON_CLAIMS, input.nonClaims || [], policy.nonClaims),
  };
}

function createRbcDecisionReceipt(input = {}) {
  const result = input.kind === RBC_CASCADE_RESULT_KIND ? input : createRbcCascadeResult(input);
  return {
    kind: RBC_DECISION_RECEIPT_KIND,
    receiptId: normalizeToken(input.receiptId || input.id, createRandomId("rbc-receipt")),
    subjectRef: result.subjectRef,
    scope: result.scope,
    decision: result.finalDecision,
    layerResults: result.layerResults.map(cloneJson),
    childBranchDecisions: result.childBranchDecisions.map(cloneJson),
    constraints: result.constraints.map(cloneJson),
    findings: result.findings.map(cloneJson),
    nonClaims: mergeNonClaims(result.nonClaims, [
      "RBC decision receipt records local policy result only",
    ]),
  };
}

module.exports = {
  RULEBOOK_CASCADE_KIND,
  RBC_LAYER_KIND,
  RBC_SUBJECT_KIND,
  RBC_FINDING_KIND,
  RBC_CONSTRAINT_KIND,
  RBC_LAYER_RESULT_KIND,
  RBC_CASCADE_RESULT_KIND,
  RBC_DECISION_RECEIPT_KIND,
  RBC_PARTICIPATION_POLICY_KIND,
  RBC_SUBJECT_KINDS,
  RBC_SCOPES,
  RBC_DECISIONS,
  RBC_FINDING_KINDS,
  RBC_FINDING_SEVERITIES,
  RBC_DECISION_NOTES,
  DEFAULT_RBC_CASCADE_NON_CLAIMS,
  createRbcSubject,
  createRbcFinding,
  createRbcConstraint,
  createRbcLayer,
  createRbcLayerResult,
  createRbcParticipationPolicy,
  createRulebookCascade,
  createRbcCascadeResult,
  createRbcDecisionReceipt,
};
