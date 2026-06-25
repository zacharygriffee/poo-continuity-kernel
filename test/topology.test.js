const test = require("node:test");
const assert = require("node:assert/strict");

const poo = require("../src");

const {
  createContinuity,
  createHappening,
  appendAdmittedHappening,
} = poo.core;

function withEvent(ownerObserverId, branchType = "topology-test") {
  return appendAdmittedHappening(
    createContinuity(ownerObserverId, branchType),
    createHappening({ actorObserverId: ownerObserverId, kind: "surface-created", surfaceRef: `${ownerObserverId}-surface` })
  );
}

function descriptor(id, accepts = [], ruleKinds = ["entry"]) {
  return poo.rbcCompatibility.createRbcDescriptor({
    id,
    ownerObserverId: id,
    branchType: "topology-test",
    rules: ruleKinds.map((kind) => ({ kind })),
    compatibility: {
      accepts,
      compatibleRuleKinds: ruleKinds,
    },
  });
}

test("segment compatibility accepts full replay and bounded anchors", () => {
  const source = withEvent("seg-source");
  const full = poo.segments.validateSegmentCompatibility({
    sourceContinuity: source,
    policy: poo.segments.createSegmentCompatibilityPolicy({ mode: "full" }),
  });
  assert.equal(full.valid, true);

  const checkpoint = poo.checkpoints.createCheckpoint({
    ownerObserverId: source.ownerObserverId,
    segmentId: "seg-1",
    startIndex: 0,
    endIndex: 1,
  });
  const checkpointResult = poo.segments.validateSegmentCompatibility({
    sourceContinuity: source,
    policy: poo.segments.createSegmentCompatibilityPolicy({ mode: "checkpoint", acceptedAnchors: ["checkpoint"] }),
    checkpoint,
  });
  assert.equal(checkpointResult.valid, true);
  assert.equal(checkpointResult.nonClaims.includes("bounded compatibility is not full history proof"), true);

  const seed = poo.seeds.createContinuitySeed(source, 0, 1);
  const seedResult = poo.segments.validateSegmentCompatibility({
    sourceContinuity: source,
    policy: poo.segments.createSegmentCompatibilityPolicy({ mode: "seed", acceptedAnchors: ["seed"] }),
    seed,
  });
  assert.equal(seedResult.valid, true);
  assert.equal(seedResult.nonClaims.includes("bounded compatibility is not full history proof"), true);
});

test("segment compatibility rejects missing anchors and too-short bounded happenings", () => {
  const source = withEvent("seg-short");
  const missingCheckpoint = poo.segments.validateSegmentCompatibility({
    sourceContinuity: source,
    policy: { mode: "checkpoint", acceptedAnchors: ["checkpoint"] },
  });
  assert.equal(missingCheckpoint.valid, false);
  assert.match(missingCheckpoint.reasons[0], /checkpoint is required/);

  const short = poo.segments.validateSegmentCompatibility({
    sourceContinuity: source,
    policy: { mode: "happenings", maxHappenings: 2 },
  });
  assert.equal(short.valid, false);
  assert.match(short.reasons[0], /shorter/);
  assert.equal(short.nonClaims.includes("bounded compatibility is not full history proof"), true);
});

test("RBC compatibility supports exact, mutual, narrow, and incompatible decisions", () => {
  const exactA = descriptor("rbc-same", [], ["entry"]);
  const exactB = descriptor("rbc-same", [], ["entry"]);
  assert.equal(poo.rbcCompatibility.validateRbcCompatibility({ descriptors: [exactA, exactB] }).decision, "exact");

  const mutualA = descriptor("rbc-a", ["rbc-b"], ["entry"]);
  const mutualB = descriptor("rbc-b", ["rbc-a"], ["entry"]);
  assert.equal(poo.rbcCompatibility.validateRbcCompatibility({ descriptors: [mutualA, mutualB] }).decision, "compatible");

  const narrowA = descriptor("rbc-narrow-a", [], ["read"]);
  const narrowB = descriptor("rbc-narrow-b", [], ["read"]);
  assert.equal(
    poo.rbcCompatibility.validateRbcCompatibility({
      descriptors: [narrowA, narrowB],
      requiredRuleKinds: ["read"],
      operationKind: "bridge",
    }).decision,
    "narrow-compatible"
  );
  assert.equal(
    poo.rbcCompatibility.validateRbcCompatibility({ descriptors: [narrowA, descriptor("other", [], ["write"])] }).decision,
    "incompatible"
  );
  assert.equal(
    poo.rbcCompatibility.validateRbcCompatibility({ descriptors: [] }).nonClaims.includes("RBC compatibility does not prove global truth"),
    true
  );
  const malformed = poo.rbcCompatibility.validateRbcCompatibility({
    descriptors: [{ rules: [{ kind: "entry" }] }, descriptor("valid")],
  });
  assert.equal(malformed.decision, "incompatible");
  assert.match(malformed.reasons[0], /id is required/);
});

test("bridge candidate validates endpoints, RBC, rulebook, and admits locally without merge", () => {
  const continuityA = withEvent("bridge-a");
  const continuityB = withEvent("bridge-b");
  const snapshotB = JSON.stringify(continuityB);
  const bridge = poo.topology.createContinuityBridge({
    bridgeId: "bridge-1",
    endpoints: [
      { continuityId: "townA", observerId: "bridge-a", surfaceRef: "closet-portal" },
      { continuityId: "townB", observerId: "bridge-b", surfaceRef: "garage-portal" },
    ],
  });
  const validation = poo.topology.validateBridgeCandidate({
    bridge,
    continuities: [continuityA, continuityB],
    rbcDescriptors: [descriptor("bridge-a-rbc", ["bridge-b-rbc"]), descriptor("bridge-b-rbc", ["bridge-a-rbc"])],
  });
  assert.equal(validation.valid, true);
  assert.equal(validation.nonClaims.includes("bridge does not merge continuities"), true);

  const admitted = poo.topology.admitContinuityBridge(continuityA, bridge);
  assert.equal(admitted.receipt.decision, "admitted");
  assert.equal(admitted.continuity.events.length, continuityA.events.length + 1);
  assert.equal(admitted.continuity.events.at(-1).kind, "continuity-bridge-admitted");
  assert.equal(JSON.stringify(continuityB), snapshotB);

  const oneEndpoint = poo.topology.createContinuityBridge({
    endpoints: [{ continuityId: "only", observerId: "bridge-a", surfaceRef: "surface" }],
  });
  assert.equal(poo.topology.validateBridgeCandidate({ bridge: oneEndpoint }).valid, false);

  const rejected = poo.topology.validateBridgeCandidate({
    bridge,
    rbcDescriptors: [descriptor("x", [], ["entry"]), descriptor("y", [], ["write"])],
  });
  assert.equal(rejected.decision, "rejected");

  const ruleRejected = poo.topology.validateBridgeCandidate({
    bridge,
    rbcDescriptors: [descriptor("bridge-a-rbc", ["bridge-b-rbc"]), descriptor("bridge-b-rbc", ["bridge-a-rbc"])],
    rulebook: () => ({ decision: "rejected", reasons: ["endpoint already claimed"] }),
  });
  assert.equal(ruleRejected.decision, "rejected");
  assert.equal(ruleRejected.reasons[0], "endpoint already claimed");
});

test("mount validates parent child surfaces and delegates conflicts", () => {
  const parent = withEvent("mount-parent");
  const child = withEvent("mount-child");
  const childSnapshot = JSON.stringify(child);
  const mount = poo.topology.createContinuityMount({
    mountId: "mount-1",
    parent: { continuityId: "townA", observerId: "mount-parent", surfaceRef: "lot-7" },
    child: { continuityId: "houseB", observerId: "mount-child", surfaceRef: "house-boundary" },
    entrySurfaces: [{ parentRef: "lot-7-front-walk", childRef: "front-door" }],
  });
  const rbcDescriptors = [descriptor("mount-a", ["mount-b"]), descriptor("mount-b", ["mount-a"])];

  assert.equal(poo.topology.validateMountCandidate({ mount, parentContinuity: parent, childContinuity: child, rbcDescriptors }).valid, true);

  const conflictReport = poo.topology.createContinuityConflictReport({
    conflictSurface: "lot-7",
    claims: [
      { continuityId: "townA", referent: "tree-22" },
      { continuityId: "houseB", referent: "house-footprint" },
    ],
    decision: "rejected",
    reasons: ["tree overlaps house footprint"],
  });
  const rejected = poo.topology.validateMountCandidate({
    mount,
    parentContinuity: parent,
    childContinuity: child,
    rbcDescriptors,
    rulebook: () => ({ decision: "rejected", reasons: conflictReport.reasons, conflictReport }),
  });
  assert.equal(rejected.decision, "rejected");
  assert.equal(rejected.conflictReport.conflictSurface, "lot-7");

  const deferredMount = poo.topology.createContinuityMount({
    mountId: "mount-defer",
    parent: { continuityId: "townA", observerId: "mount-parent", surfaceRef: "lot-7" },
    child: { continuityId: "houseB", observerId: "mount-child", surfaceRef: "house-boundary" },
    conflictPolicy: { mode: "defer-on-conflict" },
  });
  const deferred = poo.topology.validateMountCandidate({
    mount: deferredMount,
    parentContinuity: parent,
    childContinuity: child,
    rbcDescriptors,
    rulebook: () => ({ decision: "deferred", reasons: ["requires arborist review"], conflictReport }),
  });
  assert.equal(deferred.decision, "deferred");

  const rejectByDefault = poo.topology.validateMountCandidate({
    mount,
    parentContinuity: parent,
    childContinuity: child,
    rbcDescriptors,
    rulebook: () => ({ decision: "deferred", reasons: ["conflict requires review"], conflictReport }),
  });
  assert.equal(rejectByDefault.decision, "rejected");

  const admitted = poo.topology.admitContinuityMount(parent, mount);
  assert.equal(admitted.continuity.events.at(-1).kind, "continuity-mount-admitted");
  assert.equal(admitted.continuity.events.length, parent.events.length + 1);
  assert.equal(JSON.stringify(child), childSnapshot);
});

test("overlap reports are normalized and non-mutating", () => {
  const relation = { surfaceRef: "/plugins/pluginB" };
  const none = poo.topology.detectContinuityOverlap({
    relation,
    continuities: [],
    rulebook: () => ({ decision: "admitted", reasons: ["no path overlap"] }),
  });
  assert.equal(none.conflict, false);

  const overlap = poo.topology.detectContinuityOverlap({
    relation,
    continuities: [],
    rulebook: () => ({
      decision: "requires-resolution",
      conflictSurface: "/plugins/pluginB/index.js",
      claims: [
        { continuityId: "repo", referent: "parent-file" },
        { continuityId: "plugin", referent: "plugin-file" },
      ],
      reasons: ["both continuities claim the same path"],
    }),
  });
  assert.equal(overlap.conflict, true);
  assert.equal(overlap.report.nonClaims.includes("conflict report is not resolution"), true);
});

test("blend candidate is admitted locally without concatenating source histories", () => {
  const sourceA = withEvent("blend-a");
  const sourceB = withEvent("blend-b");
  const snapshotA = JSON.stringify(sourceA);
  const snapshotB = JSON.stringify(sourceB);
  const blend = poo.experimental.blends.createBlendCandidate({
    blendId: "blend-1",
    inputContinuities: [
      { continuityId: "A", ownerObserverId: "blend-a", fromIndex: 0, toIndex: 1 },
      { continuityId: "B", ownerObserverId: "blend-b", fromIndex: 0, toIndex: 1 },
    ],
  });
  const rbcDescriptors = [descriptor("blend-rbc-a", ["blend-rbc-b"]), descriptor("blend-rbc-b", ["blend-rbc-a"])];
  const validation = poo.experimental.blends.validateBlendCandidate({
    blendCandidate: blend,
    continuities: [sourceA, sourceB],
    rbcDescriptors,
  });
  assert.equal(validation.valid, true);
  assert.equal(validation.nonClaims.includes("blend candidate is not global truth"), true);
  assert.equal(validation.nonClaims.includes("blend does not prove causal history"), true);

  const local = createContinuity("blend-local", "topology-test");
  const admitted = poo.experimental.blends.admitBlendCandidate(local, blend);
  assert.equal(admitted.receipt.decision, "admitted");
  assert.equal(admitted.continuity.events.length, 1);
  assert.equal(admitted.continuity.events[0].kind, "blend-candidate-admitted");
  assert.equal(JSON.stringify(sourceA), snapshotA);
  assert.equal(JSON.stringify(sourceB), snapshotB);

  const conflicted = poo.experimental.blends.validateBlendCandidate({
    blendCandidate: poo.experimental.blends.createBlendCandidate({
      inputContinuities: blend.inputContinuities,
      conflicts: [poo.topology.createContinuityConflictReport({ conflictSurface: "timeline:5-10" })],
    }),
    rbcDescriptors,
  });
  assert.equal(conflicted.decision, "deferred");

  assert.equal(
    poo.experimental.blends.validateBlendCandidate({
      blendCandidate: blend,
      rbcDescriptors: [descriptor("blend-x", [], ["entry"]), descriptor("blend-y", [], ["write"])],
    }).decision,
    "rejected"
  );
});
