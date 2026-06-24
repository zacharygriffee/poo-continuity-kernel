const {
  createObserver,
  createContinuity,
  appendAdmittedHappening,
  createHappening,
  deriveSeatMapState,
  deriveActiveSeatContext,
  createSeatMapRulebook,
  evaluateAdmittance,
  BRANCH_TYPE,
  MAX_STEP,
  createRefereeBranch,
  createRbcReferent,
  admitRbcReferent,
  getActiveRbcRules,
  evaluateHappeningAgainstRbc,
  admitSeatProjection,
  admitExternalReferent,
  validateProjection,
  mapLineForState,
} = require("../../src");

const observerA = createObserver({ id: "observerA", branchType: BRANCH_TYPE });
const observerB = createObserver({ id: "observerB", branchType: BRANCH_TYPE });

function withSeatRbc(owner) {
  const referee = createRefereeBranch(owner.id);
  const { branch: admitted } = admitRbcReferent(
    referee,
    createRbcReferent({
      id: `rbc-${owner.id}-step`,
      appliesToBranchType: BRANCH_TYPE,
      rule: {
        type: "max-step-per-action",
        value: MAX_STEP,
      },
    })
  );
  return getActiveRbcRules(admitted, BRANCH_TYPE);
}

function seedSeatContinuityForObserver(observer, seatReferentId, slot = "center", row = 6) {
  let continuity = createContinuity(observer.id, observer.branchType);
  continuity = appendAdmittedHappening(
    continuity,
    createHappening({
      actorObserverId: observer.id,
      kind: "referent-created",
      referentId: seatReferentId,
      ownerObserverId: observer.id,
      type: "seat",
      slot,
      row,
      sprite: "S",
      title: `origin seat for ${observer.id}`,
    })
  );
  continuity = appendAdmittedHappening(
    continuity,
    createHappening({
      actorObserverId: observer.id,
      kind: "seat-occupied",
      seatReferentId,
      sourceObserverId: observer.id,
    })
  );
  return continuity;
}

function buildObserverAContinuity() {
  let continuityA = seedSeatContinuityForObserver(observerA, "ref-observerA-1");
  continuityA = appendAdmittedHappening(
    continuityA,
    createHappening({
      actorObserverId: observerA.id,
      kind: "referent-created",
      referentId: "ref-observerA-2",
      ownerObserverId: observerA.id,
      type: "seat",
      slot: "right",
      row: 6,
      sprite: "S",
      title: "shared seat for observer B",
      throughSeatReferentId: "ref-observerA-1",
      originHappeningId: continuityA.events[0].id,
    })
  );
  continuityA = appendAdmittedHappening(
    continuityA,
    createHappening({
      actorObserverId: observerA.id,
      kind: "referent-created",
      referentId: "ref-observerA-note-1",
      ownerObserverId: observerA.id,
      type: "note",
      slot: "center",
      row: 6,
      sprite: "✉",
      title: "anchor note",
      throughSeatReferentId: "ref-observerA-1",
    })
  );

  return continuityA;
}

function showMap(label, continuity) {
  const state = deriveSeatMapState(continuity);
  console.log(`\n${label}`);
  console.log(mapLineForState(state, { height: 8 }));
}

function demo() {
  const continuityA = buildObserverAContinuity();
  let continuityB = createContinuity(observerB.id, observerB.branchType);
  const rulesA = withSeatRbc(observerA);
  const rulebookA = createSeatMapRulebook();

  showMap("Observer A", continuityA);

  const projection = admitSeatProjection(continuityB, observerA.id, "ref-observerA-2", observerB.id, continuityA);
  continuityB = projection.continuity;
  console.log(`\nprojection for B: ${projection.receipt.decision}`);

  const contextB = deriveActiveSeatContext({
    observerId: observerB.id,
    localContinuity: continuityB,
    localState: deriveSeatMapState(continuityB),
    projectionContinuityByObserver: {
      [observerA.id]: continuityA,
    },
  });
  console.log(`\nB context mode: ${contextB.mode}`);

  const projectionValidation = validateProjection(continuityB.events[0], continuityA);
  console.log(`projection validation: ${projectionValidation.valid ? "ok" : "invalid"}`);

  const externalNote = admitExternalReferent(
    continuityB,
    observerA.id,
    "ref-observerA-note-1",
    observerB.id,
    continuityA,
    {
      projectionContinuityByObserver: {
        [observerA.id]: continuityA,
      },
    }
  );
  continuityB = externalNote.continuity;
  console.log(`\nB realize note: ${externalNote.receipt.decision}`);

  const noteMove = createHappening({
    actorObserverId: observerA.id,
    kind: "number-delta",
    payload: { delta: 1 },
  });
  const rbc = evaluateHappeningAgainstRbc(noteMove, rulesA, { branchType: BRANCH_TYPE, actorObserverId: observerA.id });
  console.log(`\nA number +1 admission without explicit rule: ${rbc.decision}`);

  const moveAttempt = createHappening({
    actorObserverId: observerA.id,
    kind: "seat-position-changed",
    seatReferentId: "ref-observerA-1",
    from: { slot: "center", row: 6 },
    to: { slot: "right", row: 6 },
  });
  const moveDecision = evaluateAdmittance({
    continuity: continuityA,
    happening: moveAttempt,
    state: deriveSeatMapState(continuityA),
    rulebook: rulebookA,
    evaluateRbc: evaluateHappeningAgainstRbc,
    activeRbcRules: rulesA,
  });
  console.log(`\nA seat move decision: ${moveDecision.decision}`);

  if (moveDecision.decision === "admitted") {
    continuityA = appendAdmittedHappening(continuityA, moveAttempt);
  }

  showMap("Final Observer A", continuityA);
  showMap("Observer B", continuityB);

  return {
    continuityA,
    continuityB,
  };
}

if (require.main === module) {
  demo();
}

module.exports = { demo };
