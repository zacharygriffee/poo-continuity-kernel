const test = require("node:test");
const assert = require("node:assert/strict");

const {
  createObserver,
  createContinuity,
  createHappening,
  appendAdmittedHappening,
  admitSeatProjection,
  admitExternalReferent,
  validateProjection,
  rejectWriteThroughProjection,
  BRANCH_TYPE,
  deriveSeatMapState,
} = require("../src");

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

  const projection = admitSeatProjection(
    localContinuity,
    source.id,
    "ref-source-seat-1",
    projected.id,
    sourceContinuity
  );
  localContinuity = projection.continuity;

  assert.equal(projection.receipt.decision, "admitted");
  assert.equal(localContinuity.events.length, 1);
  assert.equal(sourceContinuity.events.length, 1);
  assert.equal(sourceSnapshot, JSON.stringify(sourceContinuity));
  assert.equal(validateProjection(localContinuity.events[0], sourceContinuity).valid, true);
});

test("projection admits external referent and keeps projection non-authoritative", () => {
  const source = createObserver({ id: "source-2", branchType: BRANCH_TYPE });
  let sourceContinuity = createContinuity(source.id, source.branchType);
  sourceContinuity = appendAdmittedHappening(
    sourceContinuity,
    createHappening({
      actorObserverId: source.id,
      kind: "referent-created",
      referentId: "ref-source-note-1",
      ownerObserverId: source.id,
      type: "note",
      slot: "left",
      row: 4,
      sprite: "✉",
      title: "note",
    })
  );

  const target = createObserver({ id: "target-2", branchType: BRANCH_TYPE });
  let targetContinuity = createContinuity(target.id, target.branchType);
  targetContinuity = appendAdmittedHappening(
    targetContinuity,
    createHappening({
      actorObserverId: target.id,
      kind: "external-seat-projection-admitted",
      sourceObserverId: source.id,
      seatReferentId: "ref-source-seat-1",
      throughSeatReferentId: "ref-source-seat-1",
    })
  );

  const admit = admitExternalReferent(targetContinuity, source.id, "ref-source-note-1", target.id, sourceContinuity);
  targetContinuity = admit.continuity;

  assert.equal(admit.receipt.decision, "admitted");
  assert.equal(targetContinuity.events.length, 2);
  assert.equal(targetContinuity.events[1].kind, "external-referent-admitted");

  const derive = deriveSeatMapState(targetContinuity);
  assert.equal(derive.admittedExternalReferents.length, 1);

  const rejectedWrite = rejectWriteThroughProjection("move");
  assert.equal(rejectedWrite.decision, "rejected");
  assert.match(String(rejectedWrite.reasons[0]), /read-only/);
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

  const admission = admitSeatProjection(localContinuity, source.id, "ref-seat-1", projected.id, sourceContinuity);
  assert.equal(admission.receipt.decision, "rejected");
  assert.equal(admission.receipt.reasons[0], "source continuity is not seat-map v2 branch");
});
