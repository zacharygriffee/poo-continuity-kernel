const {
  createObserver,
  createContinuity,
  createRefereeBranch,
  createRbcReferent,
  admitRbcReferent,
  getActiveRbcRules,
  evaluateHappeningAgainstRbc,
  appendAdmittedHappening,
  createHappening,
  deriveState,
} = require("../../src");

function numberReducer(state, event) {
  if (event.kind !== "number-delta") {
    return state;
  }

  return {
    value: Number(state.value) + Number(event.payload?.delta || 0),
  };
}

function emitAttempt(state, continuation, event, rbcRules, sourceLabel) {
  const decision = evaluateHappeningAgainstRbc(event, rbcRules, event.payload || {});
  if (decision.decision !== "admitted") {
    return {
      continuity: continuation,
      decision,
      state,
    };
  }

  const next = appendAdmittedHappening(continuation, event);
  return {
    continuity: next,
    decision,
    state: deriveState(next, numberReducer, { value: state.value }),
  };
}

function runDemo() {
  const observer = createObserver({ id: "observerA", branchType: "number-branch" });
  let continuity = createContinuity(observer.id, observer.branchType);

  const referee = createRefereeBranch(observer.id);
  const { branch } = admitRbcReferent(
    referee,
    createRbcReferent({
      id: "rbc-step-1",
      appliesToBranchType: observer.branchType,
      rule: { type: "max-step-per-action", value: 3 },
    })
  );
  const activeRules = getActiveRbcRules(branch, observer.branchType);

  let state = { value: 0 };
  let logs = [];

  const attemptA = emitAttempt(
    state,
    continuity,
    createHappening({
      actorObserverId: observer.id,
      kind: "number-delta",
      payload: { delta: 2 },
    }),
    activeRules
  );
  continuity = attemptA.continuity;
  state = attemptA.state;
  logs.push({ label: "+2", ...attemptA.decision });

  const attemptB = emitAttempt(
    state,
    continuity,
    createHappening({
      actorObserverId: observer.id,
      kind: "number-delta",
      payload: { delta: 5 },
    }),
    activeRules
  );
  logs.push({ label: "+5", ...attemptB.decision });

  const summary = {
    observerId: observer.id,
    continuityEvents: continuity.events.length,
    continuityState: state,
    logs,
  };

  console.log(JSON.stringify(summary, null, 2));
  return summary;
}

if (require.main === module) {
  runDemo();
}

module.exports = {
  runDemo,
};
