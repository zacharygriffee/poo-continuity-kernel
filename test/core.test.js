const test = require("node:test");
const assert = require("node:assert/strict");

const poo = require("../src");

const {
  createObserver,
  createContinuity,
  createHappening,
  appendAdmittedHappening,
  deriveState,
  evaluateAdmittance,
  nextReferentId,
} = poo.core;

const {
  createReferent,
} = poo.core;

const {
  createRbcReferent,
  createRefereeBranch,
  admitRbcReferent,
  getActiveRbcRules,
  evaluateHappeningAgainstRbc,
} = poo.rbc;

function numberReducer(state, event) {
  if (event.kind === "number-delta") {
    return {
      value: state.value + Number(event.payload.delta || 0),
    };
  }
  return state;
}

function buildAccepted(continuity, happening) {
  return appendAdmittedHappening(continuity, happening);
}

test("public API is namespaced", () => {
  assert.ok(poo.core.createContinuity);
  assert.ok(poo.rbc.createRbcReferent);
  assert.ok(poo.projection.admitSeatProjection);
  assert.ok(poo.domains.seatMap.deriveSeatMapState);
  assert.ok(poo.segments.createSegmentCompatibilityPolicy);
  assert.ok(poo.rbcCompatibility.createRbcDescriptor);
  assert.ok(poo.topology.createContinuityBridge);
  assert.ok(poo.experimental.blends.createBlendCandidate);
  assert.equal(typeof poo.createSeatMapRulebook, "undefined");
  assert.equal(typeof poo.admitExternalReferent, "undefined");
  assert.equal(typeof poo.createContinuityBridge, "undefined");
  assert.equal(typeof poo.createBlendCandidate, "undefined");
});

test("continuity bootstrap and state derivation", () => {
  const obs = createObserver({ id: "obs-1", branchType: "number-branch" });
  const continuity = createContinuity(obs.id, obs.branchType);

  const delta = createHappening({
    actorObserverId: obs.id,
    kind: "number-delta",
    payload: { delta: 4 },
  });

  const next = buildAccepted(continuity, delta);
  const state = deriveState(next, numberReducer, { value: 0 });

  assert.equal(next.events.length, 1);
  assert.equal(state.value, 4);
});

test("evaluate admissibility default accepts valid event", () => {
  const obs = createObserver({ id: "obs-2", branchType: "number-branch" });
  const continuity = createContinuity(obs.id, obs.branchType);
  const decision = evaluateAdmittance({
    continuity,
    happening: createHappening({
      actorObserverId: obs.id,
      kind: "number-delta",
      payload: { delta: 4 },
    }),
    state: { value: 0 },
  });

  assert.equal(decision.decision, "admitted");
});

test("evaluateAdmittance can default to deferred", () => {
  const obs = createObserver({ id: "obs-deferred", branchType: "number-branch" });
  const continuity = createContinuity(obs.id, obs.branchType);
  const decision = evaluateAdmittance({
    continuity,
    happening: createHappening({
      actorObserverId: obs.id,
      kind: "number-delta",
      payload: { delta: 1 },
    }),
    state: { value: 0 },
    defaultDecision: "deferred",
  });

  assert.equal(decision.decision, "deferred");
});

test("admitted happen by RBC with deterministic IDs", () => {
  const obs = createObserver({ id: "obs-3", branchType: "number-branch" });
  const continuity = createContinuity(obs.id, obs.branchType);

  const referent = createReferent({
    id: nextReferentId(continuity),
    ownerObserverId: obs.id,
    type: "artifact",
    title: "sample",
  });

  const create = createHappening({
    actorObserverId: obs.id,
    kind: "referent-created",
    payload: referent,
  });

  const accepted = buildAccepted(continuity, create);
  assert.ok(accepted.events[0].id.startsWith(`h-${obs.id}-`));
  assert.equal(accepted.events[0].kind, "referent-created");
});

test("evaluateAdmittance rejects with no actor", () => {
  const obs = createObserver({ id: "obs-4", branchType: "number-branch" });
  const continuity = createContinuity(obs.id, obs.branchType);
  const bad = evaluateAdmittance({
    continuity,
    happening: { kind: "number-delta" },
    state: { value: 0 },
  });
  assert.equal(bad.decision, "rejected");
  assert.match(String(bad.reasons[0]), /actor/i);
});

test("RBC rejects bounded action without active RBC", () => {
  const obs = createObserver({ id: "obs-5", branchType: "number-branch" });
  const continuity = createContinuity(obs.id, obs.branchType);
  const delta = createHappening({
    actorObserverId: obs.id,
    kind: "number-delta",
    payload: { delta: 2 },
  });

  const decision = evaluateAdmittance({
    continuity,
    happening: delta,
    state: { value: 0 },
    evaluateRbc: evaluateHappeningAgainstRbc,
    activeRbcRules: [],
  });

  assert.equal(decision.decision, "rejected");
  assert.match(String(decision.reasons[0]), /No active RBC/);
});
