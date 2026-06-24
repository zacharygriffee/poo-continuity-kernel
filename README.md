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
- adapter-style storage (`memory`, `localStorage`, `fs`)

The kernel is intentionally explicit that:

- storage is not reality
- visibility is not admission
- admission is not canonical truth
- projection is not write authority

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

## Modules

- `continuity.js`: continuity builders, immutability, admissibility evaluation, state reduction
- `happenings.js`: event shape helpers (`createHappening`, `ensureHappeningIdentity`)
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

## Repository layout

- `src/` core modules
- `adapters/` storage surfaces
- `examples/seat-map-localstorage/` local demo entry
- `examples/number-branch/` numeric RBC flow demo
- `test/` node native test modules
