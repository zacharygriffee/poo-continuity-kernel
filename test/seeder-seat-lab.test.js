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
} = poo.core;

const {
  createContinuitySeed,
  admitContinuitySeed,
  validateTailFromSeed,
} = poo.seeds;

const BRANCH_TYPE = "seeder-seat-lab-continuity";
const PLAYER_KINDS = new Set(["player-moved", "item-moved", "seat-occupied"]);
const SEEDER_KINDS = new Set(["seeder-liveness", "checkpoint-available", "heads-served"]);
const SEEDER_FORBIDDEN_KINDS = new Set(["player-moved", "item-moved", "admit-player-happening", "resolve-concurrent-heads"]);

function initialState() {
  return {
    seatsById: {},
    seatByObserverId: {},
    playerLocations: {},
    itemLocations: {},
    availability: {
      liveSeeders: [],
      checkpoints: [],
      servedHeads: [],
    },
    admittedPlayerFrontier: [],
  };
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function seederLabReducer(state, event) {
  const next = clone(state);

  if (event.kind === "seat-created") {
    next.seatsById[event.seatReferentId] = {
      seatReferentId: event.seatReferentId,
      role: event.role,
      label: event.label || event.seatReferentId,
    };
    return next;
  }

  if (event.kind === "seat-occupied") {
    next.seatByObserverId[event.actorObserverId] = {
      observerId: event.actorObserverId,
      seatReferentId: event.seatReferentId,
      role: next.seatsById[event.seatReferentId]?.role || "unknown",
    };
    next.admittedPlayerFrontier.push(event.id);
    return next;
  }

  if (event.kind === "player-moved") {
    next.playerLocations[event.actorObserverId] = event.payload.to;
    next.admittedPlayerFrontier.push(event.id);
    return next;
  }

  if (event.kind === "item-moved") {
    next.itemLocations[event.payload.itemId] = event.payload.to;
    next.admittedPlayerFrontier.push(event.id);
    return next;
  }

  if (event.kind === "seeder-liveness") {
    next.availability.liveSeeders.push({
      observerId: event.actorObserverId,
      seatReferentId: event.seatReferentId,
      happeningId: event.id,
    });
    return next;
  }

  if (event.kind === "checkpoint-available") {
    next.availability.checkpoints.push({
      observerId: event.actorObserverId,
      checkpointId: event.payload.checkpointId,
      headIds: event.payload.headIds || [],
      happeningId: event.id,
    });
    return next;
  }

  if (event.kind === "heads-served") {
    next.availability.servedHeads.push({
      observerId: event.actorObserverId,
      headIds: event.payload.headIds || [],
      happeningId: event.id,
    });
    return next;
  }

  return next;
}

function observerRole(state, observerId) {
  return state.seatByObserverId[observerId]?.role || "unknown";
}

function seederSeatRulebook(happening, state) {
  if (happening.kind === "seat-created") {
    return { decision: "admitted", reasons: ["seat creation is bootstrap material"] };
  }

  const role = observerRole(state, happening.actorObserverId);

  if (happening.kind === "seat-occupied") {
    const seat = state.seatsById[happening.seatReferentId];
    if (!seat) {
      return { decision: "rejected", reasons: ["seat must exist before occupation"] };
    }
    return { decision: "admitted", reasons: [`${seat.role} seat occupied`] };
  }

  if (role === "seeder") {
    if (SEEDER_KINDS.has(happening.kind)) {
      return { decision: "admitted", reasons: ["seeder availability evidence admitted"] };
    }
    if (SEEDER_FORBIDDEN_KINDS.has(happening.kind) || PLAYER_KINDS.has(happening.kind)) {
      return { decision: "rejected", reasons: ["seeder seat has availability authority only"] };
    }
  }

  if (SEEDER_KINDS.has(happening.kind)) {
    return { decision: "rejected", reasons: ["availability evidence requires seeder seat"] };
  }

  if (PLAYER_KINDS.has(happening.kind)) {
    if (role !== "player") {
      return { decision: "rejected", reasons: ["player happening requires player seat"] };
    }
    if (!Array.isArray(happening.payload.knownHeads)) {
      return { decision: "deferred", reasons: ["knownHeads basis is required"] };
    }
    return { decision: "admitted", reasons: ["player happening admitted from known heads"] };
  }

  return { decision: "deferred", reasons: ["lab rulebook does not classify happening"] };
}

function evaluateAndAppend(continuity, happening) {
  const state = deriveState(continuity, seederLabReducer, initialState());
  const receipt = evaluateAdmittance({
    continuity,
    happening,
    state,
    rulebook: seederSeatRulebook,
    defaultDecision: "deferred",
  });
  if (receipt.decision !== "admitted") {
    return { continuity, receipt };
  }
  return {
    continuity: appendAdmittedHappening(continuity, receipt.normalizedHappening),
    receipt,
  };
}

function appendOrThrow(continuity, happening) {
  const result = evaluateAndAppend(continuity, happening);
  assert.equal(result.receipt.decision, "admitted", result.receipt.reasons.join(", "));
  return result.continuity;
}

function happening(actorObserverId, kind, input = {}) {
  return createHappening({
    actorObserverId,
    kind,
    ...input,
    payload: input.payload || {},
  });
}

function bootstrapContinuity() {
  const observer1 = createObserver({ id: "observer-1", branchType: BRANCH_TYPE });
  const observer2 = createObserver({ id: "observer-2", branchType: BRANCH_TYPE });
  const seeder = createObserver({ id: "observer-seeder", branchType: BRANCH_TYPE });
  let continuity = createContinuity(observer1.id, observer1.branchType);

  continuity = appendOrThrow(
    continuity,
    happening(observer1.id, "seat-created", {
      seatReferentId: "seat-player-1",
      role: "player",
      label: "player 1",
    })
  );
  continuity = appendOrThrow(
    continuity,
    happening(observer1.id, "seat-created", {
      seatReferentId: "seat-player-2",
      role: "player",
      label: "player 2",
    })
  );
  continuity = appendOrThrow(
    continuity,
    happening(observer1.id, "seat-created", {
      seatReferentId: "seat-seeder-1",
      role: "seeder",
      label: "custodial seeder",
    })
  );
  continuity = appendOrThrow(
    continuity,
    happening(observer1.id, "seat-occupied", {
      seatReferentId: "seat-player-1",
      payload: { knownHeads: [] },
    })
  );
  continuity = appendOrThrow(
    continuity,
    happening(observer2.id, "seat-occupied", {
      seatReferentId: "seat-player-2",
      payload: { knownHeads: [headId(continuity)] },
    })
  );
  continuity = appendOrThrow(
    continuity,
    happening(seeder.id, "seat-occupied", {
      seatReferentId: "seat-seeder-1",
      payload: { knownHeads: [headId(continuity)] },
    })
  );

  return { observer1, observer2, seeder, continuity };
}

function headId(continuity) {
  return continuity.events.at(-1)?.id || null;
}

function appendPlayerMove(continuity, observer, to, knownHeads = [headId(continuity)]) {
  return appendOrThrow(
    continuity,
    happening(observer.id, "player-moved", {
      payload: { to, knownHeads },
    })
  );
}

function appendItemMove(continuity, observer, itemId, from, to, knownHeads = [headId(continuity)]) {
  return appendOrThrow(
    continuity,
    happening(observer.id, "item-moved", {
      payload: { itemId, from, to, knownHeads },
    })
  );
}

function branchEventsSince(baseContinuity, branchContinuity) {
  const baseIds = new Set(baseContinuity.events.map((event) => event.id));
  return branchContinuity.events.filter((event) => !baseIds.has(event.id));
}

function classifyConcurrentBranches(baseContinuity, leftContinuity, rightContinuity) {
  const leftEvents = branchEventsSince(baseContinuity, leftContinuity).filter((event) => PLAYER_KINDS.has(event.kind));
  const rightEvents = branchEventsSince(baseContinuity, rightContinuity).filter((event) => PLAYER_KINDS.has(event.kind));

  if (leftEvents.length === 0 || rightEvents.length === 0) {
    return {
      decision: "admitted",
      status: "no-concurrent-player-branches",
      mergePerformed: false,
      reasons: ["only one branch has player happenings"],
    };
  }

  const conflicts = [];
  for (const left of leftEvents) {
    for (const right of rightEvents) {
      if (
        left.kind === "item-moved" &&
        right.kind === "item-moved" &&
        left.payload.itemId === right.payload.itemId &&
        JSON.stringify(left.payload.from) === JSON.stringify(right.payload.from)
      ) {
        conflicts.push({
          itemId: left.payload.itemId,
          leftHappeningId: left.id,
          rightHappeningId: right.id,
          reason: "same referent moved from same stale basis",
        });
      }
    }
  }

  if (conflicts.length > 0) {
    return {
      decision: "deferred",
      status: "concurrent-heads-conflicting",
      mergePerformed: false,
      conflicts,
      reasons: ["conflicting concurrent heads require later reconciliation"],
    };
  }

  return {
    decision: "admitted",
    status: "concurrent-valid-heads",
    branchStatus: "divergent-valid",
    mergePerformed: false,
    reasons: ["concurrent heads are valid local branches, not an RBC failure"],
  };
}

test("seeder availability is admitted without world mutation", () => {
  const { seeder, continuity } = bootstrapContinuity();
  const before = deriveState(continuity, seederLabReducer, initialState());
  let next = appendOrThrow(
    continuity,
    happening(seeder.id, "seeder-liveness", {
      seatReferentId: "seat-seeder-1",
      payload: { headIds: [headId(continuity)] },
    })
  );
  next = appendOrThrow(
    next,
    happening(seeder.id, "checkpoint-available", {
      seatReferentId: "seat-seeder-1",
      payload: { checkpointId: "checkpoint-1", headIds: [headId(continuity)] },
    })
  );

  const after = deriveState(next, seederLabReducer, initialState());
  assert.deepEqual(after.playerLocations, before.playerLocations);
  assert.deepEqual(after.itemLocations, before.itemLocations);
  assert.equal(after.availability.liveSeeders.length, 1);
  assert.equal(after.availability.checkpoints.length, 1);
});

test("seeder cannot act as a player", () => {
  const { seeder, continuity } = bootstrapContinuity();
  const before = deriveState(continuity, seederLabReducer, initialState());
  const result = evaluateAndAppend(
    continuity,
    happening(seeder.id, "item-moved", {
      payload: {
        itemId: "item-key",
        from: "table",
        to: "pocket",
        knownHeads: [headId(continuity)],
      },
    })
  );
  const after = deriveState(result.continuity, seederLabReducer, initialState());

  assert.equal(result.receipt.decision, "rejected");
  assert.equal(result.receipt.reasons[0], "seeder seat has availability authority only");
  assert.equal(result.continuity.events.length, continuity.events.length);
  assert.deepEqual(after.itemLocations, before.itemLocations);
  assert.deepEqual(after.admittedPlayerFrontier, before.admittedPlayerFrontier);
});

test("seeder cannot admit or resolve reality", () => {
  const { seeder, continuity } = bootstrapContinuity();
  for (const kind of ["resolve-concurrent-heads", "admit-player-happening"]) {
    const result = evaluateAndAppend(
      continuity,
      happening(seeder.id, kind, {
        payload: { knownHeads: [headId(continuity)] },
      })
    );
    assert.equal(result.receipt.decision, "rejected");
    assert.equal(result.receipt.reasons[0], "seeder seat has availability authority only");
    assert.equal(result.continuity.events.length, continuity.events.length);
  }
});

test("seeder helps late join without gaining admission authority", () => {
  const { observer2, seeder, continuity } = bootstrapContinuity();
  let observer2Branch = appendPlayerMove(continuity, observer2, "north-room");
  const branchHead = headId(observer2Branch);
  observer2Branch = appendOrThrow(
    observer2Branch,
    happening(seeder.id, "heads-served", {
      seatReferentId: "seat-seeder-1",
      payload: { headIds: [branchHead], servedToObserverId: "observer-3" },
    })
  );

  const branchState = deriveState(observer2Branch, seederLabReducer, initialState());
  const lateJoiner = createObserver({ id: "observer-3", branchType: BRANCH_TYPE });
  let lateJoinerContinuity = createContinuity(lateJoiner.id, lateJoiner.branchType);
  const seed = createContinuitySeed(observer2Branch, 0, observer2Branch.events.length, {
    stateReducer: seederLabReducer,
    expectedState: branchState,
  });
  const validation = validateTailFromSeed(lateJoinerContinuity, observer2Branch, seed);
  const admitted = admitContinuitySeed(lateJoinerContinuity, observer2.id, seed);
  lateJoinerContinuity = admitted.continuity;

  assert.equal(validation.valid, true);
  assert.equal(admitted.receipt.decision, "admitted");
  assert.equal(branchState.playerLocations[observer2.id], "north-room");
  assert.deepEqual(branchState.availability.servedHeads[0].headIds, [branchHead]);
  assert.equal(lateJoinerContinuity.events[0].kind, "continuity-seed-admitted");
  assert.equal(admitted.receipt.nonClaims.includes("admission is not global truth"), true);
});

test("offline concurrent heads are valid divergence, not RBC failure", () => {
  const { observer1, observer2, continuity } = bootstrapContinuity();
  const staleHead = headId(continuity);
  const observer2Branch = appendPlayerMove(continuity, observer2, "north-room", [staleHead]);
  const observer1Branch = appendPlayerMove(continuity, observer1, "south-room", [staleHead]);

  const observer2New = branchEventsSince(continuity, observer2Branch)[0];
  const observer1New = branchEventsSince(continuity, observer1Branch)[0];
  const reconciliation = classifyConcurrentBranches(continuity, observer2Branch, observer1Branch);

  assert.equal(observer2New.payload.knownHeads[0], staleHead);
  assert.equal(observer1New.payload.knownHeads[0], staleHead);
  assert.equal(reconciliation.decision, "admitted");
  assert.equal(reconciliation.status, "concurrent-valid-heads");
  assert.equal(reconciliation.branchStatus, "divergent-valid");
  assert.equal(reconciliation.mergePerformed, false);
});

test("conflicting concurrent heads defer reconciliation without deleting either branch", () => {
  const { observer1, observer2, continuity } = bootstrapContinuity();
  const staleHead = headId(continuity);
  const observer2Branch = appendItemMove(continuity, observer2, "item-key", "table", "observer-2-pocket", [staleHead]);
  const observer1Branch = appendItemMove(continuity, observer1, "item-key", "table", "observer-1-pocket", [staleHead]);
  const reconciliation = classifyConcurrentBranches(continuity, observer2Branch, observer1Branch);

  assert.equal(reconciliation.decision, "deferred");
  assert.equal(reconciliation.status, "concurrent-heads-conflicting");
  assert.equal(reconciliation.mergePerformed, false);
  assert.equal(reconciliation.conflicts[0].itemId, "item-key");
  assert.equal(branchEventsSince(continuity, observer2Branch).length, 1);
  assert.equal(branchEventsSince(continuity, observer1Branch).length, 1);
  assert.equal(deriveState(observer2Branch, seederLabReducer, initialState()).itemLocations["item-key"], "observer-2-pocket");
  assert.equal(deriveState(observer1Branch, seederLabReducer, initialState()).itemLocations["item-key"], "observer-1-pocket");
});
