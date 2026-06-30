# Agent Adoption Guide for `poo-continuity-kernel`

`poo-continuity-kernel` is the semantic kernel for observer-owned continuity. Use it when a domain needs replayable happenings, admission decisions, receipts, projection, checkpoints, seeds, joins, or explicit compatibility boundaries.

The kernel should be the shared ontology layer. Domain repos should not reimplement PoO from scratch.

## Adoption rule

Use the kernel when a repo has continuity: state changes over time and those changes need to be replayed, admitted, rejected, projected, checkpointed, seeded, joined, or explained with receipts.

Do not force the kernel into stateless helper libraries. If a plain deterministic function explains all behavior and no continuity needs to be replayed, keep the repo simple.

## Good domain candidates

- game actions and text-adventure commands
- item movement, possession, or history
- repo patches, review events, and agent work logs
- filesystem-like create, move, delete, or observe operations
- HTTP/session flows with replayable transitions
- peer, swarm, stream, or substrate observations
- agent/NPC actions
- external referents becoming visible
- checkpoints, seeds, late-join, or replay flows

## Domain adapter recipe

Define these before implementation:

- `branchType`: the continuity lane name for this domain.
- happening kinds: the complete event vocabulary the reducer understands.
- initial state: the empty derived state before replay.
- reducer: deterministic state derivation from admitted happenings.
- RBC/rulebook: the policy that admits, rejects, or defers proposed happenings.
- receipt names: the receipt decisions and reasons consumers should expect.
- accepted test: one ordinary valid action.
- rejected test: one action that must not advance continuity.
- replay determinism test: replaying the same admitted happenings produces the same state.

Readiness rule: if an agent cannot name the branch type, happening kind, reducer, and rejection case, it is not ready to add PoO to the repo.

## Minimal implementation flow

```text
command/action proposed
  -> create happening
  -> derive current state from admitted continuity
  -> evaluate against domain rulebook/RBC
  -> admitted/rejected/deferred receipt
  -> append only admitted happenings
  -> derive state by replaying continuity
```

Only admitted happenings advance continuity. Rejected and deferred outcomes are receipts, not hidden state transitions.

## Do not collapse ontology boundaries

```text
storage != reality
availability != visibility
visibility != admission
admission != global truth
projection != write authority
receipt != canonical proof
join != merge
checkpoint != full replay
seed != full history
branch composite != universal log
renderer branch != object authority
```

These distinctions are not naming preferences. They are the safety boundaries that keep local continuity honest.

## Default CommonJS pattern

```js
const poo = require("poo-continuity-kernel");

function initialState() {
  return { count: 0 };
}

function reducer(state, happening) {
  if (happening.kind === "increment") {
    return { count: state.count + Number(happening.amount || 1) };
  }
  return state;
}

function rulebook(happening, state) {
  if (happening.kind !== "increment") {
    return { decision: "rejected", reasons: ["unknown happening kind"] };
  }
  if (Number(happening.amount || 1) < 0) {
    return { decision: "rejected", reasons: ["negative increments are not admitted"] };
  }
  return { decision: "admitted", reasons: ["increment is admitted"] };
}

const observer = poo.core.createObserver({
  id: "domain-observer",
  branchType: "counter-continuity",
});

let continuity = poo.core.createContinuity(observer.id, observer.branchType);

const happening = poo.core.createHappening({
  actorObserverId: observer.id,
  kind: "increment",
  amount: 1,
});

const state = poo.core.deriveState(continuity, reducer, initialState());
const receipt = poo.evaluateAdmittance({
  continuity,
  happening,
  state,
  rulebook,
  defaultDecision: "deferred",
});

if (receipt.decision === "admitted") {
  continuity = poo.core.appendAdmittedHappening(continuity, happening);
}

const nextState = poo.core.deriveState(continuity, reducer, initialState());
```

The same helpers are also available through the flat compatibility surface for common core operations, for example `poo.createContinuity`, `poo.createHappening`, `poo.appendAdmittedHappening`, and `poo.deriveState`.

## Storage boundary

Build domain semantics first against local continuity or `poo.adapters.memory`. Add storage after these pass:

- accepted happening appends and replays
- rejected happening does not append
- replay determinism is stable
- receipts include useful reasons

Storage adapters are availability surfaces. They are not semantic authority. A storage adapter can hold, stream, or replicate candidate continuity data, but admission and derivation still come from the kernel and the domain rulebook.

## Projection, checkpoint, seed, and join posture

Use projection when an external referent becomes observable. Projection does not grant write authority.

Use checkpoints and seeds as bounded replay/admission aids. They are not replacements for full history unless the domain explicitly defines that policy outside the kernel.

Use joins as forward-compatible alignment surfaces. A join is not a merge and does not reconcile incompatible histories.

Use branch composites when a subject is constituted by multiple scoped branches:
identity, context, capability, custody, provenance, renderer, debug, metric,
fork-lineage, rulebook/RBC, summary, or checkpoint material. A transported or
stored branch composite is candidate material until a receiving rulebook/RBC
cascade classifies which branches are required, admitted, permitted, ignored,
rejected, deferred, summarized, or candidate-only.

Downstream repos should not own this primitive. `poo-twine` can keep compact
local composites for story/referent continuity without inlining every possible
art or debug branch. `virtualia-2d` can render admitted branch subsets without
making a view authoritative. `omega-ect` can inspect files, videos, repos,
agent work, and production artifacts as composites without silently merging
them or redefining kernel doctrine.

## Minimum tests for a new domain adapter

- Accepted path: a valid proposed happening receives an admitted receipt, appends, and changes derived state.
- Rejected path: an invalid proposed happening receives a rejected receipt and does not advance continuity.
- Deferred path, if used: policy staging produces a deferred receipt and does not append.
- Replay determinism: replaying the same admitted happenings from an empty initial state derives the same state.
- Boundary test: storage, projection, checkpoint, seed, or join helpers do not bypass admission.

## Final rule

If the repo has continuity, use the kernel to make continuity explicit.

If the repo only has stateless helper functions, do not force the kernel into it.
