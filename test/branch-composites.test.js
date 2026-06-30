const test = require("node:test");
const assert = require("node:assert/strict");

const poo = require("../src");

function swordManifest() {
  return poo.branchComposites.createBranchCompositeManifest({
    compositeId: "sword-001-composite",
    subjectRef: {
      kind: "referent",
      id: "sword-001",
    },
    scope: "referent",
    branches: [
      {
        branchId: "sword-001-identity",
        role: "identity",
        headRef: "h-identity-head",
        required: true,
      },
      {
        branchId: "sword-001-capability",
        role: "capability",
        headRef: "h-capability-head",
      },
      {
        branchId: "sword-001-renderer",
        role: "renderer",
        headRef: "h-renderer-head",
      },
      {
        branchId: "sword-001-debug",
        role: "debug",
        headRef: "h-debug-head",
      },
      {
        branchId: "sword-001-conflict",
        role: "conflict",
        headRef: "h-conflict-head",
      },
    ],
    policy: {
      requiredRoles: ["identity"],
      admittedRoles: ["capability"],
      optionalRoles: ["renderer"],
      ignoredRoles: ["debug"],
      deferredRoles: ["conflict"],
    },
  });
}

test("branch composite describes multiple scoped branches for one subject", () => {
  const manifest = swordManifest();

  assert.equal(poo.branchComposites.BRANCH_COMPOSITE_KIND, "continuity-branch-composite");
  assert.equal(manifest.kind, "continuity-branch-composite");
  assert.equal(manifest.subjectRef.id, "sword-001");
  assert.equal(manifest.scope, "referent");
  assert.deepEqual(
    manifest.branches.map((branch) => [branch.branchId, branch.role, branch.scope]),
    [
      ["sword-001-identity", "identity", "referent"],
      ["sword-001-capability", "capability", "referent"],
      ["sword-001-renderer", "renderer", "referent"],
      ["sword-001-debug", "debug", "referent"],
      ["sword-001-conflict", "conflict", "referent"],
    ]
  );
  assert.equal(poo.branchComposites.KNOWN_BRANCH_ROLES.includes("renderer"), true);
  assert.equal(poo.branchComposites.KNOWN_BRANCH_SCOPES.includes("renderer-view"), true);
});

test("rulebook cascade classifies branches by scope without admitting candidate material", () => {
  const manifest = swordManifest();
  const cascade = poo.branchComposites.evaluateBranchCompositeCascade({
    manifest,
    rulebook(branch, context) {
      if (context.baseClassification === "permitted" && branch.role === "renderer") {
        return {
          classification: "candidate-only",
          reasons: ["renderer available but not admitted for this observer"],
        };
      }
      return null;
    },
  });

  const classifications = Object.fromEntries(cascade.branchDecisions.map((entry) => [entry.role, entry.classification]));
  assert.equal(classifications.identity, "required");
  assert.equal(classifications.capability, "admitted");
  assert.equal(classifications.renderer, "candidate-only");
  assert.equal(classifications.debug, "ignored");
  assert.equal(classifications.conflict, "deferred");
  assert.equal(
    cascade.nonClaims.includes("rulebook cascade classifies candidate branch material without mutating continuity"),
    true
  );
});

test("projection basis references only admitted relevant branches", () => {
  const manifest = swordManifest();
  const cascade = poo.branchComposites.evaluateBranchCompositeCascade({ manifest });
  const basis = poo.branchComposites.createProjectionBasis({ manifest, cascadeDecision: cascade });

  assert.equal(basis.kind, "projection-basis");
  assert.deepEqual(
    basis.branches.map((branch) => branch.branchId),
    ["sword-001-identity", "sword-001-capability"]
  );
  assert.equal(basis.branches.some((branch) => branch.role === "renderer"), false);
  assert.equal(
    basis.nonClaims.includes("projection basis uses admitted relevant branches, not all available branches"),
    true
  );
});

test("branch closure reports scoped sufficiency without infinite ancestry", () => {
  const manifest = poo.branchComposites.createBranchCompositeManifest({
    compositeId: "sword-closure",
    subjectRef: { kind: "referent", id: "sword-closure" },
    branches: [
      { branchId: "identity", role: "identity", required: true },
      { branchId: "summary", role: "summary" },
      { branchId: "checkpoint", role: "checkpoint" },
      { branchId: "debug", role: "debug" },
    ],
    policy: {
      requiredRoles: ["identity", "capability"],
      summarizedRoles: ["summary"],
      ignoredRoles: ["debug"],
    },
  });
  const cascade = poo.branchComposites.evaluateBranchCompositeCascade({ manifest });
  const closure = poo.branchComposites.createBranchClosure({
    manifest,
    cascadeDecision: cascade,
    operation: "transfer",
  });

  assert.equal(closure.operation, "transfer");
  assert.deepEqual(closure.requiredBranches.map((branch) => branch.role), ["identity"]);
  assert.deepEqual(closure.summaryBranches.map((branch) => branch.role), ["summary"]);
  assert.deepEqual(closure.ignoredBranches.map((branch) => branch.role), ["debug"]);
  assert.deepEqual(closure.checkpointBranches.map((branch) => branch.role), ["checkpoint"]);
  assert.deepEqual(closure.missingBranches, [
    { role: "capability", reason: "required role is missing from branch composite" },
  ]);
  assert.equal(
    closure.nonClaims.includes("branch closure is scoped sufficiency, not infinite causal ancestry"),
    true
  );
});

test("forked composite shares inherited branches and diverges selected branch heads", () => {
  const source = swordManifest();
  const forked = poo.branchComposites.createForkedBranchCompositeManifest({
    sourceManifest: source,
    compositeId: "sword-001-fork",
    branchOverrides: [
      {
        replacesBranchId: "sword-001-capability",
        branchId: "sword-001-capability-forked",
        role: "capability",
        headRef: "h-capability-forked-head",
      },
    ],
  });

  const identity = forked.branches.find((branch) => branch.role === "identity");
  const capability = forked.branches.find((branch) => branch.role === "capability");

  assert.equal(forked.ancestry.sourceCompositeId, "sword-001-composite");
  assert.equal(identity.branchId, "sword-001-identity");
  assert.equal(identity.inheritedFromBranchId, "sword-001-identity");
  assert.equal(capability.branchId, "sword-001-capability-forked");
  assert.equal(capability.forkedFromBranchId, "sword-001-capability");
  assert.equal(capability.headRef, "h-capability-forked-head");
  assert.equal(forked.nonClaims.includes("fork is not merely a copy"), true);
});

test("branch composite receipt preserves non-claims against universal log semantics", () => {
  const manifest = swordManifest();
  const cascade = poo.branchComposites.evaluateBranchCompositeCascade({ manifest });
  const receipt = poo.branchComposites.createBranchCompositeReceipt({
    manifest,
    cascadeDecision: cascade,
  });

  assert.equal(receipt.kind, "branch-composite-receipt");
  assert.equal(receipt.classification, "deferred");
  assert.equal(receipt.nonClaims.includes("branch composite is not a universal log"), true);
  assert.equal(receipt.nonClaims.includes("import is not merge"), true);
  assert.equal(receipt.nonClaims.includes("renderer support is not admission"), true);
});
