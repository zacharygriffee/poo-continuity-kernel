function createRbcReferent(input = {}) {
  const id = String(input.id || "").trim();
  if (!id) {
    throw new Error("rbc referent id is required");
  }

  const type = String(input.rule?.type || "max-step-per-action").trim() || "max-step-per-action";
  const value = Number.isFinite(input.rule?.value) ? Number(input.rule.value) : 1;

  return {
    id,
    kind: "rbc-referent",
    title: input.title || `RBC ${id}`,
    appliesToBranchType: input.appliesToBranchType || "default-continuity",
    rule: {
      ...(input.rule || {}),
      type,
      value,
    },
    nonClaims: [
      "RBC is local to admissions",
      "RBC is not global law",
      "RBC is not canonical truth",
    ],
  };
}

function createRefereeBranch(ownerObserverId) {
  if (!ownerObserverId || typeof ownerObserverId !== "string") {
    throw new Error("ownerObserverId is required");
  }

  return {
    ownerObserverId,
    kind: "referee-branch",
    branchType: "rbc-branch",
    admittedRbcReferents: [],
  };
}

function getActiveRbcRules(branch, branchType) {
  if (!branch || !Array.isArray(branch.admittedRbcReferents)) {
    return [];
  }

  return branch.admittedRbcReferents.filter(
    (rule) => !branchType || !rule.appliesToBranchType || rule.appliesToBranchType === branchType
  );
}

function admitRbcReferent(branch, rbcReferent) {
  if (!branch || branch.kind !== "referee-branch") {
    throw new Error("referee branch required");
  }
  if (!rbcReferent || rbcReferent.kind !== "rbc-referent") {
    throw new Error("rbc referent required");
  }

  const exists = branch.admittedRbcReferents.some((entry) => entry.id === rbcReferent.id);
  if (exists) {
    return {
      branch,
      receipt: {
        kind: "admission-receipt",
        observerId: branch.ownerObserverId,
        actorObserverId: branch.ownerObserverId,
        decision: "rejected",
        reasons: ["RBC already admitted"],
        nonClaims: ["RBC admission is local and non-authoritative"],
      },
    };
  }

  const next = {
    ...branch,
    admittedRbcReferents: [...branch.admittedRbcReferents, rbcReferent],
  };

  return {
    branch: next,
    receipt: {
      kind: "admission-receipt",
      observerId: branch.ownerObserverId,
      actorObserverId: branch.ownerObserverId,
      decision: "admitted",
      reasons: ["RBC admitted to local referee branch"],
      nonClaims: ["RBC admission does not create truth"],
    },
  };
}

function evaluateHappeningAgainstRbc(happening, activeRules, context = {}) {
  if (!happening || typeof happening !== "object") {
    return { decision: "rejected", reasons: ["invalid happening"] };
  }

  const kind = String(happening.kind || "").trim();
  if (!Array.isArray(activeRules) || activeRules.length === 0) {
    const constrainedKinds = context?.constrainedKinds || ["seat-position-changed", "number-delta", "referent-created"];
    if (constrainedKinds.includes(kind)) {
      return {
        decision: "rejected",
        reasons: ["No active RBC referent admitted"],
      };
    }

    return {
      decision: "admitted",
      reasons: ["No RBC constraints"],
    };
  }

  for (const rule of activeRules) {
    const r = rule?.rule || {};
    const limitType = String(r.type || "").trim();

    if (limitType === "max-step-per-action") {
      const rawValue = Number(
        happening.payload?.step ||
          happening.payload?.delta ||
          happening.payload?.distance ||
          context?.delta ||
          0
      );
      if (!Number.isFinite(rawValue)) {
        return { decision: "rejected", reasons: ["invalid magnitude payload"] };
      }
      if (Math.abs(rawValue) > Number(r.value || 0)) {
        return {
          decision: "rejected",
          reasons: [
            `happening exceeds max-step rule (${Math.abs(rawValue)} > ${Number(r.value || 0)})`,
            `scope=${rule.appliesToBranchType || "unknown"}`,
          ],
        };
      }
    }

    if (limitType === "bounds") {
      const minRow = Number.isFinite(r.minRow) ? Number(r.minRow) : Number.isFinite(context.minRow) ? Number(context.minRow) : null;
      const maxRow = Number.isFinite(r.maxRow) ? Number(r.maxRow) : Number.isFinite(context.maxRow) ? Number(context.maxRow) : null;
      const row = Number(happening.payload?.row ?? context.row);

      if (Number.isFinite(minRow) && Number.isFinite(row) && row < minRow) {
        return { decision: "rejected", reasons: ["RBC bounds violation (below minimum)"] };
      }
      if (Number.isFinite(maxRow) && Number.isFinite(row) && row > maxRow) {
        return { decision: "rejected", reasons: ["RBC bounds violation (above maximum)"] };
      }
    }
  }

  return {
    decision: "admitted",
    reasons: ["RBC constraints satisfied"],
  };
}

module.exports = {
  createRbcReferent,
  createRefereeBranch,
  admitRbcReferent,
  getActiveRbcRules,
  evaluateHappeningAgainstRbc,
};
