const poo = require("../src");

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function initialState() {
  return { count: 0 };
}

function reducer(state, happening) {
  if (happening.kind === "increment") {
    return { count: state.count + Number(happening.payload.amount || 1) };
  }
  return state;
}

function rulebook(happening) {
  if (happening.kind !== "increment") {
    return { decision: "rejected", reasons: ["unknown happening kind"] };
  }
  return { decision: "admitted", reasons: ["increment admitted"] };
}

async function main() {
  const observer = poo.core.createObserver({ branchType: "bare-smoke-continuity" });
  let continuity = poo.core.createContinuity(observer.id, observer.branchType);
  const happening = poo.core.createHappening({
    actorObserverId: observer.id,
    kind: "increment",
    payload: { amount: 2 },
  });

  assert(/^obs-[a-f0-9]+$/.test(observer.id), "observer id should be crypto-shaped");
  assert(/^h-[a-f0-9]+$/.test(happening.id), "happening id should be crypto-shaped");

  const receipt = poo.evaluateAdmittance({
    continuity,
    happening,
    state: initialState(),
    rulebook,
    defaultDecision: "deferred",
  });
  assert(receipt.decision === "admitted", "rulebook admission should pass");

  continuity = poo.core.appendAdmittedHappening(continuity, receipt.normalizedHappening);
  const derived = poo.core.deriveState(continuity, reducer, initialState());
  assert(derived.count === 2, "derived state should replay admitted happening");

  const store = poo.adapters.memory.createMemoryStore();
  await store.saveContinuity(continuity);
  const loaded = await store.loadContinuity(observer.id, observer.branchType);
  assert(loaded.events.length === 1, "memory store should load saved continuity");

  let streamed = 0;
  for await (const event of store.streamContinuity(observer.id, observer.branchType)) {
    assert(event.id === happening.id, "streamed event id should match admitted happening");
    streamed += 1;
  }
  assert(streamed === 1, "memory store should stream one event");

  console.log("kernel bare smoke ok");
}

main();
