const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

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
const { createFileStore } = poo.adapters.fs;
const { createLocalStorageStore } = poo.adapters.localstorage;

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

function continuityWithNestedEvent(ownerObserverId = "clone-observer", branchType = "number-branch") {
  return appendAdmittedHappening(
    createContinuity(ownerObserverId, branchType),
    createHappening({
      actorObserverId: ownerObserverId,
      kind: "number-delta",
      payload: { delta: 1, nested: { value: "original" } },
    })
  );
}

function createFakeLocalStorage() {
  const data = new Map();
  return {
    get length() {
      return data.size;
    },
    key(index) {
      return Array.from(data.keys())[index] || null;
    },
    getItem(key) {
      return data.has(String(key)) ? data.get(String(key)) : null;
    },
    setItem(key, value) {
      data.set(String(key), String(value));
    },
    removeItem(key) {
      data.delete(String(key));
    },
  };
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

test("memory store load list and stream results are mutation-isolated", async () => {
  const store = createMemoryStore();
  await store.saveContinuity(continuityWithNestedEvent());

  const loaded = await store.loadContinuity("clone-observer", "number-branch");
  loaded.events[0].payload.nested.value = "mutated-load";

  const listed = await store.listContinuities({ branchType: "number-branch" });
  listed[0].events[0].payload.nested.value = "mutated-list";

  const streamed = [];
  for await (const event of store.streamContinuity("clone-observer", "number-branch")) {
    event.payload.nested.value = "mutated-stream";
    streamed.push(event);
  }

  const fresh = await store.loadContinuity("clone-observer", "number-branch");
  assert.equal(streamed.length, 1);
  assert.equal(fresh.events[0].payload.nested.value, "original");
});

test("file store encodes observer and branch ids into safe filenames", async () => {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "poo-continuity-store-"));
  try {
    const store = createFileStore({ rootDir });
    const continuity = createContinuity("../observer/with/slash", "branch/../type");
    await store.saveContinuity(continuity);

    const loaded = await store.loadContinuity("../observer/with/slash", "branch/../type");
    const files = fs.readdirSync(rootDir);

    assert.equal(loaded.ownerObserverId, "../observer/with/slash");
    assert.equal(files.length, 1);
    assert.equal(files[0].includes("/"), false);
    assert.match(files[0], /%2F/);
  } finally {
    fs.rmSync(rootDir, { recursive: true, force: true });
  }
});

test("file store load list and stream results are mutation-isolated", async () => {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "poo-continuity-store-"));
  try {
    const store = createFileStore({ rootDir });
    await store.saveContinuity(continuityWithNestedEvent("fs-clone-observer"));

    const loaded = await store.loadContinuity("fs-clone-observer", "number-branch");
    loaded.events[0].payload.nested.value = "mutated-load";

    const listed = await store.listContinuities({ branchType: "number-branch" });
    listed[0].events[0].payload.nested.value = "mutated-list";

    for await (const event of store.streamContinuity("fs-clone-observer", "number-branch")) {
      event.payload.nested.value = "mutated-stream";
    }

    const fresh = await store.loadContinuity("fs-clone-observer", "number-branch");
    assert.equal(fresh.events[0].payload.nested.value, "original");
  } finally {
    fs.rmSync(rootDir, { recursive: true, force: true });
  }
});

test("localStorage store load list and stream results are mutation-isolated", async () => {
  const previousWindow = global.window;
  global.window = { localStorage: createFakeLocalStorage() };
  try {
    const store = createLocalStorageStore({ prefix: "poo-test" });
    await store.saveContinuity(continuityWithNestedEvent("local-clone-observer"));

    const loaded = await store.loadContinuity("local-clone-observer", "number-branch");
    loaded.events[0].payload.nested.value = "mutated-load";

    const listed = await store.listContinuities({ branchType: "number-branch" });
    listed[0].events[0].payload.nested.value = "mutated-list";

    for await (const event of store.streamContinuity("local-clone-observer", "number-branch")) {
      event.payload.nested.value = "mutated-stream";
    }

    const fresh = await store.loadContinuity("local-clone-observer", "number-branch");
    assert.equal(fresh.events[0].payload.nested.value, "original");
  } finally {
    if (previousWindow === undefined) {
      delete global.window;
    } else {
      global.window = previousWindow;
    }
  }
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

test("async store wrapper returns normalized clone-isolated envelopes", async () => {
  let backing = continuityWithNestedEvent("wrapper-clone-observer");
  const store = createAsyncContinuityStore({
    async loadContinuity() {
      return backing;
    },
    async saveContinuity(continuity) {
      backing = continuity;
    },
    async listContinuities() {
      return [backing];
    },
    streamContinuity() {
      return backing.events;
    },
  });

  const loaded = await store.loadContinuity("wrapper-clone-observer", "number-branch");
  loaded.events[0].payload.nested.value = "mutated-load";

  const listed = await store.listContinuities({ branchType: "number-branch" });
  listed[0].events[0].payload.nested.value = "mutated-list";

  for await (const event of store.streamContinuity("wrapper-clone-observer", "number-branch")) {
    event.payload.nested.value = "mutated-stream";
  }

  assert.equal(backing.events[0].payload.nested.value, "original");
});

test("async store wrapper preserves non-continuity list descriptors", async () => {
  const descriptor = {
    ownerObserverId: "descriptor-owner",
    branchType: "number-branch",
    branchCoreName: "branch/name",
    localRemoved: false,
    meta: { value: "original" },
  };
  const store = createAsyncContinuityStore({
    async loadContinuity() {
      return createContinuity("descriptor-owner", "number-branch");
    },
    async saveContinuity() {},
    async listContinuities() {
      return [descriptor];
    },
  });

  const listed = await store.listContinuities();
  listed[0].meta.value = "mutated";

  assert.equal(listed[0].branchCoreName, "branch/name");
  assert.equal(descriptor.meta.value, "original");
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
