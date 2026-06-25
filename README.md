# poo-continuity-kernel

Small JavaScript kernel for observer-owned continuity and non-authoritative admission semantics.
It models how observers derive local reality snapshots from admissible happenings without
claiming global truth.

## What this package provides

- observer and referent identities
- continuity chains (`events`)
- happening normalization + stable identifiers (`h-<observer>-N`, `ref-<observer>-N`)
- admissibility receipts (`admitted`, `rejected`, `deferred`)
- RBC evaluator flow with explicit rule decisions
- seat-map domain adapter for seat-based continuity (`seat-dag-continuity-v2`)
- projection/cross-reality primitives (`external-seat-projection-admitted`, `external-referent-admitted`)
- alignment aids (`checkpoint`, `seed`, `join`) without history merge semantics
- async-first storage adapters (`memory`, `localStorage`, `fs`) and lazy event stream helpers

The kernel is intentionally explicit that:

- storage is not reality
- visibility is not admission
- admission is not canonical truth
- projection is not write authority

## Agent adoption guide

Agents and downstream repos should start with [AGENTS.md](AGENTS.md) and the fuller [Agent Adoption Guide](docs/AGENT_GUIDE.md).

Adoption rule:

- If the repo has replayable continuity, use this kernel to make continuity explicit.
- If the repo only has stateless helper functions, do not force the kernel into it.
- Build domain semantics first; add storage only after replay, admission, rejection, and derivation tests pass.

## Package entry

`src/index.js` exposes namespaced domain surfaces plus a small flat compatibility surface for common core helpers.

Compatibility note:

- A small flat compatibility surface exists for core helpers only:
  - `createObserver`, `createContinuity`, `createHappening`, `appendAdmittedHappening`,
    `evaluateAdmittance`, `deriveState`, `admittedReceipt`, `rejectedReceipt`, `deferredReceipt`
- Domain adapters should be reached through namespaces:
  - `poo.domains.seatMap`
  - `poo.rbc`
  - `poo.projection`
  - `poo.checkpoints`
  - `poo.seeds`
  - `poo.joins`

## Invariants and defaults

- `createContinuity(ownerObserverId, branchType)` creates an empty continuity.
- `appendAdmittedHappening(continuity, happening)` normalizes shape and IDs and returns a **new** continuity.
- `appendEvent` and `appendAdmittedHappening` are immutable transforms; source inputs are never mutated.
- `appendAdmittedHappening` rejects duplicate happening ids within the same continuity to keep replay identity stable.
- `evaluateAdmittance(...)` returns a receipt with deterministic decisions (`admitted`, `rejected`, `deferred`) and metadata.
- storage adapters are async-first convenience surfaces; storage remains substrate, not reality.
- event streams are candidate replay sources; admission and derivation still come from kernel rules.
- `seat-dag-continuity-v2` is the canonical seat-map branch type for seat behavior.
- V1 or legacy seat payloads are ignored when deriving seat-map state from non-v2 continuity.
- seats are `referent-created` with `type: "seat"` and movement verbs are
  - `seat-occupied`
  - `seat-vacated`
  - `seat-position-changed`
- projection admission is observational only (`external-seat-projection-admitted`).
- projection-relative realization maps source referents through an occupied source seat.
- delegated action requires a future admitted seat-entry grant or RBC referee rule.
- `admitExternalReferent` split into `admitExternalReferentClaim` (id-level claim only) and `realizeExternalReferent` (projection-relative realization).

## Quick install

```bash
npm i
npm test
```

## Quick v2 seat-map flow

```js
const poo = require("./src");
const { createObserver, createContinuity, createHappening, appendAdmittedHappening } = poo;
const { createSeatMapRulebook, BRANCH_TYPE, deriveSeatMapState } = poo.domains.seatMap;

const observerA = createObserver({ id: "observerA", branchType: BRANCH_TYPE });
let continuityA = createContinuity(observerA.id, observerA.branchType);
const seatRulebook = createSeatMapRulebook();
const { evaluateAdmittance } = poo;

// Origin seat bootstrap (empty continuity)
continuityA = appendAdmittedHappening(
  continuityA,
  createHappening({
    actorObserverId: observerA.id,
    kind: "referent-created",
    referentId: "ref-observerA-1",
    type: "seat",
    slot: "center",
    row: 6,
  })
);
continuityA = appendAdmittedHappening(
  continuityA,
  createHappening({
    actorObserverId: observerA.id,
    kind: "seat-occupied",
    seatReferentId: "ref-observerA-1",
  })
);

// Derive current seat-map state from continuity
const stateA = deriveSeatMapState(continuityA);

// Validate/append new seat action through rulebook
const placeSeat = createHappening({
  actorObserverId: observerA.id,
  kind: "referent-created",
  referentId: "ref-observerA-2",
  type: "seat",
  slot: "right",
  row: 6,
  throughSeatReferentId: "ref-observerA-1",
});
const decision = evaluateAdmittance({
  continuity: continuityA,
  happening: placeSeat,
  state: stateA,
  rulebook: seatRulebook,
});
if (decision.decision === "admitted") {
  continuityA = appendAdmittedHappening(continuityA, placeSeat);
}
```

## Continuity topology

The first-pass topology layer provides bounded primitives for relating continuities without generic merge semantics. See [Continuity Topology](docs/continuity-topology.md) and [Segment Compatibility](docs/segment-compatibility.md).

- segment policies describe how much history an observer/RBC requires for compatibility.
- bridge/portal candidates validate explicit endpoints and do not merge histories.
- mount/nesting candidates validate parent/child surfaces and do not absorb child continuity.
- overlap checks produce conflict reports delegated by domain rulebooks.
- experimental blend candidates are admission candidates, not causal proof or automatic history concatenation.

## Modules

- `continuity.js`: continuity builders, immutability, admissibility evaluation, state reduction
- `happenings.js`: event shape helpers (`createHappening`, `ensureHappeningIdentity`)
- `storage.js`: async continuity store contract, stream normalization, stream replay helpers
- `rbc.js`: referee/rule evaluation helpers
- `seat-map-domain.js`: seat-map derivation and rulebook for continuity branching
- `projection.js`: seat projection and external referent admission
- `checkpoints.js`: checkpoint referents and bounded alignment
- `seeds.js`: continuity-seed referents and tail alignment checks
- `joins.js`: non-merging join points and forward compatibility checks

## Adapters

- `adapters/memory.js`
- `adapters/localstorage.js`
- `adapters/fs.js`

Adapters expose the async continuity store shape:

```js
const store = poo.adapters.memory.createMemoryStore();

await store.saveContinuity(continuity);
const loaded = await store.loadContinuity("observerA", "seat-dag-continuity-v2");
const allSeatContinuities = await store.listContinuities({ branchType: "seat-dag-continuity-v2" });

for await (const event of store.streamContinuity("observerA", "seat-dag-continuity-v2")) {
  // lazy replay input, not canonical truth
}
```

For custom substrates, wrap async storage functions:

```js
const store = poo.storage.createAsyncContinuityStore({
  async loadContinuity(ownerObserverId, branchType) {},
  async saveContinuity(continuity) {},
  async removeContinuity(ownerObserverId, branchType) {},
  async listContinuities({ branchType } = {}) {},
  streamContinuity(ownerObserverId, branchType) {
    return someAsyncIterableOfEvents;
  },
});
```

## Repository layout

- `src/` core modules
- `adapters/` storage surfaces
- `examples/seat-map-localstorage/` local demo entry
- `examples/number-branch/` numeric RBC flow demo
- `test/` node native test modules
