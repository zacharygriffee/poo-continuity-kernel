# Agent Guide: Using `poo-continuity-kernel`

Use this library when a repo has state that changes over time and those changes need to be replayed, admitted, rejected, projected, checkpointed, seeded, joined, or explained with receipts.

Do not implement PoO continuity from scratch in each repo. Build a small domain adapter on top of this kernel instead.

## Use the kernel when the domain has

- game or text-adventure actions
- item movement or item history
- repo patches, review events, or agent actions
- filesystem-like operations
- HTTP or session flows
- peer, swarm, or stream events
- agent or NPC actions
- external referents becoming visible
- checkpoints, seeds, late-join, or replay requirements

## Do not use the kernel when

- the repo only contains stateless helper functions
- the output has no durable or replayable continuity
- a plain deterministic function already explains all behavior

## Domain adapter recipe

Before writing domain code, define these explicitly:

- `branchType`
- happening kinds
- initial state
- reducer
- RBC/rulebook
- receipt names
- one accepted test
- one rejected test
- one replay determinism test

If an agent cannot name the branch type, happening kind, reducer, and rejection case, it is not ready to add PoO to the repo.

## Minimal flow

```text
command/action proposed
  -> create happening
  -> derive current state from admitted continuity
  -> evaluate against domain rulebook/RBC
  -> admitted/rejected/deferred receipt
  -> append only admitted happenings
  -> derive state by replaying continuity
```

## Do not collapse these

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
```

## Default implementation pattern

```js
const poo = require("poo-continuity-kernel");

const observer = poo.core.createObserver({
  id: "domain-observer",
  branchType: "my-domain-continuity",
});

let continuity = poo.core.createContinuity(observer.id, observer.branchType);

const happening = poo.core.createHappening({
  actorObserverId: observer.id,
  kind: "domain-action",
  payload: {},
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
```

## Storage boundary

Build the domain semantics first against local continuity or the memory adapter. Add storage adapters only after replay, admission, rejection, and derivation tests pass.

Storage adapters may provide availability. They do not provide admission authority.

## Longer guide

See `docs/AGENT_GUIDE.md` for the fuller adoption guide.
