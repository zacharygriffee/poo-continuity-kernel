const test = require("node:test");
const assert = require("node:assert/strict");

const poo = require("../src");

const {
  createContinuity,
  createHappening,
  appendAdmittedHappening,
} = poo.core;

const {
  createAsyncContinuityStore,
  continuityFromEventStream,
  deriveStateFromStream,
  validateReplayFromStream,
} = poo.storage;

const { createMemoryStore } = poo.adapters.memory;

function numberReducer(state, event) {
  if (event.kind !== "number-delta") return state;
  return {
    value: state.value + Number(event.payload?.delta || 0),
  };
}

async function* delayedEvents(events) {
  for (const event of events) {
    await Promise.resolve();
    yield event;
  }
}

test("memory store exposes async continuity contract", async () => {
  const store = createMemoryStore();
  const continuity = createContinuity("async-observer", "number-branch");
  await store.saveContinuity(continuity);

  const loaded = await store.loadContinuity("async-observer", "number-branch");
  const listed = await store.listContinuities({ branchType: "number-branch" });

  assert.equal(loaded.ownerObserverId, "async-observer");
  assert.equal(listed.length, 1);
});

test("async store wrapper appends by loading and saving envelope", async () => {
  const backing = createMemoryStore();
  const store = createAsyncContinuityStore({
    loadContinuity: backing.loadContinuity,
    saveContinuity: backing.saveContinuity,
  });

  const event = createHappening({
    actorObserverId: "append-observer",
    kind: "number-delta",
    payload: { delta: 2 },
  });

  const next = await store.appendHappening("append-observer", "number-branch", event);
  const loaded = await store.loadContinuity("append-observer", "number-branch");

  assert.equal(next.events.length, 1);
  assert.equal(loaded.events[0].kind, "number-delta");
});

test("store stream supports lazy state derivation", async () => {
  const store = createMemoryStore();
  let continuity = createContinuity("stream-observer", "number-branch");
  continuity = appendAdmittedHappening(
    continuity,
    createHappening({
      actorObserverId: "stream-observer",
      kind: "number-delta",
      payload: { delta: 2 },
    })
  );
  continuity = appendAdmittedHappening(
    continuity,
    createHappening({
      actorObserverId: "stream-observer",
      kind: "number-delta",
      payload: { delta: 3 },
    })
  );
  await store.saveContinuity(continuity);

  const state = await deriveStateFromStream({
    events: store.streamContinuity("stream-observer", "number-branch"),
    reducer: numberReducer,
    initialState: { value: 0 },
  });

  assert.equal(state.value, 5);
});

test("continuity can be materialized from async event stream", async () => {
  const events = [
    createHappening({
      actorObserverId: "lazy-observer",
      kind: "number-delta",
      payload: { delta: 1 },
    }),
    createHappening({
      actorObserverId: "lazy-observer",
      kind: "number-delta",
      payload: { delta: 4 },
    }),
  ];

  const continuity = await continuityFromEventStream({
    ownerObserverId: "lazy-observer",
    branchType: "number-branch",
    events: delayedEvents(events),
  });
  const replay = await validateReplayFromStream({
    events: continuity.events,
    reducer: numberReducer,
    initialState: { value: 0 },
  });

  assert.equal(continuity.events.length, 2);
  assert.equal(replay.valid, true);
  assert.equal(replay.state.value, 5);
});
