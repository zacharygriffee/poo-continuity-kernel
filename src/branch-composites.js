const { createRandomId } = require("./ids");

const BRANCH_COMPOSITE_KIND = "continuity-branch-composite";
const BRANCH_DESCRIPTOR_KIND = "continuity-branch-descriptor";
const BRANCH_COMPOSITE_POLICY_KIND = "continuity-branch-composite-policy";
const RULEBOOK_CASCADE_DECISION_KIND = "rulebook-cascade-decision";
const BRANCH_COMPOSITE_RECEIPT_KIND = "branch-composite-receipt";
const PROJECTION_BASIS_KIND = "projection-basis";
const BRANCH_CLOSURE_KIND = "branch-closure";

const KNOWN_BRANCH_ROLES = Object.freeze([
  "identity",
  "context",
  "trait",
  "state",
  "capability",
  "custody",
  "ownership",
  "provenance",
  "receipt",
  "renderer",
  "art-source",
  "usage",
  "metric",
  "debug",
  "fork-lineage",
  "rulebook",
  "rbc",
  "scenario",
  "projection",
  "summary",
  "checkpoint",
  "candidate",
  "conflict",
]);

const KNOWN_BRANCH_SCOPES = Object.freeze([
  "referent",
  "observer-seat",
  "item",
  "place",
  "file",
  "artifact",
  "renderer-view",
  "scenario",
  "domain",
  "project",
  "production",
  "debug",
  "import-candidate",
  "transport",
]);

const BRANCH_CLASSIFICATIONS = Object.freeze([
  "required",
  "admitted",
  "permitted",
  "ignored",
  "rejected",
  "deferred",
  "summarized",
  "candidate-only",
]);

const BRANCH_CLOSURE_OPERATIONS = Object.freeze([
  "transfer",
  "render",
  "inspect",
  "debug",
  "fork",
  "summarize",
  "import",
  "mount",
  "admit",
]);

const DEFAULT_BRANCH_COMPOSITE_NON_CLAIMS = Object.freeze([
  "branch composite is not admission until accepted by local rule/RBC",
  "branch composite is not a universal log",
  "unsupported branches may remain candidate material",
  "transported branch material is not admission",
  "stored branch material is not admission",
  "renderer support is not admission",
  "import is not merge",
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

function assertClassification(classification) {
  const normalized = normalizeToken(classification, "candidate-only");
  if (!BRANCH_CLASSIFICATIONS.includes(normalized)) {
    throw new Error(`unsupported branch classification ${normalized}`);
  }
  return normalized;
}

function setContains(values, value) {
  return values.includes(String(value || "").trim());
}

function createSubjectRef(input = {}) {
  if (!input || typeof input !== "object") {
    throw new Error("subjectRef must be an object");
  }
  return {
    kind: normalizeToken(input.kind, "referent"),
    id: normalizeToken(input.id, "unknown-subject"),
  };
}

function createBranchDescriptor(input = {}) {
  if (!input || typeof input !== "object") {
    throw new Error("branch descriptor input must be an object");
  }
  return {
    kind: BRANCH_DESCRIPTOR_KIND,
    branchId: normalizeToken(input.branchId || input.id, createRandomId("branch")),
    role: normalizeToken(input.role, "candidate"),
    scope: normalizeOptionalToken(input.scope),
    headRef: input.headRef == null ? null : String(input.headRef),
    required: input.required === true,
    continuityId: normalizeOptionalToken(input.continuityId),
    ownerObserverId: normalizeOptionalToken(input.ownerObserverId),
    branchType: normalizeOptionalToken(input.branchType),
    inheritedFromBranchId: normalizeOptionalToken(input.inheritedFromBranchId),
    forkedFromBranchId: normalizeOptionalToken(input.forkedFromBranchId),
    subjectRef: input.subjectRef ? createSubjectRef(input.subjectRef) : null,
    nonClaims: mergeNonClaims(input.nonClaims || []),
    meta: input.meta && typeof input.meta === "object" ? cloneJson(input.meta) : {},
  };
}

function createBranchCompositePolicy(input = {}) {
  const defaultClassification = assertClassification(input.defaultClassification || "candidate-only");
  return {
    kind: BRANCH_COMPOSITE_POLICY_KIND,
    operation: normalizeOptionalToken(input.operation),
    requiredRoles: uniqueStrings(input.requiredRoles),
    optionalRoles: uniqueStrings(input.optionalRoles),
    admittedRoles: uniqueStrings(input.admittedRoles),
    ignoredRoles: uniqueStrings(input.ignoredRoles),
    rejectedRoles: uniqueStrings(input.rejectedRoles),
    deferredRoles: uniqueStrings(input.deferredRoles),
    summarizedRoles: uniqueStrings(input.summarizedRoles),
    candidateOnlyRoles: uniqueStrings(input.candidateOnlyRoles),
    requiredBranches: uniqueStrings(input.requiredBranches),
    ignoredBranches: uniqueStrings(input.ignoredBranches),
    rejectedBranches: uniqueStrings(input.rejectedBranches),
    deferredBranches: uniqueStrings(input.deferredBranches),
    summarizedBranches: uniqueStrings(input.summarizedBranches),
    defaultClassification,
    nonClaims: mergeNonClaims(input.nonClaims || []),
  };
}

function classifyBranchForPolicy(branch, policy) {
  if (setContains(policy.rejectedBranches, branch.branchId) || setContains(policy.rejectedRoles, branch.role)) {
    return "rejected";
  }
  if (setContains(policy.deferredBranches, branch.branchId) || setContains(policy.deferredRoles, branch.role)) {
    return "deferred";
  }
  if (setContains(policy.ignoredBranches, branch.branchId) || setContains(policy.ignoredRoles, branch.role)) {
    return "ignored";
  }
  if (setContains(policy.summarizedBranches, branch.branchId) || setContains(policy.summarizedRoles, branch.role)) {
    return "summarized";
  }
  if (setContains(policy.admittedRoles, branch.role)) {
    return "admitted";
  }
  if (branch.required || setContains(policy.requiredBranches, branch.branchId) || setContains(policy.requiredRoles, branch.role)) {
    return "required";
  }
  if (setContains(policy.optionalRoles, branch.role)) {
    return "permitted";
  }
  if (setContains(policy.candidateOnlyRoles, branch.role)) {
    return "candidate-only";
  }
  return policy.defaultClassification;
}

function createBranchCompositeManifest(input = {}) {
  if (!input || typeof input !== "object") {
    throw new Error("branch composite manifest input must be an object");
  }
  const subjectRef = createSubjectRef(input.subjectRef || { kind: "referent", id: "unknown-subject" });
  const branches = (Array.isArray(input.branches) ? input.branches : []).map((branch) =>
    createBranchDescriptor({ subjectRef, scope: input.scope, ...branch })
  );
  const policy = createBranchCompositePolicy(input.policy || {});
  return {
    kind: BRANCH_COMPOSITE_KIND,
    compositeId: normalizeToken(input.compositeId || input.id, createRandomId("composite")),
    subjectRef,
    scope: normalizeToken(input.scope, "referent"),
    branches,
    policy,
    receipts: Array.isArray(input.receipts) ? input.receipts.map(cloneJson) : [],
    checkpoints: Array.isArray(input.checkpoints) ? input.checkpoints.map(cloneJson) : [],
    ancestry: input.ancestry && typeof input.ancestry === "object" ? cloneJson(input.ancestry) : null,
    nonClaims: mergeNonClaims(DEFAULT_BRANCH_COMPOSITE_NON_CLAIMS, input.nonClaims || []),
  };
}

function normalizeCascadeDecision(decision, fallbackClassification) {
  if (!decision || typeof decision !== "object") {
    return {
      classification: fallbackClassification,
      reasons: [],
      nonClaims: [],
    };
  }
  return {
    classification: assertClassification(decision.classification || decision.decision || fallbackClassification),
    reasons: uniqueStrings(decision.reasons || []),
    nonClaims: uniqueStrings(decision.nonClaims || []),
  };
}

function evaluateBranchCompositeCascade({
  manifest,
  policy,
  rulebook,
  context = {},
} = {}) {
  const normalizedManifest = createBranchCompositeManifest(manifest || {});
  const normalizedPolicy = createBranchCompositePolicy(policy || normalizedManifest.policy || {});
  const branchDecisions = normalizedManifest.branches.map((branch, index) => {
    const baseClassification = classifyBranchForPolicy(branch, normalizedPolicy);
    const override = typeof rulebook === "function"
      ? normalizeCascadeDecision(
          rulebook(branch, {
            manifest: normalizedManifest,
            policy: normalizedPolicy,
            baseClassification,
            branchIndex: index,
            context,
          }),
          baseClassification
        )
      : normalizeCascadeDecision(null, baseClassification);
    return {
      branchId: branch.branchId,
      role: branch.role,
      scope: branch.scope || normalizedManifest.scope,
      classification: override.classification,
      reasons: override.reasons.length > 0 ? override.reasons : [`branch classified as ${override.classification}`],
      nonClaims: mergeNonClaims(branch.nonClaims, override.nonClaims),
    };
  });

  return {
    kind: RULEBOOK_CASCADE_DECISION_KIND,
    compositeId: normalizedManifest.compositeId,
    subjectRef: normalizedManifest.subjectRef,
    scope: normalizedManifest.scope,
    branchDecisions,
    nonClaims: mergeNonClaims(normalizedManifest.nonClaims, normalizedPolicy.nonClaims, [
      "rulebook cascade classifies candidate branch material without mutating continuity",
      "projection uses admitted relevant branches, not all available branches",
    ]),
  };
}

function overallClassification(branchDecisions) {
  const classifications = branchDecisions.map((entry) => entry.classification);
  if (classifications.includes("rejected")) return "rejected";
  if (classifications.includes("deferred")) return "deferred";
  if (classifications.some((entry) => ["required", "admitted", "summarized"].includes(entry))) return "admitted";
  return "candidate-only";
}

function createBranchCompositeReceipt({ manifest, cascadeDecision } = {}) {
  const normalizedManifest = createBranchCompositeManifest(manifest || {});
  const cascade = cascadeDecision || evaluateBranchCompositeCascade({ manifest: normalizedManifest });
  return {
    kind: BRANCH_COMPOSITE_RECEIPT_KIND,
    compositeId: normalizedManifest.compositeId,
    subjectRef: normalizedManifest.subjectRef,
    classification: overallClassification(cascade.branchDecisions || []),
    branchDecisions: (cascade.branchDecisions || []).map(cloneJson),
    nonClaims: mergeNonClaims(normalizedManifest.nonClaims, cascade.nonClaims || [], [
      "branch composite receipt is not canonical proof",
    ]),
  };
}

function createProjectionBasis({
  manifest,
  cascadeDecision,
  includeClassifications = ["required", "admitted", "summarized"],
} = {}) {
  const normalizedManifest = createBranchCompositeManifest(manifest || {});
  const cascade = cascadeDecision || evaluateBranchCompositeCascade({ manifest: normalizedManifest });
  const included = new Set(includeClassifications.map(assertClassification));
  const byId = new Map(normalizedManifest.branches.map((branch) => [branch.branchId, branch]));
  const branches = (cascade.branchDecisions || [])
    .filter((decision) => included.has(decision.classification))
    .map((decision) => ({
      ...cloneJson(byId.get(decision.branchId)),
      classification: decision.classification,
    }))
    .filter((branch) => branch && branch.branchId);

  return {
    kind: PROJECTION_BASIS_KIND,
    compositeId: normalizedManifest.compositeId,
    subjectRef: normalizedManifest.subjectRef,
    scope: normalizedManifest.scope,
    branches,
    nonClaims: mergeNonClaims(normalizedManifest.nonClaims, [
      "projection basis uses admitted relevant branches, not all available branches",
      "renderer branch material is not object authority",
    ]),
  };
}

function createBranchClosure({
  manifest,
  operation = "inspect",
  cascadeDecision,
} = {}) {
  const normalizedManifest = createBranchCompositeManifest(manifest || {});
  const cascade = cascadeDecision || evaluateBranchCompositeCascade({ manifest: normalizedManifest });
  const normalizedOperation = normalizeToken(operation, "inspect");
  const decisions = cascade.branchDecisions || [];
  const byRole = new Map(normalizedManifest.branches.map((branch) => [branch.role, branch]));
  const missingBranches = normalizedManifest.policy.requiredRoles
    .filter((role) => !byRole.has(role))
    .map((role) => ({ role, reason: "required role is missing from branch composite" }));

  function branchesFor(classifications) {
    const wanted = new Set(classifications);
    return decisions.filter((entry) => wanted.has(entry.classification)).map(cloneJson);
  }

  return {
    kind: BRANCH_CLOSURE_KIND,
    compositeId: normalizedManifest.compositeId,
    subjectRef: normalizedManifest.subjectRef,
    operation: normalizedOperation,
    requiredBranches: branchesFor(["required", "admitted"]),
    optionalBranches: branchesFor(["permitted", "candidate-only"]),
    missingBranches,
    ignoredBranches: branchesFor(["ignored"]),
    rejectedBranches: branchesFor(["rejected"]),
    deferredBranches: branchesFor(["deferred"]),
    summaryBranches: branchesFor(["summarized"]),
    checkpointBranches: normalizedManifest.branches
      .filter((branch) => branch.role === "checkpoint")
      .map((branch) => ({ branchId: branch.branchId, role: branch.role, headRef: branch.headRef })),
    nonClaims: mergeNonClaims(normalizedManifest.nonClaims, cascade.nonClaims || [], [
      "branch closure is scoped sufficiency, not infinite causal ancestry",
    ]),
  };
}

function createForkedBranchCompositeManifest({
  sourceManifest,
  compositeId,
  branchOverrides = [],
  nonClaims = [],
} = {}) {
  const source = createBranchCompositeManifest(sourceManifest || {});
  const overrides = Array.isArray(branchOverrides) ? branchOverrides : [];
  const used = new Set();
  const branches = source.branches.map((branch) => {
    const override = overrides.find((entry) =>
      entry && (entry.replacesBranchId === branch.branchId || entry.branchId === branch.branchId)
    );
    if (!override) {
      return {
        ...cloneJson(branch),
        inheritedFromBranchId: branch.branchId,
      };
    }
    used.add(override);
    return createBranchDescriptor({
      ...branch,
      ...override,
      branchId: override.branchId || createRandomId("branch"),
      forkedFromBranchId: branch.branchId,
    });
  });

  for (const override of overrides) {
    if (!used.has(override)) {
      branches.push(createBranchDescriptor(override));
    }
  }

  return createBranchCompositeManifest({
    ...source,
    compositeId: compositeId || createRandomId("composite"),
    branches,
    ancestry: {
      sourceCompositeId: source.compositeId,
      inheritedAt: "local-fork",
    },
    nonClaims: mergeNonClaims(source.nonClaims, nonClaims, [
      "forked branch composite may share some branch heads and diverge on others",
      "fork is not merely a copy",
    ]),
  });
}

module.exports = {
  BRANCH_COMPOSITE_KIND,
  BRANCH_DESCRIPTOR_KIND,
  BRANCH_COMPOSITE_POLICY_KIND,
  RULEBOOK_CASCADE_DECISION_KIND,
  BRANCH_COMPOSITE_RECEIPT_KIND,
  PROJECTION_BASIS_KIND,
  BRANCH_CLOSURE_KIND,
  KNOWN_BRANCH_ROLES,
  KNOWN_BRANCH_SCOPES,
  BRANCH_CLASSIFICATIONS,
  BRANCH_CLOSURE_OPERATIONS,
  DEFAULT_BRANCH_COMPOSITE_NON_CLAIMS,
  createBranchDescriptor,
  createBranchCompositeManifest,
  createBranchCompositePolicy,
  evaluateBranchCompositeCascade,
  createBranchCompositeReceipt,
  createProjectionBasis,
  createBranchClosure,
  createForkedBranchCompositeManifest,
};
