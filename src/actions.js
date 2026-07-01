const { createRandomId } = require("./ids");

const ACTION_DECLARATION_KIND = "continuity-action-declaration";
const ACTION_PARTICIPATION_KIND = "action-participation";
const PROJECTED_AFFORDANCE_KIND = "projected-affordance";
const ACTION_INVOCATION_KIND = "action-invocation";
const ACTION_CONSTRAINT_KIND = "action-constraint";
const ACTION_RECEIPT_KIND = "action-receipt";
const CANDIDATE_HAPPENING_INTENT_KIND = "candidate-happening-intent";

const ACTION_SOURCES = Object.freeze([
  "explicit-action-material",
  "implicit-renderer-action",
  "implicit-scenario-action",
  "implicit-tool-surface-action",
  "implicit-operator-policy-action",
  "implicit-rbc-action",
  "local-replacement-action",
]);

const ACTION_PORTABILITY = Object.freeze([
  "candidate-material",
  "local-only",
  "explicit-portable-material",
  "implicit-not-portable",
]);

const ACTION_PARTICIPATION_DECISIONS = Object.freeze([
  "accepted",
  "rejected",
  "hidden",
  "visible",
  "actable",
  "sandboxed",
  "constrained",
  "candidate-only",
  "replaced",
  "deprecated",
  "unsupported",
  "deferred",
]);

const ACTION_REVIEW_DECISIONS = ACTION_PARTICIPATION_DECISIONS;

const ACTION_SCOPES = Object.freeze([
  "participation",
  "projection",
  "invocation",
  "admission",
  "render",
  "debug",
  "import",
  "local-use",
  "candidate-review",
]);

const ACTION_SUBJECT_KINDS = Object.freeze([
  "observer",
  "observer-seat",
  "referent",
  "branch",
  "branch-composite",
  "renderer-surface",
  "context",
  "file",
  "item",
  "agent",
  "reality",
]);

const ACTION_DECISION_NOTES = Object.freeze({
  accepted: "action declaration is compatible with local policy under scope",
  visible: "projection may show it to an observer/seat",
  actable: "the current observer/seat may invoke it",
  sandboxed: "action may only be used under constrained local handling",
  "candidate-only": "preserved for review, not used for projection/invocation",
  replaced: "local reality substitutes a local action declaration or binding",
});

const DEFAULT_ACTION_NON_CLAIMS = Object.freeze([
  "action declaration is not a happening",
  "action declaration is not admission",
  "action declaration is not permission",
  "action declaration is not renderer authority",
  "action declaration is not executable authority",
  "candidate happening must pass local RBC",
  "action invocation does not guarantee admission",
  "implicit action is not portable authority",
]);

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

function createActionSubject(input = {}) {
  if (!input || typeof input !== "object") {
    throw new Error("action subject must be an object");
  }
  return {
    kind: assertKnown(input.kind, ACTION_SUBJECT_KINDS, "action subject kind", "referent"),
    id: normalizeToken(input.id, "unknown-subject"),
    ref: input.ref == null ? null : String(input.ref),
  };
}

function createActionSource(input = {}) {
  return {
    kind: assertKnown(input.kind, ACTION_SOURCES, "action source", "explicit-action-material"),
    branchRef: normalizeOptionalToken(input.branchRef),
    localSurfaceRef: normalizeOptionalToken(input.localSurfaceRef),
    nonClaims: mergeNonClaims(input.nonClaims || []),
  };
}

function createCandidateHappeningIntent(input = {}) {
  return {
    kind: normalizeToken(input.kind || input.happeningKind, "candidate-happening"),
    receiptKind: CANDIDATE_HAPPENING_INTENT_KIND,
    requiredFields: uniqueStrings(input.requiredFields),
    payloadShape: input.payloadShape && typeof input.payloadShape === "object" ? cloneJson(input.payloadShape) : {},
    nonClaims: mergeNonClaims(input.nonClaims || [], [
      "candidate happening intent is not an admitted happening",
      "candidate happening must pass local RBC",
    ]),
  };
}

function createActionConstraint(input = {}) {
  return {
    kind: normalizeToken(input.kind, "action-constraint"),
    receiptKind: ACTION_CONSTRAINT_KIND,
    reason: String(input.reason || "constraint required by local action policy"),
    appliesTo: uniqueStrings(input.appliesTo),
    nonClaims: mergeNonClaims(input.nonClaims || []),
  };
}

function createActionDeclaration(input = {}) {
  if (!input || typeof input !== "object") {
    throw new Error("action declaration input must be an object");
  }
  return {
    kind: ACTION_DECLARATION_KIND,
    actionId: normalizeToken(input.actionId || input.id, createRandomId("action")),
    actionKind: normalizeToken(input.actionKind, "candidate-happening"),
    subjectRef: createActionSubject(input.subjectRef || input.subject || {}),
    label: String(input.label || input.actionId || input.id || "Action"),
    source: createActionSource(input.source || {}),
    portability: assertKnown(input.portability, ACTION_PORTABILITY, "action portability", "candidate-material"),
    candidateHappeningIntent: createCandidateHappeningIntent(
      input.candidateHappeningIntent || { kind: input.actionKind }
    ),
    participationHints: input.participationHints && typeof input.participationHints === "object"
      ? cloneJson(input.participationHints)
      : {},
    constraints: (Array.isArray(input.constraints) ? input.constraints : []).map(createActionConstraint),
    nonClaims: mergeNonClaims(DEFAULT_ACTION_NON_CLAIMS, input.nonClaims || []),
  };
}

function createActionParticipation(input = {}) {
  const actionRef = input.actionRef || input.actionDeclaration || {};
  return {
    kind: ACTION_PARTICIPATION_KIND,
    actionRef: {
      kind: actionRef.kind || ACTION_DECLARATION_KIND,
      id: normalizeToken(actionRef.id || actionRef.actionId, "unknown-action"),
    },
    subjectRef: input.subjectRef ? createActionSubject(input.subjectRef) : null,
    scope: assertKnown(input.scope, ACTION_SCOPES, "action scope", "participation"),
    decision: assertKnown(input.decision, ACTION_PARTICIPATION_DECISIONS, "action participation decision", "candidate-only"),
    decisionNotes: ACTION_DECISION_NOTES,
    constraints: (Array.isArray(input.constraints) ? input.constraints : []).map(createActionConstraint),
    replacementActionRef: input.replacementActionRef
      ? {
          kind: input.replacementActionRef.kind || ACTION_DECLARATION_KIND,
          id: normalizeToken(input.replacementActionRef.id || input.replacementActionRef.actionId, "replacement-action"),
        }
      : null,
    reasons: uniqueStrings(input.reasons),
    nonClaims: mergeNonClaims(DEFAULT_ACTION_NON_CLAIMS, input.nonClaims || []),
  };
}

function createProjectedAffordance(input = {}) {
  const actionRef = input.actionRef || input.actionDeclaration || {};
  return {
    kind: PROJECTED_AFFORDANCE_KIND,
    affordanceId: normalizeToken(input.affordanceId || input.id, createRandomId("affordance")),
    actionRef: {
      kind: actionRef.kind || ACTION_DECLARATION_KIND,
      id: normalizeToken(actionRef.id || actionRef.actionId, "unknown-action"),
    },
    observerId: normalizeOptionalToken(input.observerId),
    seatRef: input.seatRef && typeof input.seatRef === "object" ? cloneJson(input.seatRef) : null,
    subjectRef: input.subjectRef ? createActionSubject(input.subjectRef) : null,
    visible: input.visible !== false,
    actable: input.actable === true,
    participationDecision: input.participationDecision
      ? assertKnown(input.participationDecision, ACTION_PARTICIPATION_DECISIONS, "action participation decision", "visible")
      : null,
    nonClaims: mergeNonClaims(DEFAULT_ACTION_NON_CLAIMS, input.nonClaims || [], [
      "projected affordance is not admission",
      "visible action is not permission",
    ]),
  };
}

function createActionInvocation(input = {}) {
  const actionRef = input.actionRef || input.actionDeclaration || {};
  return {
    kind: ACTION_INVOCATION_KIND,
    invocationId: normalizeToken(input.invocationId || input.id, createRandomId("invocation")),
    actionRef: {
      kind: actionRef.kind || ACTION_DECLARATION_KIND,
      id: normalizeToken(actionRef.id || actionRef.actionId, "unknown-action"),
    },
    actorObserverId: normalizeToken(input.actorObserverId, "unknown-actor"),
    seatRef: input.seatRef && typeof input.seatRef === "object" ? cloneJson(input.seatRef) : null,
    subjectRef: input.subjectRef ? createActionSubject(input.subjectRef) : null,
    input: input.input && typeof input.input === "object" ? cloneJson(input.input) : {},
    candidateHappeningIntent: createCandidateHappeningIntent(input.candidateHappeningIntent || {}),
    nonClaims: mergeNonClaims(DEFAULT_ACTION_NON_CLAIMS, input.nonClaims || [], [
      "action invocation creates proposal material only",
      "runtime must create candidate happenings separately",
    ]),
  };
}

function createActionReceipt(input = {}) {
  const participation = input.participation || null;
  return {
    kind: ACTION_RECEIPT_KIND,
    receiptId: normalizeToken(input.receiptId || input.id, createRandomId("action-receipt")),
    actionRef: input.actionRef
      ? {
          kind: input.actionRef.kind || ACTION_DECLARATION_KIND,
          id: normalizeToken(input.actionRef.id || input.actionRef.actionId, "unknown-action"),
        }
      : null,
    decision: assertKnown(
      input.decision || participation?.decision,
      ACTION_PARTICIPATION_DECISIONS,
      "action receipt decision",
      "candidate-only"
    ),
    participation: participation ? createActionParticipation(participation) : null,
    invocationRef: input.invocationRef ? cloneJson(input.invocationRef) : null,
    candidateHappeningIntent: input.candidateHappeningIntent
      ? createCandidateHappeningIntent(input.candidateHappeningIntent)
      : null,
    constraints: (Array.isArray(input.constraints) ? input.constraints : []).map(createActionConstraint),
    reasons: uniqueStrings(input.reasons),
    nonClaims: mergeNonClaims(DEFAULT_ACTION_NON_CLAIMS, input.nonClaims || []),
  };
}

module.exports = {
  ACTION_DECLARATION_KIND,
  ACTION_PARTICIPATION_KIND,
  PROJECTED_AFFORDANCE_KIND,
  ACTION_INVOCATION_KIND,
  ACTION_CONSTRAINT_KIND,
  ACTION_RECEIPT_KIND,
  CANDIDATE_HAPPENING_INTENT_KIND,
  ACTION_SOURCES,
  ACTION_PORTABILITY,
  ACTION_PARTICIPATION_DECISIONS,
  ACTION_REVIEW_DECISIONS,
  ACTION_SCOPES,
  ACTION_SUBJECT_KINDS,
  ACTION_DECISION_NOTES,
  DEFAULT_ACTION_NON_CLAIMS,
  createActionSubject,
  createActionDeclaration,
  createActionParticipation,
  createProjectedAffordance,
  createActionInvocation,
  createActionConstraint,
  createActionReceipt,
  createCandidateHappeningIntent,
};
