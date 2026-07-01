# Rulebook Cascade / RBC Cascade

A Rulebook Cascade is a layered local continuity policy surface. It evaluates
whether happenings, branches, composites, observer seats, contexts, render
surfaces, imports, lineage, capabilities, and projection claims may participate
in a local observer/system reality.

RBC decisions are local and scoped. A cascade may admit, reject, defer, ignore,
hide, sandbox, fork, summarize, or admit with constraints. It may also reject a
child branch, reject a parent composite, quarantine an import, hide unsupported
renderer branches, or require local review before participation.

RBC review is not proof authority, global truth, automatic merge, or hidden
engine authority. It is local compatibility and participation policy over
replayable continuity evidence.

## Subjects And Scopes

RBC subjects may include:

```text
happening
branch
branch-composite
observer-seat
referent
context
render-surface
renderer-branch
asset-branch
import
transport-envelope
lineage
fork
capability
rulebook-change
projection-claim
debug-branch
candidate-package
```

RBC scopes may include:

```text
admission
review
import
mount
merge
fork
sandbox
render
project
transport
debug
exchange
operator-review
local-participation
```

The same material may receive different RBC decisions under different scopes. A
renderer branch may be accepted for sandboxed debug inspection but rejected for
production projection.

## Decisions

RBC decisions include:

```text
admitted
accepted
rejected
deferred
ignored
hidden
sandboxed
quarantined
fork-required
admitted-with-constraints
candidate-only
summarized
unsupported
```

Decision distinctions:

```text
accepted = compatible for limited/local use or inspection
admitted = contributes to local continuity/projection
hidden = not projected in this renderer/view
ignored = out of scope for this cascade
sandboxed = usable only under constrained execution/projection
fork-required = cannot join current branch head without forking
candidate-only = preserved for review but not admitted
```

## Layering

A cascade preserves the fact that multiple layers contributed to the final
decision. Example layers:

```text
schema layer
source identity layer
branch closure layer
capability layer
authority-claim layer
renderer compatibility layer
local observer policy layer
operator review layer
```

A final cascade decision should not erase individual layer findings.

```js
{
  kind: "rbc-cascade-result",
  subjectRef: { kind: "branch-composite", id: "incoming-sword-composite" },
  scope: "import",
  finalDecision: "admitted-with-constraints",
  layerResults: [
    {
      layerId: "schema",
      decision: "accepted",
      findings: []
    },
    {
      layerId: "capability",
      decision: "deferred",
      findings: [
        {
          kind: "privileged-power",
          severity: "risk",
          message: "Capability branch introduces unsupported power."
        }
      ]
    },
    {
      layerId: "renderer",
      decision: "sandboxed",
      findings: [
        {
          kind: "unbounded-codec",
          severity: "warning",
          message: "Renderer branch requires sandboxed codec handling."
        }
      ]
    }
  ],
  constraints: [],
  nonClaims: [
    "RBC cascade result is local participation policy",
    "RBC cascade result is not global proof authority",
    "RBC cascade result does not perform automatic merge"
  ]
}
```

## Branch Composites

RBC cascades support branch composites. For a branch composite, a cascade may
decide branch-by-branch:

```text
identity branch: admitted
context branch: admitted
renderer branch: sandboxed
usage metric branch: deferred
debug branch: candidate-only
rulebook override branch: rejected
parent composite: admitted-with-constraints
```

The parent composite decision can reference child branch decisions. All branches
do not need to be admitted together unless a rulebook layer says the composite is
atomic.

## Local Continuity Review

RBC cascade and Local Continuity Review are related but distinct.

RBC cascade is the layered local policy mechanism.

Local Continuity Review is the broader review process or agent-assisted analysis
that may use RBC cascade results to explain what accepting/admitting continuity
material would mean.

```text
RBC asks:
What does local policy allow, reject, defer, sandbox, hide, or constrain?

Continuity review asks:
What does this continuity imply, what risks does it introduce, and what should
the operator/system know before joining, admitting, forking, or sandboxing it?
```

A Continuity Review Agent may invoke or summarize RBC cascade results, but the
review agent does not own truth and does not override RBC.

## Fork, Renderer, And Import Behavior

An RBC cascade may require a fork when an incoming branch is compatible with
source identity but conflicts with local custody, requires an incompatible
rulebook version, or changes future affordances in a way local continuity cannot
absorb. This is not a merge. It is a local policy decision that joining current
continuity would be unsafe or incompatible.

RBC cascades support renderer/view participation. A renderer branch may be
hidden, unsupported, sandboxed, accepted for debug, rejected for production
projection, or admitted for local render. A sprite, canvas layer, render surface,
or UI output is not continuity authority.

Transport is not admission. An imported package, branch composite, or transport
envelope enters as candidate material. RBC may classify it as candidate-only,
sandboxed, deferred, rejected, admitted-with-constraints, or fork-required.

## Findings

Finding kinds include:

```text
schema-mismatch
missing-required-branch
branch-closure-gap
unsupported-branch-role
privileged-power
authority-claim
rulebook-change
rbc-incompatibility
malicious-affordance
hidden-dependency
unbounded-codec
renderer-authority-leak
provenance-gap
custody-conflict
fork-lineage-conflict
stale-branch-head
summary-omission
debug-branch-leak
projection-delta-risk
transport-source-mismatch
unknown-risk
```

Severity is intentionally small: `info`, `warning`, `risk`, and `critical`.

## Non-Claims

- RBC review is not proof authority.
- RBC review is not global truth.
- RBC review is not automatic merge.
- RBC review is not hidden engine authority.
- RBC review does not make transport/import truthful.
- RBC review does not make renderer output authority.
- RBC review does not require every branch to participate everywhere.
- RBC review does not turn the kernel into a production security scanner.
- RBC review does not implement cockpit/operator behavior.
- RBC review does not implement decentralized storage/networking.
