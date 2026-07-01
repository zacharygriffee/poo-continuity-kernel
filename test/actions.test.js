const test = require("node:test");
const assert = require("node:assert/strict");

const poo = require("../src");

function toggleLightAction() {
  return poo.actions.createActionDeclaration({
    actionId: "toggle-light",
    actionKind: "referent-state-transition",
    subjectRef: {
      kind: "referent",
      id: "living-room-lamp",
    },
    label: "Turn light on/off",
    source: {
      kind: "explicit-action-material",
      branchRef: "lamp-action-branch",
    },
    portability: "candidate-material",
    candidateHappeningIntent: {
      kind: "referent-state-transition",
      requiredFields: [
        "referentId",
        "stateKey",
        "previousState",
        "nextState",
        "mediatedBy",
      ],
    },
    participationHints: {
      requiredProjection: "subject-visible-to-observer",
      requiredSeatCapability: "interact",
    },
  });
}

test("action declaration can exist without becoming a happening", () => {
  const action = toggleLightAction();
  const continuity = poo.core.createContinuity("observer-action", "action-test");

  assert.equal(action.kind, "continuity-action-declaration");
  assert.equal(action.actionId, "toggle-light");
  assert.equal(action.candidateHappeningIntent.kind, "referent-state-transition");
  assert.equal(continuity.events.length, 0);
  assert.equal(action.nonClaims.includes("action declaration is not a happening"), true);
});

test("action declaration can be candidate material without admission", () => {
  const action = toggleLightAction();
  const participation = poo.actions.createActionParticipation({
    actionRef: action,
    scope: "import",
    decision: "candidate-only",
    reasons: ["incoming action branch requires local review"],
  });

  assert.equal(participation.kind, "action-participation");
  assert.equal(participation.decision, "candidate-only");
  assert.equal(participation.decisionNotes["candidate-only"], "preserved for review, not used for projection/invocation");
  assert.equal(participation.nonClaims.includes("action declaration is not admission"), true);
});

test("action participation classifies local action handling", () => {
  const action = toggleLightAction();
  const decisions = [
    "accepted",
    "rejected",
    "hidden",
    "sandboxed",
    "constrained",
    "candidate-only",
  ];
  const participations = decisions.map((decision) =>
    poo.actions.createActionParticipation({
      actionRef: action,
      scope: "participation",
      decision,
    })
  );

  assert.deepEqual(participations.map((entry) => entry.decision), decisions);
  assert.equal(participations[0].decisionNotes.accepted, "action declaration is compatible with local policy under scope");
  assert.equal(participations[2].decisionNotes.visible, "projection may show it to an observer/seat");
});

test("projected affordance references an action without admitting it", () => {
  const action = toggleLightAction();
  const affordance = poo.actions.createProjectedAffordance({
    actionRef: action,
    observerId: "observer-1",
    seatRef: { kind: "observer-seat", id: "seat-1" },
    subjectRef: action.subjectRef,
    visible: true,
    actable: false,
    participationDecision: "visible",
  });

  assert.equal(affordance.kind, "projected-affordance");
  assert.equal(affordance.actionRef.id, "toggle-light");
  assert.equal(affordance.visible, true);
  assert.equal(affordance.actable, false);
  assert.equal(affordance.nonClaims.includes("projected affordance is not admission"), true);
  assert.equal(affordance.nonClaims.includes("visible action is not permission"), true);
});

test("action invocation produces candidate happening intent without mutating continuity", () => {
  const action = toggleLightAction();
  const continuity = poo.core.createContinuity("observer-1", "light-continuity");
  const snapshot = JSON.stringify(continuity);
  const invocation = poo.actions.createActionInvocation({
    actionRef: action,
    actorObserverId: "observer-1",
    seatRef: { kind: "observer-seat", id: "seat-1" },
    subjectRef: action.subjectRef,
    input: {
      nextState: "on",
    },
    candidateHappeningIntent: action.candidateHappeningIntent,
  });

  assert.equal(invocation.kind, "action-invocation");
  assert.equal(invocation.candidateHappeningIntent.kind, "referent-state-transition");
  assert.deepEqual(invocation.input, { nextState: "on" });
  assert.equal(JSON.stringify(continuity), snapshot);
  assert.equal(invocation.nonClaims.includes("action invocation creates proposal material only"), true);
});

test("admitted happening is separate from action declaration and invocation", () => {
  const action = toggleLightAction();
  const invocation = poo.actions.createActionInvocation({
    actionRef: action,
    actorObserverId: "observer-1",
    candidateHappeningIntent: action.candidateHappeningIntent,
  });
  const continuity = poo.core.createContinuity("observer-1", "light-continuity");
  const happening = poo.core.createHappening({
    actorObserverId: "observer-1",
    kind: invocation.candidateHappeningIntent.kind,
    payload: {
      referentId: "living-room-lamp",
      stateKey: "lit",
      previousState: false,
      nextState: true,
      mediatedBy: invocation.invocationId,
    },
  });
  const next = poo.core.appendAdmittedHappening(continuity, happening);

  assert.equal(action.kind, "continuity-action-declaration");
  assert.equal(invocation.kind, "action-invocation");
  assert.equal(next.events.length, 1);
  assert.equal(next.events[0].kind, "referent-state-transition");
  assert.equal(next.events[0].payload.mediatedBy, invocation.invocationId);
});

test("explicit and implicit action sources are distinguishable", () => {
  const explicit = toggleLightAction();
  const implicit = poo.actions.createActionDeclaration({
    actionId: "inspect",
    actionKind: "inspect-referent",
    subjectRef: { kind: "referent", id: "living-room-lamp" },
    source: {
      kind: "implicit-renderer-action",
      localSurfaceRef: "debug-renderer",
    },
    portability: "implicit-not-portable",
  });

  assert.equal(explicit.source.kind, "explicit-action-material");
  assert.equal(explicit.portability, "candidate-material");
  assert.equal(implicit.source.kind, "implicit-renderer-action");
  assert.equal(implicit.portability, "implicit-not-portable");
  assert.equal(implicit.nonClaims.includes("implicit action is not portable authority"), true);
});

test("action non-claims preserve permission admission renderer and executable boundaries", () => {
  const action = toggleLightAction();
  const receipt = poo.actions.createActionReceipt({
    actionRef: action,
    decision: "accepted",
    reasons: ["accepted for local participation only"],
  });

  for (const claim of [
    "action declaration is not admission",
    "action declaration is not permission",
    "action declaration is not renderer authority",
    "action declaration is not executable authority",
    "candidate happening must pass local RBC",
  ]) {
    assert.equal(receipt.nonClaims.includes(claim), true);
  }
});
