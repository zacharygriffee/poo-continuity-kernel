# Continuity Branch Composites

Continuity is compositional and branch-addressable. A referent, observer seat,
artifact, file, renderer view, scenario, item, or production object may be
constituted by a continuity branch composite rather than by one monolithic log
or state object.

A branch composite may include identity branches, context branches, provenance
branches, renderer branches, art-source branches, usage/metric branches, debug
branches, capability branches, custody branches, fork-lineage branches,
rulebook/RBC branches, and summary/checkpoint branches. These branches may
themselves be composites.

No reality is required to support every branch. A rulebook/RBC cascade may
require, admit, reject, ignore, defer, summarize, or preserve branches as
candidate material by scope. Projection is derived from the admitted branch
composition relevant to the observer seat, referent, renderer, or domain.

This allows temporally extended things, such as swords, files, scenes, videos,
characters, places, and production artifacts, to be exchanged, forked,
re-rendered, debugged, summarized, and reconstituted across decentralized
surfaces without requiring one universal global log or one global authority.

## Shape

The kernel keeps the shape compact and semantic:

```js
{
  kind: "continuity-branch-composite",
  compositeId: "sword-001-composite",
  subjectRef: {
    kind: "referent",
    id: "sword-001"
  },
  scope: "referent",
  branches: [
    {
      kind: "continuity-branch-descriptor",
      branchId: "sword-001-identity",
      role: "identity",
      headRef: "h-identity-head",
      required: true
    }
  ],
  policy: {
    kind: "continuity-branch-composite-policy",
    requiredRoles: ["identity"],
    optionalRoles: ["renderer", "usage", "debug"],
    ignoredRoles: [],
    rejectedRoles: [],
    defaultClassification: "candidate-only"
  },
  receipts: [],
  checkpoints: [],
  nonClaims: [
    "branch composite is not admission until accepted by local rule/RBC",
    "branch composite is not a universal log",
    "unsupported branches may remain candidate material"
  ]
}
```

Known branch roles and scopes are exported as stable constants, but they are not
closed vocabularies. Domains may add roles and scopes when their rulebooks can
explain them.

## Cascade Semantics

Branch material can be classified as:

```text
required
admitted
permitted
ignored
rejected
deferred
summarized
candidate-only
```

The boundary is strict:

```text
transported branch material is not admission
stored branch material is not admission
renderer support is not admission
import is not merge
candidate branch material may be inspected without mutating continuity
projection uses admitted relevant branches, not all available branches
```

## Branch Closure

Branch closure is the scoped branch set required to preserve a subject's claimed
identity, current admitted state, relevant capabilities, provenance, and
rulebook compatibility for a given operation.

Example operations include:

```text
transfer
render
inspect
debug
fork
summarize
import
mount
admit
```

A branch closure can report required branches, optional branches, missing
branches, ignored branches, rejected branches, deferred branches,
summary/checkpoint branches, and non-claims. It is scoped sufficiency, not
infinite causal ancestry. Sending a sword does not require sending the whole
geology of its ore or the whole universe.

## Forks

Forking a thing means creating a new branch composite with inherited ancestry and
diverging branch heads. A fork is not merely a copy.

Two forked composites may share some branches and diverge on others. A reality
may support one subset while another reality supports a different subset.

Example:

```text
sword-origin
  identity branch shared
  art branch forked
  capability branch forked
  usage branch split
  custody branch changed
```

## Renderer And Viewer Selectivity

Renderers and viewers may select only the branches relevant to their projection.
A renderer branch is not the object itself. A sprite is not the sword. A view is
not authority.

Examples:

```text
renderer: identity, appearance, animation, current context
game rulebook: identity, capability, damage, custody, context
marketplace: identity, provenance, usage metrics, license, fork lineage
debugger: candidate branches, admission receipts, projection traces, conflicts
```

## Downstream Notes

`poo-twine` should likely keep compact local branch composites for storage
efficiency: source/story ref, seed admission ref, observer-seat branch, local
admitted happenings, referent context branches, state/trait branches, optional
checkpoint branch, and projection cache. It should not inline every possible
decentralized art, debug, metric, and provenance branch into every normal save.

`virtualia-2d` should treat a rendered scene as a projection over admitted
branch composition. Different renderers may support different branch subsets
without owning the referent's whole continuity.

`omega-ect` should treat files, videos, repos, agent work, and production
artifacts as branch composites: content branch, edit branch, review branch, test
branch, proof branch, agent-work branch, operator-decision branch, debug branch,
artifact/export branch, and deployment branch. Omega should inspect and mediate
branch composites, not silently merge them or redefine kernel doctrine.

Movie and production artifacts can be modeled as composite branching: script,
shot, storyboard, asset, render, edit, audio, approval, release, and
debug/rejected-take branches. The production object is the admitted composition
of relevant branches, not a single flat file or one global timeline.

## Non-Claims

- Do not claim global authority.
- Do not create a universal monolithic log.
- Do not claim transport is admission.
- Do not claim import is merge.
- Do not claim renderer support is continuity truth.
- Do not require infinite causal ancestry.
- Do not make every branch relevant everywhere.
- Do not make `poo-continuity-kernel` own production storage, networking,
  renderer, or cockpit behavior.
- Do not silently redefine existing kernel primitives without explicit
  compatibility notes.
