const { createRandomId } = require("./ids");

const LOCAL_CONTINUITY_REVIEW_KIND = "local-continuity-review";
const CONTINUITY_REVIEW_RECEIPT_KIND = "local-continuity-review-receipt";
const CONTINUITY_REVIEW_FINDING_KIND = "continuity-review-finding";
const CONTINUITY_REVIEW_CONSTRAINT_KIND = "continuity-review-constraint";
const CONTINUITY_PROJECTION_DELTA_KIND = "continuity-projection-delta";

const CONTINUITY_REVIEW_DECISIONS = Object.freeze([
  "accept",
  "reject",
  "defer",
  "fork",
  "sandbox",
  "quarantine",
  "ignore",
  "summarize",
  "admit",
  "admit-with-constraints",
  "candidate-only",
]);

const CONTINUITY_REVIEW_FINDING_KINDS = Object.freeze([
  "capability-claim",
  "privileged-power",
  "authority-claim",
  "rulebook-change",
  "rbc-incompatibility",
  "branch-closure-gap",
  "hidden-dependency",
  "malicious-affordance",
  "unbounded-codec",
  "executable-payload",
  "renderer-authority-leak",
  "provenance-gap",
  "custody-conflict",
  "fork-lineage-ambiguity",
  "stale-branch-head",
  "summary-omission",
  "debug-branch-leak",
  "proof-branch-overclaim",
  "transport-source-mismatch",
  "projection-delta-risk",
  "unknown-risk",
]);

const CONTINUITY_REVIEW_SEVERITIES = Object.freeze([
  "info",
  "warning",
  "risk",
  "critical",
]);

const CONTINUITY_REVIEW_SCOPES = Object.freeze([
  "join-local-continuity",
  "admit-branch-composite",
  "import-candidate",
  "render",
  "inspect",
  "debug",
  "fork",
  "mount",
  "compose",
  "transfer",
]);

const CONTINUITY_RISK_CLASSES = Object.freeze([
  "semantic-safety",
  "authority-safety",
  "continuity-compatibility",
  "branch-closure",
  "provenance",
  "renderer-risk",
  "capability-review",
  "transport-source",
  "unknown-risk",
]);

const DEFAULT_REVIEW_NON_CLAIMS = Object.freeze([
  "review receipt is local compatibility assessment only",
  "review receipt is not global proof authority",
  "review receipt does not perform automatic merge",
  "review receipt does not admit continuity unless paired with local admission",
  "local review does not override RBC",
  "local review is not transport admission",
  "local review is not renderer authority",
]);

const REVIEW_DECISION_NOTES = Object.freeze({
  accept: "locally compatible for inspection, use, or supporting material under scope",
  admit: "contributes to local continuity projection or admitted branch composition only when paired with local admission",
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

function createContinuityReviewSubject(input = {}) {
  if (!input || typeof input !== "object") {
    throw new Error("review subject must be an object");
  }
  return {
    kind: normalizeToken(input.kind, "continuity-material"),
    id: normalizeToken(input.id, "unknown-subject"),
    ref: input.ref == null ? null : String(input.ref),
  };
}

function createReviewer(input = {}) {
  return {
    observerId: normalizeOptionalToken(input.observerId),
    systemId: normalizeOptionalToken(input.systemId),
    agentId: normalizeOptionalToken(input.agentId),
  };
}

function createReviewedEvidence(input = {}) {
  return {
    branches: Array.isArray(input.branches) ? input.branches.map(cloneJson) : [],
    branchComposites: Array.isArray(input.branchComposites) ? input.branchComposites.map(cloneJson) : [],
    receipts: Array.isArray(input.receipts) ? input.receipts.map(cloneJson) : [],
    checkpoints: Array.isArray(input.checkpoints) ? input.checkpoints.map(cloneJson) : [],
    causalHistoryRefs: Array.isArray(input.causalHistoryRefs) ? input.causalHistoryRefs.map(String) : [],
  };
}

function createContinuityProjectionDelta(input = {}) {
  return {
    kind: CONTINUITY_PROJECTION_DELTA_KIND,
    summary: String(input.summary || ""),
    affectedReferents: uniqueStrings(input.affectedReferents),
    affectedBranches: uniqueStrings(input.affectedBranches),
    affectedCapabilities: uniqueStrings(input.affectedCapabilities),
    nonClaims: mergeNonClaims(input.nonClaims || [], [
      "projection delta is review description only and does not mutate projection",
    ]),
  };
}

function createContinuityReviewFinding(input = {}) {
  if (!input || typeof input !== "object") {
    throw new Error("review finding input must be an object");
  }
  return {
    kind: assertKnown(input.kind || input.findingKind, CONTINUITY_REVIEW_FINDING_KINDS, "review finding kind", "unknown-risk"),
    receiptKind: CONTINUITY_REVIEW_FINDING_KIND,
    severity: assertKnown(input.severity, CONTINUITY_REVIEW_SEVERITIES, "review finding severity", "info"),
    riskClass: input.riskClass
      ? assertKnown(input.riskClass, CONTINUITY_RISK_CLASSES, "continuity risk class", "unknown-risk")
      : null,
    message: String(input.message || "review finding recorded"),
    evidenceRefs: uniqueStrings(input.evidenceRefs),
    nonClaims: mergeNonClaims(input.nonClaims || []),
  };
}

function createContinuityReviewConstraint(input = {}) {
  if (!input || typeof input !== "object") {
    throw new Error("review constraint input must be an object");
  }
  return {
    kind: normalizeToken(input.kind, "review-constraint"),
    receiptKind: CONTINUITY_REVIEW_CONSTRAINT_KIND,
    reason: String(input.reason || "constraint required by local review"),
    appliesToBranches: uniqueStrings(input.appliesToBranches),
    nonClaims: mergeNonClaims(input.nonClaims || []),
  };
}

function normalizeBranchRefs(values) {
  return uniqueStrings(values);
}

function createLocalContinuityReview(input = {}) {
  const subjectRef = createContinuityReviewSubject(input.subjectRef || input.subject || {});
  return {
    kind: LOCAL_CONTINUITY_REVIEW_KIND,
    reviewId: normalizeToken(input.reviewId || input.id, createRandomId("review")),
    subjectRef,
    reviewer: createReviewer(input.reviewer || {}),
    scope: normalizeToken(input.scope, "inspect"),
    rbcRef: normalizeOptionalToken(input.rbcRef),
    reviewedEvidence: createReviewedEvidence(input.reviewedEvidence || {}),
    nonClaims: mergeNonClaims(DEFAULT_REVIEW_NON_CLAIMS, input.nonClaims || [], [
      "local continuity review is not an agent runtime",
    ]),
  };
}

function createContinuityReviewReceipt(input = {}) {
  if (!input || typeof input !== "object") {
    throw new Error("review receipt input must be an object");
  }
  const subjectRef = createContinuityReviewSubject(input.subjectRef || input.subject || {});
  const decision = assertKnown(input.decision, CONTINUITY_REVIEW_DECISIONS, "continuity review decision", "defer");
  const recommendation = assertKnown(
    input.recommendation || decision,
    CONTINUITY_REVIEW_DECISIONS,
    "continuity review recommendation",
    decision
  );
  return {
    kind: CONTINUITY_REVIEW_RECEIPT_KIND,
    receiptId: normalizeToken(input.receiptId || input.id, createRandomId("review")),
    subjectRef,
    reviewer: createReviewer(input.reviewer || {}),
    scope: normalizeToken(input.scope, "inspect"),
    decision,
    recommendation,
    decisionNotes: {
      accept: REVIEW_DECISION_NOTES.accept,
      admit: REVIEW_DECISION_NOTES.admit,
    },
    rbcRef: normalizeOptionalToken(input.rbcRef),
    reviewedEvidence: createReviewedEvidence(input.reviewedEvidence || {}),
    projectionDelta: createContinuityProjectionDelta(input.projectionDelta || {}),
    findings: (Array.isArray(input.findings) ? input.findings : []).map(createContinuityReviewFinding),
    admittedBranches: normalizeBranchRefs(input.admittedBranches),
    acceptedBranches: normalizeBranchRefs(input.acceptedBranches),
    rejectedBranches: normalizeBranchRefs(input.rejectedBranches),
    deferredBranches: normalizeBranchRefs(input.deferredBranches),
    sandboxedBranches: normalizeBranchRefs(input.sandboxedBranches),
    ignoredBranches: normalizeBranchRefs(input.ignoredBranches),
    constraints: (Array.isArray(input.constraints) ? input.constraints : []).map(createContinuityReviewConstraint),
    nonClaims: mergeNonClaims(DEFAULT_REVIEW_NON_CLAIMS, input.nonClaims || []),
  };
}

module.exports = {
  LOCAL_CONTINUITY_REVIEW_KIND,
  CONTINUITY_REVIEW_RECEIPT_KIND,
  CONTINUITY_REVIEW_FINDING_KIND,
  CONTINUITY_REVIEW_CONSTRAINT_KIND,
  CONTINUITY_PROJECTION_DELTA_KIND,
  CONTINUITY_REVIEW_DECISIONS,
  CONTINUITY_REVIEW_FINDING_KINDS,
  CONTINUITY_REVIEW_SEVERITIES,
  CONTINUITY_REVIEW_SCOPES,
  CONTINUITY_RISK_CLASSES,
  DEFAULT_REVIEW_NON_CLAIMS,
  REVIEW_DECISION_NOTES,
  createContinuityReviewSubject,
  createContinuityReviewFinding,
  createContinuityReviewConstraint,
  createContinuityProjectionDelta,
  createLocalContinuityReview,
  createContinuityReviewReceipt,
};
