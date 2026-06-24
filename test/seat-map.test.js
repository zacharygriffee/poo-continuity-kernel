const test = require("node:test");
const assert = require("node:assert/strict");

const poo = require("../src");

const {
  createObserver,
  createContinuity,
  createHappening,
  appendAdmittedHappening,
  evaluateAdmittance,
} = poo.core;

const {
  admitRbcReferent,
  createRbcReferent,
  createRefereeBranch,
  getActiveRbcRules,
  evaluateHappeningAgainstRbc,
} = poo.rbc;

const {
  deriveActiveSeatContext,
  createSeatMapRulebook,
  inMap,
  BRANCH_TYPE,
  MAX_STEP,
  deriveSeatMapState,
} = poo.domains.seatMap;

const {
  admitSeatProjection,
} = poo.projection;

function withSeatBranchRbc() {
  const owner = createObserver({ id: "seat-owner", branchType: BRANCH_TYPE });
  const referee = createRefereeBranch(owner.id);
  const { branch: rbcBranch } = admitRbcReferent(
    referee,
    createRbcReferent({
      id: "rbc-seat",
      appliesToBranchType: BRANCH_TYPE,
      rule: {
        type: "max-step-per-action",
        value: MAX_STEP,
      },
    })
  );
  return { owner, rbcRules: getActiveRbcRules(rbcBranch, BRANCH_TYPE) };
}

function seatAwareState(continuity) {
  return deriveSeatMapState(continuity);
}

function originBootContinuity(owner) {
  let continuity = createContinuity(owner.id, owner.branchType);
  continuity = appendAdmittedHappening(
    continuity,
    createHappening({
      actorObserverId: owner.id,
      kind: "referent-created",
      referentId: "ref-seat-origin",
      ownerObserverId: owner.id,
      type: "seat",
      slot: "center",
      row: 6,
      sprite: "S",
      title: "origin seat",
      originHappeningId: null,
    })
  );
  continuity = appendAdmittedHappening(
    continuity,
    createHappening({
      actorObserverId: owner.id,
      kind: "seat-occupied",
      seatReferentId: "ref-seat-origin",
      sourceObserverId: owner.id,
    })
  );
  return continuity;
}

test("origin seat bootstraps only on empty continuity", () => {
  const owner = createObserver({ id: "seed-owner", branchType: BRANCH_TYPE });
  let continuity = createContinuity(owner.id, owner.branchType);
  continuity = originBootContinuity(owner);

  assert.equal(seatAwareState(continuity).seatBranchesById["ref-seat-origin"].id, "ref-seat-origin");
  assert.equal(seatAwareState(continuity).observerSeatByObserverId[owner.id].observerId, owner.id);
});

test("placing a second seat creates a distinct referent id", () => {
  const owner = createObserver({ id: "place-owner", branchType: BRANCH_TYPE });
  let continuity = originBootContinuity(owner);
  continuity = appendAdmittedHappening(
    continuity,
    createHappening({
      actorObserverId: owner.id,
      kind: "referent-created",
      referentId: "ref-seat-second",
      ownerObserverId: owner.id,
      type: "seat",
      slot: "center",
      row: 6,
      sprite: "S",
      title: "shared seat",
      throughSeatReferentId: "ref-seat-origin",
    })
  );

  const state = seatAwareState(continuity);
  assert.equal(state.referentsById["ref-seat-origin"].type, "seat");
  assert.equal(state.referentsById["ref-seat-second"].type, "seat");
  assert.notEqual("ref-seat-origin", "ref-seat-second");
});

test("B can occupy source seat and act through RBC-constrained seat movement", () => {
  const { owner, rbcRules } = withSeatBranchRbc();
  const rulebook = createSeatMapRulebook();
  let continuityA = originBootContinuity(owner);
  const projectionSeat = "ref-seat-join";
  continuityA = appendAdmittedHappening(
    continuityA,
    createHappening({
      actorObserverId: owner.id,
      kind: "referent-created",
      referentId: projectionSeat,
      ownerObserverId: owner.id,
      type: "seat",
      slot: "center",
      row: 5,
      sprite: "S",
      title: "shared by B",
      throughSeatReferentId: "ref-seat-origin",
      originHappeningId: continuityA.events[0].id,
    })
  );

  const observerB = createObserver({ id: "observer-b", branchType: BRANCH_TYPE });
  let continuityB = createContinuity(observerB.id, observerB.branchType);
  continuityB = admitSeatProjection({
    localContinuity: continuityB,
    actorObserverId: observerB.id,
    sourceObserverId: owner.id,
    sourceContinuity: continuityA,
    seatReferentId: projectionSeat,
  }).continuity;
  const stateB = deriveActiveSeatContext({
    observerId: observerB.id,
    localContinuity: continuityB,
    localState: seatAwareState(continuityB),
    projectionContinuityByObserver: {
      [owner.id]: continuityA,
    },
  });

  assert.equal(stateB.mode, "projection-only");
  assert.equal(stateB.sourceSeatReferentId, projectionSeat);

  const moveDecision = evaluateAdmittance({
    continuity: continuityB,
    happening: createHappening({
      actorObserverId: observerB.id,
      kind: "seat-position-changed",
      seatReferentId: projectionSeat,
      from: { slot: "center", row: 5 },
      to: { slot: "right", row: 5 },
    }),
    state: deriveSeatMapState(continuityB),
    rulebook: rulebook,
    evaluateRbc: evaluateHappeningAgainstRbc,
    activeRbcRules: rbcRules,
    context: {
      projectionContinuityByObserver: {
        [owner.id]: continuityA,
      },
    },
  });
  assert.equal(moveDecision.decision, "admitted");

  if (moveDecision.decision === "admitted") {
    continuityB = appendAdmittedHappening(
      continuityB,
      createHappening({
        actorObserverId: observerB.id,
        kind: "seat-position-changed",
        seatReferentId: projectionSeat,
        from: { slot: "center", row: 5 },
        to: { slot: "right", row: 5 },
      })
    );
  }

  assert.equal(deriveSeatMapState(continuityB).seatBranchesById[projectionSeat].slot, "right");
});

test("seat-position-changed in RBC with out-of-bounds is rejected", () => {
  const owner = createObserver({ id: "rbc-owner", branchType: BRANCH_TYPE });
  const { rbcRules } = withSeatBranchRbc();
  const rulebook = createSeatMapRulebook();
  let continuity = originBootContinuity(owner);
  const inState = deriveSeatMapState(continuity);
  assert.equal(inMap("center", 6), true);

  const badMove = createHappening({
    actorObserverId: owner.id,
    kind: "seat-position-changed",
    throughSeatReferentId: "ref-seat-origin",
    seatReferentId: "ref-seat-origin",
    from: { slot: "center", row: 6 },
    to: { slot: "left", row: -1 },
  });
  const decision = evaluateAdmittance({
    continuity,
    happening: badMove,
    state: inState,
    rulebook: rulebook,
    evaluateRbc: evaluateHappeningAgainstRbc,
    activeRbcRules: rbcRules,
  });

  assert.equal(decision.decision, "rejected");
});

test("v2 derive ignores legacy seat verbs", () => {
  const owner = createObserver({ id: "legacy-owner", branchType: BRANCH_TYPE });
  let continuity = createContinuity(owner.id, owner.branchType);
  continuity = appendAdmittedHappening(
    continuity,
    createHappening({
      actorObserverId: owner.id,
      kind: "referent-created",
      referentId: "legacy-seat",
      ownerObserverId: owner.id,
      type: "seat",
      slot: "center",
      row: 6,
      sprite: "S",
      title: "legacy seat",
    })
  );
  continuity = appendAdmittedHappening(
    continuity,
    createHappening({
      actorObserverId: owner.id,
      kind: "seat-claim",
      seatReferentId: "legacy-seat",
    })
  );
  const state = seatAwareState(continuity);
  assert.equal(state.seatBranchesById["legacy-seat"].id, "legacy-seat");
  assert.equal(state.observerSeatByObserverId[owner.id], undefined);
});
