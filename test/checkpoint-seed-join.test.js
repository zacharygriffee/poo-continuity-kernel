const test = require("node:test");
const assert = require("node:assert/strict");

const poo = require("../src");

const {
  createObserver,
  createContinuity,
  createHappening,
  appendAdmittedHappening,
  deriveState,
} = poo.core;

const {
  createCheckpoint,
  admitCheckpoint,
  validateFromCheckpoint,
} = poo.checkpoints;

const {
  createContinuitySeed,
  admitContinuitySeed,
  validateTailFromSeed,
} = poo.seeds;

const {
  createJoinPoint,
  admitJoinPoint,
  validateJoinCandidate,
} = poo.joins;

function numberReducer(state, event) {
  if (event.kind !== "number-delta") return state;
  return {
    value: state.value + Number(event.payload.delta || 0),
  };
}

test("checkpoint lifecycle for bounded replay anchor", () => {
  const obs = createObserver({ id: "cp-obs", branchType: "number-branch" });
  let continuity = createContinuity(obs.id, obs.branchType);
  continuity = appendAdmittedHappening(
    continuity,
    createHappening({ actorObserverId: obs.id, kind: "number-delta", payload: { delta: 2 } })
  );
  continuity = appendAdmittedHappening(
    continuity,
    createHappening({ actorObserverId: obs.id, kind: "number-delta", payload: { delta: 3 } })
  );

  const checkpoint = createCheckpoint({
    ownerObserverId: obs.id,
    segmentId: "seg-0",
    startIndex: 0,
    endIndex: 2,
    endState: { value: 5 },
  });

  const admitted = admitCheckpoint(continuity, obs.id, checkpoint);
  const validation = validateFromCheckpoint(continuity, checkpoint);
  assert.equal(admitted.receipt.decision, "admitted");
  assert.equal(validation.valid, true);
});

test("seed validates source continuity tail", () => {
  const source = createObserver({ id: "seed-source", branchType: "number-branch" });
  let sourceContinuity = createContinuity(source.id, source.branchType);
  sourceContinuity = appendAdmittedHappening(
    sourceContinuity,
    createHappening({ actorObserverId: source.id, kind: "number-delta", payload: { delta: 2 } })
  );
  sourceContinuity = appendAdmittedHappening(
    sourceContinuity,
    createHappening({ actorObserverId: source.id, kind: "number-delta", payload: { delta: 3 } })
  );

  const target = createObserver({ id: "seed-target", branchType: "number-branch" });
  const targetContinuity = createContinuity(target.id, target.branchType);

  const seed = createContinuitySeed(sourceContinuity, 0, 2, {
    stateReducer: numberReducer,
    expectedState: deriveState(sourceContinuity, numberReducer, { value: 0 }),
  });
  const tail = validateTailFromSeed(targetContinuity, sourceContinuity, seed, {
    stateReducer: numberReducer,
    expectedTailState: deriveState(
      {
        ownerObserverId: source.id,
        events: sourceContinuity.events.slice(0, 2),
      },
      numberReducer,
      { value: 0 }
    ),
  });
  const admittedSeed = admitContinuitySeed(targetContinuity, source.id, seed);

  assert.equal(tail.valid, true);
  assert.equal(admittedSeed.receipt.decision, "admitted");
  assert.equal(seed.nonClaims.includes("seed fingerprint is not cryptographic integrity"), true);
});

test("join point can be admitted without history merge", () => {
  const owner = createObserver({ id: "join-owner", branchType: "number-branch" });
  let ownerContinuity = createContinuity(owner.id, owner.branchType);
  ownerContinuity = appendAdmittedHappening(
    ownerContinuity,
    createHappening({
      actorObserverId: owner.id,
      kind: "number-delta",
      payload: { delta: 1 },
    })
  );
  const anchorId = ownerContinuity.events[0].id;

  const joinPoint = createJoinPoint({
    ownerObserverId: owner.id,
    sourceObserverId: owner.id,
    sourceHappeningId: anchorId,
  });

  const host = createObserver({ id: "join-host", branchType: "number-branch" });
  let hostContinuity = createContinuity(host.id, host.branchType);
  const joinAdmitted = admitJoinPoint(hostContinuity, joinPoint, ownerContinuity, host.id);
  hostContinuity = joinAdmitted.continuity;
  const joinValidation = validateJoinCandidate(hostContinuity, ownerContinuity, joinPoint);

  assert.equal(joinAdmitted.receipt.decision, "admitted");
  assert.equal(joinValidation.valid, true);
  assert.equal(hostContinuity.events[0].kind, "join-point-admitted");
});

test("seed branchType mismatch is rejected in tail validation", () => {
  const sourceObserver = createObserver({ id: "source-seed", branchType: "number-branch" });
  let sourceContinuity = createContinuity(sourceObserver.id, sourceObserver.branchType);
  sourceContinuity = appendAdmittedHappening(
    sourceContinuity,
    createHappening({ actorObserverId: sourceObserver.id, kind: "number-delta", payload: { delta: 1 } })
  );

  const seed = createContinuitySeed(sourceContinuity, 0, 1);
  seed.branchType = "seat-dag-continuity-v2";

  const mismatch = validateTailFromSeed(
    createContinuity("seed-target", "number-branch"),
    sourceContinuity,
    seed
  );
  assert.equal(mismatch.valid, false);
  assert.equal(mismatch.reasons[0], "seed branchType does not match source continuity");
});
