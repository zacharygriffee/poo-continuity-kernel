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
  admitSeatProjection,
  admitExternalReferentClaim,
  realizeExternalReferent,
  validateProjection,
  rejectWriteThroughProjection,
} = poo.projection;

const { BRANCH_TYPE } = poo.domains.seatMap;
const { deriveSeatMapState } = poo.domains.seatMap;

test("projection admits shared seat context without mutating source continuity", () => {
  const source = createObserver({ id: "source", branchType: BRANCH_TYPE });
  const sourceContinuity = appendAdmittedHappening(
    createContinuity(source.id, source.branchType),
    createHappening({
      actorObserverId: source.id,
      kind: "referent-created",
      referentId: "ref-source-seat-1",
      type: "seat",
      ownerObserverId: source.id,
      slot: "center",
      row: 6,
      sprite: "S",
      title: "source seat",
    })
  );

  const projected = createObserver({ id: "proj", branchType: BRANCH_TYPE });
  let localContinuity = createContinuity(projected.id, projected.branchType);
  const sourceSnapshot = JSON.stringify(sourceContinuity);

  const projection = admitSeatProjection({
    localContinuity,
    actorObserverId: projected.id,
    sourceObserverId: source.id,
    sourceContinuity,
    seatReferentId: "ref-source-seat-1",
  });
  localContinuity = projection.continuity;

  assert.equal(projection.receipt.decision, "admitted");
  assert.equal(localContinuity.events.length, 1);
  assert.equal(sourceContinuity.events.length, 1);
  assert.equal(sourceSnapshot, JSON.stringify(sourceContinuity));
  assert.equal(validateProjection(localContinuity.events[0], sourceContinuity).valid, true);
});

test("projection admits external referent claim independently from realization", () => {
  const source = createObserver({ id: "source-claim", branchType: BRANCH_TYPE });
  const sourceContinuity = createContinuity(source.id, source.branchType);

  const target = createObserver({ id: "target-claim", branchType: BRANCH_TYPE });
  let targetContinuity = createContinuity(target.id, target.branchType);

  const claim = admitExternalReferentClaim({
    localContinuity: targetContinuity,
    actorObserverId: target.id,
    sourceObserverId: source.id,
    referentId: "ref-claim-target",
  });
  targetContinuity = claim.continuity;

  assert.equal(claim.receipt.decision, "admitted");
  assert.equal(targetContinuity.events.length, 1);
  assert.match(String(claim.receipt.reasons[0]), /external referent claim admitted/);
  assert.equal(
    claim.receipt.nonClaims.includes("claim admission does not prove the source referent exists"),
    true
  );
});

test("projection realizes external referent through source continuity and projection context", () => {
  const source = createObserver({ id: "source-2", branchType: BRANCH_TYPE });
  let sourceContinuity = createContinuity(source.id, source.branchType);
  sourceContinuity = appendAdmittedHappening(
    sourceContinuity,
    createHappening({
      actorObserverId: source.id,
      kind: "referent-created",
      referentId: "source-seat",
      ownerObserverId: source.id,
      type: "seat",
      slot: "center",
      row: 6,
      sprite: "S",
      title: "shared source seat",
      originHappeningId: null,
    })
  );
  sourceContinuity = appendAdmittedHappening(
    sourceContinuity,
    createHappening({
      actorObserverId: source.id,
      kind: "seat-occupied",
      seatReferentId: "source-seat",
      sourceObserverId: source.id,
    })
  );
  sourceContinuity = appendAdmittedHappening(
    sourceContinuity,
    createHappening({
      actorObserverId: source.id,
      kind: "referent-created",
      referentId: "source-note",
      ownerObserverId: source.id,
      type: "note",
      slot: "right",
      row: 6,
      sprite: "✉",
      title: "note",
    })
  );

  const target = createObserver({ id: "target-2", branchType: BRANCH_TYPE });
  let targetContinuity = createContinuity(target.id, target.branchType);
  const sourceProjection = admitSeatProjection({
    localContinuity: targetContinuity,
    actorObserverId: target.id,
    sourceObserverId: source.id,
    sourceContinuity,
    seatReferentId: "source-seat",
  });
  targetContinuity = sourceProjection.continuity;

  const realization = realizeExternalReferent({
    localContinuity: targetContinuity,
    actorObserverId: target.id,
    sourceObserverId: source.id,
    sourceContinuity,
    referentId: "source-note",
    projectionContinuityByObserver: {
      [source.id]: sourceContinuity,
    },
  });
  targetContinuity = realization.continuity;

  assert.equal(realization.receipt.decision, "admitted");
  assert.equal(targetContinuity.events.length, 2);
  assert.equal(targetContinuity.events[1].kind, "external-referent-admitted");

  const derive = deriveSeatMapState(targetContinuity);
  assert.equal(derive.admittedExternalReferents.length, 1);
});

test("realization without source continuity is rejected", () => {
  const source = createObserver({ id: "source-missing", branchType: BRANCH_TYPE });
  const target = createObserver({ id: "target-missing", branchType: BRANCH_TYPE });
  const targetContinuity = createContinuity(target.id, target.branchType);

  const rejected = realizeExternalReferent({
    localContinuity: targetContinuity,
    actorObserverId: target.id,
    sourceObserverId: source.id,
    sourceContinuity: null,
    referentId: "anything",
  });

  assert.equal(rejected.receipt.decision, "rejected");
  assert.match(String(rejected.receipt.reasons[0]), /source continuity is required/);
});

test("projection admission rejects non-seat-v2 source continuity", () => {
  const source = createObserver({ id: "number-source", branchType: "number-branch" });
  let sourceContinuity = createContinuity(source.id, source.branchType);
  sourceContinuity = appendAdmittedHappening(
    sourceContinuity,
    createHappening({ actorObserverId: source.id, kind: "number-delta", payload: { delta: 1 } })
  );

  const projected = createObserver({ id: "projection-proj", branchType: BRANCH_TYPE });
  let localContinuity = createContinuity(projected.id, projected.branchType);

  const admission = admitSeatProjection({
    localContinuity,
    actorObserverId: projected.id,
    sourceObserverId: source.id,
    sourceContinuity,
    seatReferentId: "ref-seat-1",
  });
  assert.equal(admission.receipt.decision, "rejected");
  assert.equal(admission.receipt.reasons[0], "source continuity is not seat-map v2 branch");
});

test("projection action remains read-only", () => {
  const rejectedWrite = rejectWriteThroughProjection("move", "actor-1");
  assert.equal(rejectedWrite.decision, "rejected");
  assert.match(String(rejectedWrite.reasons[0]), /read-only/);
});
