# Continuity Actions / Action Declarations

Actions are continuity-facing affordance material. An action declaration
describes a kind of attempt that may be proposed from a situation by an observer,
seat, referent, branch composite, renderer surface, context, file, item, or
agent.

An action is not a happening, not admission, not permission, not renderer truth,
and not authority. It is structured proposal-potential.

Action participation is local. A receiving observer/system may accept, reject,
hide, sandbox, constrain, replace, or preserve action declarations as candidate
material under local RBC. Projection determines whether an accepted action
becomes visible or actable for a seat. Invocation creates candidate happenings.
Only admitted happenings enter causal history and affect replay-derived
projection.

## Core Separation

```text
Action = what can be proposed as an attempt
RBC = whether the action may participate, be exposed, invoked, or admitted
Happening = what enters causal history after admission
Renderer = how an action is presented, selected, invoked, or hidden
Projection = whether a local observer/seat currently sees or can use the action
```

Do not collapse these concepts. A light does not turn on because a renderer
mutates a light object. A light may carry or receive an accepted `toggle-light`
action declaration. The observer/seat invokes that action. The runtime creates a
candidate `referent-state-transition`. RBC admits the candidate happening. Only
then does replay-derived projection show the light as on.

## Explicit And Implicit Actions

An explicit action is carried as continuity material with a referent, branch,
branch composite, package, source material, or scenario. It may travel as
candidate material during export/import.

An implicit action is supplied by a renderer, authored hybrid scenario, local
tool surface, UI, local operator policy, or implicit RBC. Implicit actions are
allowed, especially in hybrid setups, but they are not portable continuity
authority. If an action should travel with a referent into another
observer/system reality, it needs explicit action material.

## Lifecycle

```text
action declaration exists
-> local review/RBC decides whether the action can participate
-> projection determines whether observer/seat can see or use it
-> observer/seat invokes action
-> runtime creates candidate happening(s)
-> RBC reviews candidate happening(s)
-> admitted happening appends to continuity
-> replay projection reflects the result
```

No step should be skipped. Renderer mutation does not substitute for admitted
happening history.

## Shape

```js
{
  kind: "continuity-action-declaration",
  actionId: "toggle-light",
  actionKind: "referent-state-transition",
  subjectRef: {
    kind: "referent",
    id: "living-room-lamp"
  },
  label: "Turn light on/off",
  source: {
    kind: "explicit-action-material",
    branchRef: "lamp-action-branch"
  },
  portability: "candidate-material",
  candidateHappeningIntent: {
    kind: "referent-state-transition",
    requiredFields: [
      "referentId",
      "stateKey",
      "previousState",
      "nextState",
      "mediatedBy"
    ]
  },
  participationHints: {
    requiredProjection: "subject-visible-to-observer",
    requiredSeatCapability: "interact"
  },
  nonClaims: [
    "action declaration is not admission",
    "action declaration is not permission",
    "action declaration is not renderer authority",
    "action declaration is not executable authority",
    "candidate happening must pass local RBC"
  ]
}
```

The kernel defines semantics and lightweight shape only. It does not define a
DSL. Portable action material should not include executable function bodies. If
an action requires executable code, external tools, codecs, scripts, renderer
payloads, or privileged capabilities, those should be represented as separate
branches/material requiring local RBC review, sandboxing, or rejection.

## Participation

An action declaration can be locally classified as:

```text
accepted
rejected
hidden
visible
actable
sandboxed
constrained
candidate-only
replaced
deprecated
unsupported
deferred
```

Decision notes:

```text
accepted = action declaration is compatible with local policy under scope
visible = projection may show it to an observer/seat
actable = the current observer/seat may invoke it
sandboxed = action may only be used under constrained local handling
candidate-only = preserved for review, not used for projection/invocation
replaced = local reality substitutes a local action declaration or binding
```

`accepted` does not mean admitted happening.

## Relationship To RBC Cascade

RBC may evaluate action material at multiple stages:

```text
Can this action declaration participate in this local reality?
Can this action be projected to this observer/seat right now?
Can this action be invoked by this seat?
Can the produced candidate happening be admitted?
```

Example:

```text
toggle-light action declaration: accepted
toggle-light projected affordance: visible
seat invocation: allowed
referent-state-transition happening: admitted
```

Counterexample:

```text
delete-file action declaration: accepted for inspection
projected affordance: hidden for non-operator seats
invocation: rejected
candidate happening: never created
```

## Relationships

Actions can be branch material. A branch composite may include identity,
context, capability, action declaration, renderer, and debug branches. A
receiving reality may admit identity/context branches while rejecting, hiding,
sandboxing, or replacing imported action branches.

Local Continuity Review and Continuity Review Agents should inspect action
declarations. They should ask what actions this material introduces, whether any
actions are privileged or executable, whether actions imply hidden authority,
whether candidate happenings are bounded, and which actions should be hidden,
sandboxed, replaced, rejected, deferred, or admitted for participation.

Renderer = presentation/invocation surface. Renderer output is not action
authority and not continuity admission. A button is not a happening. A visible
action is not admission. A renderer-provided implicit action is not portable
continuity authority unless represented as explicit action material and accepted
by local RBC.

## Examples

Light: A light composite carries or receives a `toggle-light` action
declaration. Local RBC accepts the action for participation. Projection shows
`Turn light on` to an observer seat only when the light is visible and the seat
can interact. Invocation creates a candidate `referent-state-transition`. RBC
admits the happening. Replay projection shows the light as on.

File: A file referent may carry `inspect-bytes`, `copy`, `fork`, or `patch`. A
local system may allow `inspect-bytes`, sandbox `copy`, require operator review
for `patch`, and hide `delete`. No file mutation occurs until a candidate
happening passes local admission.

Video: A video referent may carry `play`, `extract-frame`, `segment`, or
`transcode`. A receiving system may accept `play`, sandbox `transcode`, and
reject an imported codec action branch.

Sword: A sword branch composite may carry `swing`, `inspect-provenance`, and
`charged-strike`. A local reality may accept `inspect-provenance`, accept
`swing` only for certain seats/contexts, and reject `charged-strike` as
incompatible with local capability RBC.

## Continuity Poisoning

Action material can carry semantic risk:

```text
action declaration pretending to be permission
renderer button pretending to be continuity authority
implicit local action pretending to be portable action material
candidate action pretending to be admitted happening
action branch smuggling privileged power
action branch requiring unbounded executable payload
debug action claiming proof authority
transported action requiring local RBC override
```

## Non-Claims

- Action is not happening.
- Action is not admission.
- Action is not permission.
- Action is not renderer truth.
- Action is not executable authority.
- Action declaration does not bypass RBC.
- Action invocation does not guarantee admission.
- Implicit action is not portable authority.
- Transported action material is not automatically accepted.
- Renderer-provided action is not proof of referent capability.
- Kernel does not define a full action DSL.
- Kernel does not implement game mechanics, UI behavior, tool execution, or
  renderer behavior.
