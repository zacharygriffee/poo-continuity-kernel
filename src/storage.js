const {
  createContinuity,
  appendAdmittedHappening,
  assertContinuity,
  cloneContinuityEnvelope,
  cloneJson,
  normalizeContinuityBranchType,
} = require("./continuity");

function normalizeContinuityEnvelope(value, ownerObserverId, branchType = "default-continuity") {
  const normalized = {
    ownerObserverId: String(value?.ownerObserverId || ownerObserverId || "").trim(),
    branchType: normalizeContinuityBranchType(value, branchType),
    events: Array.isArray(value?.events)
      ? value.events.filter((event) => event && typeof event === "object").map((event) => cloneJson(event))
      : [],
  };
  assertContinuity(normalized);
  return normalized;
}

async function* eventsFromContinuity(continuity) {
  assertContinuity(continuity);
  for (const event of continuity.events) {
    yield cloneJson(event);
  }
}

function isAsyncIterable(value) {
  return !!value && typeof value[Symbol.asyncIterator] === "function";
}

function isIterable(value) {
  return !!value && typeof value[Symbol.iterator] === "function";
}

async function* toAsyncEventStream(events) {
  if (!events) return;

  if (isAsyncIterable(events)) {
    for await (const event of events) {
      if (event && typeof event === "object") {
        yield cloneJson(event);
      }
    }
    return;
  }

  if (isIterable(events)) {
    for (const event of events) {
      if (event && typeof event === "object") {
        yield cloneJson(event);
      }
    }
    return;
  }

  throw new Error("events must be iterable or async iterable");
}

async function continuityFromEventStream({
  ownerObserverId,
  branchType = "default-continuity",
  events,
}) {
  const continuity = createContinuity(ownerObserverId, branchType);
  const materialized = [];

  for await (const event of toAsyncEventStream(events)) {
    materialized.push(cloneJson(event));
  }

  return {
    ...continuity,
    events: materialized,
  };
}

async function deriveStateFromStream({
  events,
  reducer,
  initialState = {},
  continuity = null,
}) {
  if (typeof reducer !== "function") {
    throw new Error("reducer must be a function");
  }

  let state = initialState;
  let eventIndex = 0;
  for await (const event of toAsyncEventStream(events)) {
    state = reducer(state, event, {
      continuity,
      eventIndex,
    });
    eventIndex += 1;
  }
  return state;
}

async function validateReplayFromStream({
  events,
  reducer,
  rulebook,
  initialState = {},
  continuity = null,
}) {
  if (typeof reducer !== "function") {
    throw new Error("reducer must be a function");
  }

  const rulefn =
    typeof rulebook === "function"
      ? rulebook
      : () => ({
          decision: "admitted",
          reasons: [],
        });

  let state = initialState;
  let eventIndex = 0;
  const report = {
    valid: true,
    state: initialState,
    failures: [],
  };

  for await (const event of toAsyncEventStream(events)) {
    const decision = rulefn(event, state, {
      continuity,
      eventIndex,
    }) || {};

    if (decision.decision !== "admitted") {
      report.valid = false;
      report.failures.push({
        happeningId: event.id || null,
        kind: event.kind || "unknown",
        reasons: Array.isArray(decision.reasons) && decision.reasons.length > 0
          ? decision.reasons
          : ["rulebook rejected event"],
      });
      eventIndex += 1;
      continue;
    }

    state = reducer(state, event, {
      continuity,
      eventIndex,
    });
    eventIndex += 1;
  }

  report.state = state;
  return report;
}

function createAsyncContinuityStore({
  loadContinuity,
  saveContinuity,
  removeContinuity,
  listContinuities,
  streamContinuity,
  appendHappening,
}) {
  if (typeof loadContinuity !== "function") {
    throw new Error("loadContinuity function is required");
  }
  if (typeof saveContinuity !== "function") {
    throw new Error("saveContinuity function is required");
  }

  return {
    async loadContinuity(ownerObserverId, branchType = "default-continuity") {
      const loaded = await loadContinuity(ownerObserverId, branchType);
      return loaded ? normalizeContinuityEnvelope(loaded, ownerObserverId, branchType) : null;
    },

    async saveContinuity(continuity) {
      const normalized = normalizeContinuityEnvelope(
        continuity,
        continuity?.ownerObserverId,
        continuity?.branchType
      );
      await saveContinuity(cloneContinuityEnvelope(normalized));
      return normalized;
    },

    async removeContinuity(ownerObserverId, branchType = "default-continuity") {
      if (typeof removeContinuity === "function") {
        await removeContinuity(ownerObserverId, branchType);
      }
    },

    async listContinuities(options = {}) {
      if (typeof listContinuities !== "function") {
        return [];
      }
      const listed = await listContinuities(options);
      return Array.isArray(listed)
        ? listed.map((entry) =>
            Array.isArray(entry?.events)
              ? normalizeContinuityEnvelope(entry, entry?.ownerObserverId, entry?.branchType)
              : cloneJson(entry)
          )
        : [];
    },

    streamContinuity(ownerObserverId, branchType = "default-continuity", options = {}) {
      if (typeof streamContinuity === "function") {
        return toAsyncEventStream(streamContinuity(ownerObserverId, branchType, options));
      }

      return (async function* fallbackStream() {
        const continuity = await loadContinuity(ownerObserverId, branchType);
        if (!continuity) return;
        yield* eventsFromContinuity(normalizeContinuityEnvelope(continuity, ownerObserverId, branchType));
      })();
    },

    async appendHappening(ownerObserverId, branchType = "default-continuity", happening) {
      if (typeof appendHappening === "function") {
        const appended = await appendHappening(ownerObserverId, branchType, happening);
        return appended ? normalizeContinuityEnvelope(appended, ownerObserverId, branchType) : appended;
      }

      const current =
        (await this.loadContinuity(ownerObserverId, branchType)) ||
        createContinuity(ownerObserverId, branchType);
      const next = appendAdmittedHappening(current, happening);
      await this.saveContinuity(next);
      return next;
    },
  };
}

module.exports = {
  createAsyncContinuityStore,
  normalizeContinuityEnvelope,
  eventsFromContinuity,
  toAsyncEventStream,
  continuityFromEventStream,
  deriveStateFromStream,
  validateReplayFromStream,
};
