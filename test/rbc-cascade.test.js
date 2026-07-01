const test = require("node:test");
const assert = require("node:assert/strict");

const poo = require("../src");

test("RBC cascade evaluates a subject with multiple layers and preserves layer results", () => {
  const result = poo.rbcCascade.createRbcCascadeResult({
    subjectRef: { kind: "branch-composite", id: "incoming-sword-composite" },
    scope: "import",
    layerResults: [
      {
        layerId: "schema",
        decision: "accepted",
      },
      {
        layerId: "capability",
        decision: "deferred",
        findings: [
          {
            kind: "privileged-power",
            severity: "risk",
            message: "Capability branch introduces unsupported power.",
          },
        ],
      },
      {
        layerId: "renderer",
        decision: "sandboxed",
        findings: [
          {
            kind: "unbounded-codec",
            severity: "warning",
            message: "Renderer branch requires sandboxed codec handling.",
          },
        ],
        constraints: [
          {
            kind: "sandbox-renderer-codec",
            appliesTo: ["incoming-sword-renderer"],
          },
        ],
      },
    ],
  });

  assert.equal(result.kind, "rbc-cascade-result");
  assert.equal(result.finalDecision, "deferred");
  assert.deepEqual(result.layerResults.map((entry) => entry.layerId), ["schema", "capability", "renderer"]);
  assert.equal(result.findings.length, 2);
  assert.equal(result.constraints[0].kind, "sandbox-renderer-codec");
  assert.equal(result.nonClaims.includes("RBC cascade result is local participation policy"), true);
});

test("branch composite cascade can record different child branch decisions", () => {
  const result = poo.rbcCascade.createRbcCascadeResult({
    subjectRef: { kind: "branch-composite", id: "incoming-sword-composite" },
    scope: "admission",
    finalDecision: "admitted-with-constraints",
    childBranchDecisions: [
      { branchId: "identity", role: "identity", decision: "admitted" },
      { branchId: "context", role: "context", decision: "admitted" },
      { branchId: "renderer", role: "renderer", decision: "sandboxed" },
      { branchId: "usage", role: "usage", decision: "deferred" },
      { branchId: "debug", role: "debug", decision: "candidate-only" },
      { branchId: "rulebook-override", role: "rulebook", decision: "rejected" },
    ],
  });

  assert.equal(result.finalDecision, "admitted-with-constraints");
  assert.deepEqual(
    result.childBranchDecisions.map((entry) => [entry.branchId, entry.decision]),
    [
      ["identity", "admitted"],
      ["context", "admitted"],
      ["renderer", "sandboxed"],
      ["usage", "deferred"],
      ["debug", "candidate-only"],
      ["rulebook-override", "rejected"],
    ]
  );
});

test("imported subject can remain candidate-only because transport is not admission", () => {
  const result = poo.rbcCascade.createRbcCascadeResult({
    subjectRef: { kind: "transport-envelope", id: "package-transport-1" },
    scope: "transport",
    finalDecision: "candidate-only",
    layerResults: [
      {
        layerId: "transport-import",
        decision: "candidate-only",
        findings: [
          {
            kind: "transport-source-mismatch",
            severity: "warning",
            message: "Transport source is not local admission.",
          },
        ],
      },
    ],
  });

  assert.equal(result.finalDecision, "candidate-only");
  assert.equal(result.nonClaims.includes("RBC cascade result does not make transport/import truthful"), true);
  assert.equal(result.decisionNotes["candidate-only"], "preserved for review but not admitted");
});

test("renderer branch can be hidden or sandboxed without rejecting parent composite", () => {
  const result = poo.rbcCascade.createRbcCascadeResult({
    subjectRef: { kind: "branch-composite", id: "scene-composite" },
    scope: "render",
    finalDecision: "admitted-with-constraints",
    childBranchDecisions: [
      { branchId: "scene-identity", role: "identity", decision: "admitted" },
      { branchId: "scene-render-debug", role: "renderer", decision: "hidden" },
      { branchId: "scene-render-codec", role: "renderer", decision: "sandboxed" },
    ],
  });

  assert.equal(result.finalDecision, "admitted-with-constraints");
  assert.equal(result.childBranchDecisions.find((entry) => entry.branchId === "scene-render-debug").decision, "hidden");
  assert.equal(result.childBranchDecisions.find((entry) => entry.branchId === "scene-render-codec").decision, "sandboxed");
  assert.equal(result.decisionNotes.hidden, "not projected in this renderer/view");
  assert.equal(result.nonClaims.includes("RBC cascade result does not make renderer output authority"), true);
});

test("conflicting subject can require fork without implying merge", () => {
  const result = poo.rbcCascade.createRbcCascadeResult({
    subjectRef: { kind: "fork", id: "incoming-custody-head" },
    scope: "fork",
    layerResults: [
      {
        layerId: "custody",
        decision: "fork-required",
        findings: [
          {
            kind: "custody-conflict",
            severity: "risk",
            message: "Incoming branch conflicts with local custody head.",
          },
        ],
      },
    ],
  });

  assert.equal(result.finalDecision, "fork-required");
  assert.equal(result.findings[0].kind, "custody-conflict");
  assert.equal(result.decisionNotes["fork-required"], "cannot join current branch head without forking");
  assert.equal(result.nonClaims.includes("RBC cascade result does not perform automatic merge"), true);
});

test("RBC decisions are scoped for the same subject", () => {
  const subjectRef = { kind: "renderer-branch", id: "sprite-codec-v3" };
  const render = poo.rbcCascade.createRbcCascadeResult({
    subjectRef,
    scope: "render",
    finalDecision: "sandboxed",
  });
  const admission = poo.rbcCascade.createRbcCascadeResult({
    subjectRef,
    scope: "admission",
    finalDecision: "rejected",
  });

  assert.equal(render.finalDecision, "sandboxed");
  assert.equal(admission.finalDecision, "rejected");
  assert.equal(render.scope, "render");
  assert.equal(admission.scope, "admission");
});

test("RBC decision receipt preserves non-claims and layer evidence", () => {
  const result = poo.rbcCascade.createRbcCascadeResult({
    subjectRef: { kind: "branch", id: "incoming-branch" },
    scope: "review",
    layerResults: [
      {
        layerId: "operator-review",
        decision: "deferred",
        reasons: ["operator review required before participation"],
      },
    ],
  });
  const receipt = poo.rbcCascade.createRbcDecisionReceipt({
    ...result,
    receiptId: "rbc-receipt-1",
  });

  assert.equal(receipt.kind, "rbc-decision-receipt");
  assert.equal(receipt.decision, "deferred");
  assert.equal(receipt.layerResults[0].layerId, "operator-review");
  assert.equal(receipt.nonClaims.includes("RBC cascade result is not global proof authority"), true);
  assert.equal(receipt.nonClaims.includes("RBC cascade result is not global truth"), true);
  assert.equal(receipt.nonClaims.includes("RBC cascade result does not perform automatic merge"), true);
});
