function stableStringify(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(",")}}`;
}

function normalizeList(value) {
  return Array.from(new Set((Array.isArray(value) ? value : [])
    .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
    .filter(Boolean)));
}

function computeDemoRbcFingerprint(descriptor) {
  const source = stableStringify({
    id: descriptor?.id || null,
    version: descriptor?.version || 1,
    rules: descriptor?.rules || [],
    compatibility: descriptor?.compatibility || {},
  });
  return source
    .split("")
    .reduce((acc, char) => (acc * 33 + char.charCodeAt(0)) >>> 0, 5381)
    .toString(16);
}

function createRbcDescriptor(input = {}) {
  const id = String(input.id || "").trim();
  if (!id) {
    throw new Error("rbc descriptor id is required");
  }

  const descriptor = {
    kind: "rbc-descriptor",
    id,
    ownerObserverId: String(input.ownerObserverId || "unknown").trim() || "unknown",
    branchType: String(input.branchType || "default-continuity").trim() || "default-continuity",
    version: Number.isInteger(input.version) ? input.version : 1,
    rules: Array.isArray(input.rules) ? input.rules.map((rule) => ({ ...rule })) : [],
    compatibility: {
      accepts: normalizeList(input.compatibility?.accepts),
      compatibleRuleKinds: normalizeList(input.compatibility?.compatibleRuleKinds),
    },
    digest: input.digest || null,
    nonClaims: normalizeList(input.nonClaims),
  };
  descriptor.digest = descriptor.digest || computeDemoRbcFingerprint(descriptor);
  return descriptor;
}

function ruleKindsFromDescriptor(descriptor) {
  const declared = normalizeList(descriptor?.compatibility?.compatibleRuleKinds);
  const ruleKinds = normalizeList((descriptor?.rules || []).map((rule) => rule?.kind || rule?.type));
  return Array.from(new Set([...declared, ...ruleKinds]));
}

function mutuallyAccept(descriptors) {
  return descriptors.every((descriptor) =>
    descriptors.every((other) =>
      descriptor.id === other.id || normalizeList(descriptor.compatibility?.accepts).includes(other.id)
    )
  );
}

function commonRuleKinds(descriptors) {
  if (descriptors.length === 0) return [];
  return descriptors
    .map(ruleKindsFromDescriptor)
    .reduce((common, kinds) => common.filter((kind) => kinds.includes(kind)));
}

function baseNonClaims(descriptors) {
  return Array.from(new Set([
    "RBC compatibility is observer-relative",
    "RBC compatibility does not prove global truth",
    "RBC compatibility is not causal proof",
    ...descriptors.flatMap((descriptor) => normalizeList(descriptor.nonClaims)),
  ]));
}

function validateRbcCompatibility({ descriptors, policy = {}, requiredRuleKinds = [], operationKind = "topology-operation" } = {}) {
  let normalizedDescriptors;
  try {
    normalizedDescriptors = (Array.isArray(descriptors) ? descriptors : [])
      .filter(Boolean)
      .map((descriptor) => descriptor.kind === "rbc-descriptor" ? descriptor : createRbcDescriptor(descriptor));
  } catch (error) {
    return {
      decision: "incompatible",
      reasons: [String(error.message || "invalid RBC descriptor")],
      compatibleRuleKinds: [],
      nonClaims: ["RBC compatibility is observer-relative", "RBC compatibility does not prove global truth"],
      operationKind,
    };
  }

  if (normalizedDescriptors.length < 2) {
    return {
      decision: "incompatible",
      reasons: ["at least two RBC descriptors are required"],
      compatibleRuleKinds: [],
      nonClaims: ["RBC compatibility is observer-relative", "RBC compatibility does not prove global truth"],
      operationKind,
    };
  }

  const nonClaims = baseNonClaims(normalizedDescriptors);
  const required = normalizeList(requiredRuleKinds.length > 0 ? requiredRuleKinds : policy.requiredRuleKinds);
  const common = commonRuleKinds(normalizedDescriptors);
  const allSameId = normalizedDescriptors.every((descriptor) => descriptor.id === normalizedDescriptors[0].id);
  const allSameDigest = normalizedDescriptors.every((descriptor) => descriptor.digest === normalizedDescriptors[0].digest);

  if (allSameId && allSameDigest) {
    return {
      decision: "exact",
      reasons: ["RBC descriptors match by id and digest"],
      compatibleRuleKinds: common,
      nonClaims,
      operationKind,
    };
  }

  if (mutuallyAccept(normalizedDescriptors)) {
    return {
      decision: "compatible",
      reasons: ["RBC descriptors declare mutual compatibility"],
      compatibleRuleKinds: common,
      nonClaims,
      operationKind,
    };
  }

  if (required.length > 0 && required.every((kind) => common.includes(kind))) {
    return {
      decision: "narrow-compatible",
      reasons: ["RBC descriptors are compatible for requested rule kinds only"],
      compatibleRuleKinds: required,
      nonClaims: [...nonClaims, "narrow compatibility is limited to the requested operation"],
      operationKind,
    };
  }

  return {
    decision: "incompatible",
    reasons: ["RBC descriptors do not declare compatible surfaces"],
    compatibleRuleKinds: common,
    nonClaims,
    operationKind,
  };
}

module.exports = {
  createRbcDescriptor,
  computeDemoRbcFingerprint,
  validateRbcCompatibility,
};
