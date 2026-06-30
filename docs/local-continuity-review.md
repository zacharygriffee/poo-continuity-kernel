# Local Continuity Review

Existence is not trust.

A continuity object is not trusted because it exists. A continuity package,
branch, branch composite, observer seat, agent, item, file, renderer view,
artifact, or reality candidate becomes locally usable only after a local
observer/system reviews its causal history and branch requirements against local
rulebook/RBC boundaries.

The review may inspect capabilities, privileged powers, suspicious rule changes,
malicious affordances, unbounded codecs, hidden authority claims, incompatible
branch requirements, provenance gaps, custody conflicts, fork lineage, stale
branch heads, suspicious summaries, debug/proof branch leakage, transport/source
mismatch, and projection impact.

The result is a review receipt. A review receipt may accept, reject, defer, fork,
sandbox, quarantine, ignore, summarize, admit, admit with constraints, or
preserve material as candidate-only. The receipt is not global proof authority
and does not perform automatic merge. It is a scoped local compatibility and
risk assessment derived from replayable continuity evidence.

## Review Is Not Admission

RBC admission and continuity review are related but not identical.

```text
RBC asks:
Is this admissible under known rules?

Continuity review asks:
What does this continuity imply if accepted or admitted, what
branches/capabilities/authority claims does it introduce, and what risks or
constraints should the local observer/system understand?
```

`accept` and `admit` are intentionally distinct:

```text
accept = locally compatible for inspection, use, or supporting material under scope
admit = contributes to local continuity projection or admitted branch composition
```

A review recommendation is not admission unless a local admission mechanism
records it as such.

## Continuity Review Agents

A future Continuity Review Agent is a scoped reviewer of candidate continuity
material. It does not create truth, perform automatic merge, override local RBC,
or become proof authority. It inspects continuity packages, branch composites,
receipts, capabilities, authority claims, projection deltas, provenance, and
suspicious causal history to produce a local compatibility/risk review receipt.

Downstream operator systems may use such agents to ask:

```text
Should I join my local continuity with this other continuity?
What would change if I admit this branch composite?
Which branches are safe, suspicious, incompatible, irrelevant, or unknown?
Should this material be admitted, rejected, deferred, forked, sandboxed,
summarized, or admitted with constraints?
```

The kernel owns only the primitive semantics, not the runtime.

## Relationship To Branch Composites

A branch composite answers:

```text
What branches constitute this thing or candidate reality?
```

Local continuity review answers:

```text
Which of those branches are locally compatible, suspicious, unsupported,
rejected, deferred, sandboxed, or admissible under local RBC?
```

For example, a sword branch composite may include identity, current form,
custody, capability, art-source, renderer, usage/metric, debug, and fork-lineage
branches. A local review may admit identity/current-form/custody, sandbox the
renderer branch, defer usage metrics, reject an imported rule override branch,
and preserve the debug branch as candidate-only material.

## Continuity Poisoning

Malicious continuity may not look like traditional malware. Continuity poisoning
may include:

```text
candidate material pretending to be admitted
renderer output pretending to be truth
debug branch pretending to be proof
transport receipt pretending to be admission
imported rulebook pretending to supersede local RBC
affordance pretending to be permission
branch summary omitting hostile requirements
capability branch smuggling privileged powers
```

Local Continuity Review exists to expose these risks before local admission or
composition.

## Receipt Shape

The kernel keeps receipts inspectable:

```js
{
  kind: "local-continuity-review-receipt",
  receiptId: "review-...",
  subjectRef: {
    kind: "branch-composite",
    id: "incoming-sword-composite"
  },
  reviewer: {
    observerId: "observer-seat-1",
    systemId: "local-runtime"
  },
  scope: "join-local-continuity",
  decision: "admit-with-constraints",
  recommendation: "admit-with-constraints",
  rbcRef: "local-rbc-v1",
  reviewedEvidence: {
    branches: [],
    branchComposites: [],
    receipts: [],
    checkpoints: [],
    causalHistoryRefs: []
  },
  projectionDelta: {
    summary: "what would change if admitted",
    affectedReferents: [],
    affectedBranches: [],
    affectedCapabilities: []
  },
  findings: [
    {
      kind: "authority-claim",
      severity: "risk",
      message: "Imported branch claims authority not supported by local RBC.",
      evidenceRefs: []
    }
  ],
  admittedBranches: [],
  acceptedBranches: [],
  rejectedBranches: [],
  deferredBranches: [],
  sandboxedBranches: [],
  ignoredBranches: [],
  constraints: [
    {
      kind: "sandbox-renderer-payload",
      reason: "renderer branch requires codec review before use"
    }
  ],
  nonClaims: [
    "review receipt is local compatibility assessment only",
    "review receipt is not global proof authority",
    "review receipt does not perform automatic merge",
    "review receipt does not admit continuity unless paired with local admission"
  ]
}
```

## Finding Kinds

Finding kinds include:

```text
capability-claim
privileged-power
authority-claim
rulebook-change
rbc-incompatibility
branch-closure-gap
hidden-dependency
malicious-affordance
unbounded-codec
executable-payload
renderer-authority-leak
provenance-gap
custody-conflict
fork-lineage-ambiguity
stale-branch-head
summary-omission
debug-branch-leak
proof-branch-overclaim
transport-source-mismatch
projection-delta-risk
unknown-risk
```

Severity is intentionally small: `info`, `warning`, `risk`, and `critical`.
These are not only cybersecurity findings. They include semantic safety,
authority safety, continuity compatibility, branch closure, provenance,
renderer risk, and capability review.

## Downstream Notes

`omega-ect` may eventually host Continuity Review Agents that review candidate
branch composites for files, videos, agent work, artifacts, proof surfaces, and
operator decisions. Omega should use review receipts to summarize what would
change, which branches are affected, which capabilities are introduced, which
branches are suspicious or unsupported, and whether to admit, reject, defer,
fork, sandbox, or admit with constraints. Omega must not become the kernel
owner.

`poo-twine` can use local review before importing continuity packages, branch
composites, observer-seat material, item material, or scenario fragments. A
package can be candidate material without being admitted.

`virtualia-2d` can use review before accepting renderer branches, art-source
branches, sprite updates, debug branches, or imported scene branches. Renderer
output is not authority.

## Non-Claims

- Local review is not global proof authority.
- Local review is not automatic merge.
- Local review is not transport admission.
- Local review is not renderer authority.
- Local review does not override RBC.
- Local review does not require every branch to be supported.
- Local review does not make `poo-continuity-kernel` a production security scanner.
- Local review does not implement cockpit/operator behavior.
- Local review does not implement decentralized storage/networking.
- Downstream systems may host review agents, but the kernel owns only the
  primitive semantics.
