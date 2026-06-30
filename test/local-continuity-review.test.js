const test = require("node:test");
const assert = require("node:assert/strict");

const poo = require("../src");

function incomingSwordComposite() {
  return poo.branchComposites.createBranchCompositeManifest({
    compositeId: "incoming-sword-composite",
    subjectRef: {
      kind: "referent",
      id: "incoming-sword",
    },
    branches: [
      { branchId: "incoming-sword-identity", role: "identity", required: true },
      { branchId: "incoming-sword-form", role: "state" },
      { branchId: "incoming-sword-custody", role: "custody" },
      { branchId: "incoming-sword-renderer", role: "renderer" },
      { branchId: "incoming-sword-usage", role: "usage" },
      { branchId: "incoming-sword-rule-override", role: "rulebook" },
      { branchId: "incoming-sword-debug", role: "debug" },
    ],
  });
}

test("review receipt classifies candidate continuity without admitting it", () => {
  const composite = incomingSwordComposite();
  const receipt = poo.localReview.createContinuityReviewReceipt({
    receiptId: "review-sword-candidate",
    subjectRef: {
      kind: "branch-composite",
      id: composite.compositeId,
    },
    reviewer: {
      observerId: "observer-seat-1",
      systemId: "local-runtime",
    },
    scope: "join-local-continuity",
    decision: "candidate-only",
    reviewedEvidence: {
      branchComposites: [composite],
      causalHistoryRefs: ["head-a", "head-b"],
    },
  });

  assert.equal(receipt.kind, "local-continuity-review-receipt");
  assert.equal(receipt.decision, "candidate-only");
  assert.equal(receipt.subjectRef.id, "incoming-sword-composite");
  assert.equal(receipt.reviewedEvidence.branchComposites.length, 1);
  assert.equal(receipt.admittedBranches.length, 0);
  assert.equal(receipt.nonClaims.includes("review receipt does not admit continuity unless paired with local admission"), true);
});

test("review receipt records findings constraints evidence and non-claims", () => {
  const receipt = poo.localReview.createContinuityReviewReceipt({
    subjectRef: { kind: "branch-composite", id: "incoming-sword-composite" },
    decision: "sandbox",
    recommendation: "sandbox",
    reviewedEvidence: {
      branches: ["incoming-sword-renderer"],
      receipts: ["transport-receipt-1"],
    },
    findings: [
      {
        kind: "renderer-authority-leak",
        severity: "risk",
        riskClass: "renderer-risk",
        message: "Renderer branch presents view output as authority.",
        evidenceRefs: ["incoming-sword-renderer"],
      },
      {
        kind: "transport-source-mismatch",
        severity: "warning",
        riskClass: "transport-source",
        message: "Transport source does not match declared custody branch.",
        evidenceRefs: ["transport-receipt-1"],
      },
    ],
    constraints: [
      {
        kind: "sandbox-renderer-payload",
        reason: "renderer branch requires codec review before use",
        appliesToBranches: ["incoming-sword-renderer"],
      },
    ],
  });

  assert.equal(receipt.findings.length, 2);
  assert.equal(receipt.findings[0].kind, "renderer-authority-leak");
  assert.equal(receipt.findings[0].severity, "risk");
  assert.equal(receipt.constraints[0].kind, "sandbox-renderer-payload");
  assert.equal(receipt.constraints[0].appliesToBranches[0], "incoming-sword-renderer");
  assert.equal(receipt.nonClaims.includes("review receipt is not global proof authority"), true);
});

test("accept and admit are distinguishable review decisions", () => {
  const accepted = poo.localReview.createContinuityReviewReceipt({
    subjectRef: { kind: "branch-composite", id: "supporting-material" },
    decision: "accept",
    acceptedBranches: ["supporting-identity"],
  });
  const admitted = poo.localReview.createContinuityReviewReceipt({
    subjectRef: { kind: "branch-composite", id: "projection-material" },
    decision: "admit",
    admittedBranches: ["projection-identity"],
  });

  assert.equal(accepted.decision, "accept");
  assert.equal(admitted.decision, "admit");
  assert.equal(accepted.admittedBranches.length, 0);
  assert.deepEqual(admitted.admittedBranches, ["projection-identity"]);
  assert.match(accepted.decisionNotes.accept, /inspection, use, or supporting material/);
  assert.match(admitted.decisionNotes.admit, /paired with local admission/);
});

test("admit-with-constraints records constrained branch subsets independently", () => {
  const receipt = poo.localReview.createContinuityReviewReceipt({
    subjectRef: { kind: "branch-composite", id: "incoming-sword-composite" },
    scope: "admit-branch-composite",
    decision: "admit-with-constraints",
    recommendation: "admit-with-constraints",
    admittedBranches: [
      "incoming-sword-identity",
      "incoming-sword-form",
      "incoming-sword-custody",
    ],
    sandboxedBranches: ["incoming-sword-renderer"],
    deferredBranches: ["incoming-sword-usage"],
    rejectedBranches: ["incoming-sword-rule-override"],
    ignoredBranches: ["incoming-sword-debug"],
    constraints: [
      {
        kind: "sandbox-renderer-payload",
        reason: "renderer branch requires codec review before use",
        appliesToBranches: ["incoming-sword-renderer"],
      },
    ],
  });

  assert.equal(receipt.decision, "admit-with-constraints");
  assert.deepEqual(receipt.admittedBranches, [
    "incoming-sword-identity",
    "incoming-sword-form",
    "incoming-sword-custody",
  ]);
  assert.deepEqual(receipt.sandboxedBranches, ["incoming-sword-renderer"]);
  assert.deepEqual(receipt.deferredBranches, ["incoming-sword-usage"]);
  assert.deepEqual(receipt.rejectedBranches, ["incoming-sword-rule-override"]);
  assert.deepEqual(receipt.ignoredBranches, ["incoming-sword-debug"]);
  assert.equal(receipt.constraints.length, 1);
});

test("review receipt is not proof authority automatic merge transport admission or renderer authority", () => {
  const receipt = poo.localReview.createContinuityReviewReceipt({
    subjectRef: { kind: "renderer-view", id: "incoming-scene-renderer-view" },
    decision: "defer",
  });

  assert.equal(receipt.nonClaims.includes("review receipt is not global proof authority"), true);
  assert.equal(receipt.nonClaims.includes("review receipt does not perform automatic merge"), true);
  assert.equal(receipt.nonClaims.includes("local review is not transport admission"), true);
  assert.equal(receipt.nonClaims.includes("local review is not renderer authority"), true);
  assert.equal(receipt.nonClaims.includes("local review does not override RBC"), true);
});

test("review receipt describes projection delta without mutating projection", () => {
  const beforeProjection = {
    referents: ["local-player"],
    branches: ["local-player-identity"],
  };
  const snapshot = JSON.stringify(beforeProjection);
  const receipt = poo.localReview.createContinuityReviewReceipt({
    subjectRef: { kind: "branch-composite", id: "incoming-sword-composite" },
    decision: "defer",
    projectionDelta: {
      summary: "Incoming sword would add one item referent and one capability branch.",
      affectedReferents: ["incoming-sword"],
      affectedBranches: ["incoming-sword-identity", "incoming-sword-capability"],
      affectedCapabilities: ["cut"],
    },
  });

  assert.equal(receipt.projectionDelta.summary.includes("Incoming sword"), true);
  assert.deepEqual(receipt.projectionDelta.affectedReferents, ["incoming-sword"]);
  assert.equal(JSON.stringify(beforeProjection), snapshot);
  assert.equal(
    receipt.projectionDelta.nonClaims.includes("projection delta is review description only and does not mutate projection"),
    true
  );
});

test("local continuity review intent is separate from review receipt and agent runtime", () => {
  const review = poo.localReview.createLocalContinuityReview({
    reviewId: "review-intent-1",
    subjectRef: { kind: "continuity-package", id: "incoming-package" },
    reviewer: { observerId: "observer-seat-1", agentId: "review-agent-candidate" },
    scope: "import-candidate",
    rbcRef: "local-rbc-v1",
  });

  assert.equal(review.kind, "local-continuity-review");
  assert.equal(review.subjectRef.id, "incoming-package");
  assert.equal(review.reviewer.agentId, "review-agent-candidate");
  assert.equal(review.nonClaims.includes("local continuity review is not an agent runtime"), true);
});
