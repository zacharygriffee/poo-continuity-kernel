const test = require("node:test");
const assert = require("node:assert/strict");

const poo = require("../src");

const {
  createObserver,
  createContinuity,
  createHappening,
  appendEvent,
  appendAdmittedHappening,
  deriveState,
  evaluateAdmittance,
  nextReferentId,
  createObserverId,
  nextHappeningId,
  validateReplay,
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

test("evaluateAdmittance returns normalized happening for raw append correlation", () => {
  const obs = createObserver({ id: "obs-raw", branchType: "number-branch" });
  const continuity = createContinuity(obs.id, obs.branchType);
  const receipt = evaluateAdmittance({
    continuity,
    happening: {
      actorObserverId: obs.id,
      kind: "number-delta",
      payload: { delta: 5 },
    },
    state: { value: 0 },
  });

  assert.equal(receipt.decision, "admitted");
  assert.equal(receipt.normalizedHappening.id, receipt.happeningId);
  assert.match(receipt.happeningId, /^h-[0-9a-f]{32}$/);

  const next = appendAdmittedHappening(continuity, receipt.normalizedHappening);
  assert.equal(next.events[0].id, receipt.happeningId);
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

test("evaluateAdmittance rulebook admission overrides deferred default fallback", () => {
  const obs = createObserver({ id: "obs-rulebook-admitted", branchType: "number-branch" });
  const continuity = createContinuity(obs.id, obs.branchType);
  const receipt = evaluateAdmittance({
    continuity,
    happening: {
      actorObserverId: obs.id,
      kind: "number-delta",
      payload: { delta: 1 },
    },
    state: { value: 0 },
    rulebook: () => ({ decision: "admitted", reasons: ["explicitly admitted by rulebook"] }),
    defaultDecision: "deferred",
  });

  assert.equal(receipt.decision, "admitted");
  assert.deepEqual(receipt.reasons, ["explicitly admitted by rulebook"]);
  assert.equal(receipt.normalizedHappening.id, receipt.happeningId);
});

test("generated ids are crypto-shaped and admission preserves proposed happening id", () => {
  const generatedObserver = createObserver({ branchType: "number-branch" });
  assert.match(generatedObserver.id, /^obs-[0-9a-f]{32}$/);
  assert.match(createObserverId(), /^obs-[0-9a-f]{32}$/);

  const obs = createObserver({ id: "obs-3", branchType: "number-branch" });
  const continuity = createContinuity(obs.id, obs.branchType);
  const referentId = nextReferentId();
  assert.match(referentId, /^ref-[0-9a-f]{32}$/);

  const referent = createReferent({
    id: referentId,
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
  assert.match(create.id, /^h-[0-9a-f]{32}$/);
  assert.equal(accepted.events[0].id, create.id);
  assert.equal(accepted.events[0].kind, "referent-created");
});

test("generated ids do not depend on continuity length or storage order", () => {
  const continuity = createContinuity("id-owner", "number-branch");
  const firstHappeningId = nextHappeningId(continuity);
  const next = appendAdmittedHappening(
    continuity,
    createHappening({
      actorObserverId: "id-owner",
      kind: "number-delta",
      payload: { delta: 1 },
    })
  );
  const secondHappeningId = nextHappeningId(next);
  const firstReferentId = nextReferentId(continuity);
  const secondReferentId = nextReferentId(next);

  assert.match(firstHappeningId, /^h-[0-9a-f]{32}$/);
  assert.match(secondHappeningId, /^h-[0-9a-f]{32}$/);
  assert.notEqual(firstHappeningId, secondHappeningId);
  assert.match(firstReferentId, /^ref-[0-9a-f]{32}$/);
  assert.match(secondReferentId, /^ref-[0-9a-f]{32}$/);
  assert.notEqual(firstReferentId, secondReferentId);
});

test("appendEvent rejects duplicate event ids", () => {
  const continuity = createContinuity("append-event-owner", "number-branch");
  const first = appendEvent(continuity, {
    id: "h-explicit-1",
    actorObserverId: "append-event-owner",
    kind: "number-delta",
    payload: { delta: 1 },
  });

  assert.throws(
    () =>
      appendEvent(first, {
        id: "h-explicit-1",
        actorObserverId: "append-event-owner",
        kind: "number-delta",
        payload: { delta: 2 },
      }),
    /duplicate happening id h-explicit-1/
  );
});

test("validateReplay supports strict and audit validation modes", () => {
  const continuity = createContinuity("replay-mode-owner", "number-branch");
  const accepted = appendAdmittedHappening(
    continuity,
    createHappening({
      actorObserverId: "replay-mode-owner",
      kind: "number-delta",
      payload: { delta: 1 },
    })
  );
  const withRejected = appendAdmittedHappening(
    accepted,
    createHappening({
      actorObserverId: "replay-mode-owner",
      kind: "number-delta",
      payload: { delta: 10 },
    })
  );
  const rulebook = (event) =>
    Number(event.payload?.delta || 0) > 5
      ? { decision: "rejected", reasons: ["delta too large"] }
      : { decision: "admitted" };

  const strict = validateReplay(withRejected, numberReducer, rulebook, { value: 0 });
  const audit = validateReplay(withRejected, numberReducer, rulebook, { value: 0 }, { validationMode: "audit" });

  assert.equal(strict.valid, false);
  assert.equal(strict.validationMode, "strict");
  assert.equal(strict.state.value, 1);
  assert.equal(audit.valid, false);
  assert.equal(audit.validationMode, "audit");
  assert.equal(audit.state.value, 11);
  assert.equal(audit.failures[0].reasons[0], "delta too large");
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
