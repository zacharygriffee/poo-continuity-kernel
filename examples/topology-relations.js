const poo = require("../src");

function descriptor(id, accepts = []) {
  return poo.rbcCompatibility.createRbcDescriptor({
    id,
    rules: [{ kind: "entry" }],
    compatibility: {
      accepts,
      compatibleRuleKinds: ["entry"],
    },
  });
}

function continuity(ownerObserverId) {
  return poo.core.appendAdmittedHappening(
    poo.core.createContinuity(ownerObserverId, "topology-example"),
    poo.core.createHappening({ actorObserverId: ownerObserverId, kind: "surface-created" })
  );
}

const town = continuity("town-observer");
const house = continuity("house-observer");

const portalBridge = poo.topology.createContinuityBridge({
  bridgeId: "closet-to-garage",
  endpoints: [
    { continuityId: "town", observerId: "town-observer", surfaceRef: "closet" },
    { continuityId: "house", observerId: "house-observer", surfaceRef: "garage" },
  ],
});

const bridgeResult = poo.topology.validateBridgeCandidate({
  bridge: portalBridge,
  continuities: [town, house],
  rbcDescriptors: [descriptor("town-rbc", ["house-rbc"]), descriptor("house-rbc", ["town-rbc"])],
});

const houseMount = poo.topology.createContinuityMount({
  mountId: "house-into-lot-7",
  parent: { continuityId: "town", observerId: "town-observer", surfaceRef: "lot-7" },
  child: { continuityId: "house", observerId: "house-observer", surfaceRef: "house-boundary" },
  conflictPolicy: { mode: "defer-on-conflict" },
});

const treeConflictRulebook = () => ({
  decision: "deferred",
  reasons: ["tree-22 overlaps house footprint"],
  conflictReport: poo.topology.createContinuityConflictReport({
    conflictSurface: "lot-7",
    claims: [
      { continuityId: "town", referent: "tree-22" },
      { continuityId: "house", referent: "house-footprint" },
    ],
  }),
});

const mountResult = poo.topology.validateMountCandidate({
  mount: houseMount,
  parentContinuity: town,
  childContinuity: house,
  rbcDescriptors: [descriptor("town-rbc", ["house-rbc"]), descriptor("house-rbc", ["town-rbc"])],
  rulebook: treeConflictRulebook,
});

const repoOverlap = poo.topology.detectContinuityOverlap({
  relation: { surfaceRef: "/plugins/pluginB" },
  continuities: [],
  rulebook: () => ({
    decision: "requires-resolution",
    conflictSurface: "/plugins/pluginB/index.js",
    claims: [
      { continuityId: "parent-repo", referent: "parent-file" },
      { continuityId: "plugin-repo", referent: "plugin-file" },
    ],
    reasons: ["both continuities claim the same file path"],
  }),
});

const videoOverlap = poo.topology.detectContinuityOverlap({
  relation: { surfaceRef: "timeline:00:10-00:20/layer:1" },
  continuities: [],
  rulebook: () => ({
    decision: "requires-resolution",
    conflictSurface: "timeline:00:10-00:20/layer:1",
    claims: [
      { continuityId: "main-video", referent: "existing-shot" },
      { continuityId: "clip", referent: "mounted-clip" },
    ],
    reasons: ["timeline layer is already occupied"],
  }),
});

console.log(JSON.stringify({
  portalBridge: bridgeResult.decision,
  townHouseMount: mountResult.decision,
  repoPluginOverlap: repoOverlap.conflict,
  videoClipOverlap: videoOverlap.conflict,
  doctrine: "examples delegate conflict semantics to rulebooks; no merge occurs",
}, null, 2));
