# Continuity Topology

The topology layer adds bounded primitives for relating continuities without implementing a generic merge.

Doctrine:

- Join is not merge.
- Bridge is not merge.
- Mount is not absorption.
- Blend candidate is not causal proof.
- RBC decides compatibility from the observer's perspective.
- Domain adapters decide what counts as a surface, overlap, conflict, or valid resolution.

## Bridge / portal

A bridge connects explicit endpoints. A closet in continuity A can connect to a garage in continuity B. By default, only declared endpoints are validated unless the observer/RBC supplies segment policies that require bounded or full history checks. Passing through the bridge still requires RBC admission.

## Mount / nesting

A mount places a child continuity inside a bounded parent surface. For example, a town continuity can mount a house continuity into lot 7. The parent does not rewrite child history, and the child does not overwrite parent surface claims without admission.

If lot 7 already contains a tree and the child house claims the same footprint, the domain rulebook should return a conflict report. The kernel normalizes and carries that report; it does not understand spatial semantics.

## Repo/plugin mount

A parent repo can mount a plugin repo at `/plugins/pluginB`. If both continuities claim `/plugins/pluginB/index.js`, the repo-domain rulebook should produce an overlap report. The kernel does not know file semantics.

## Video clip mount

A main video continuity can mount a clip continuity at a timeline range. If a layer and range are already occupied, the video-domain rulebook should produce a conflict report. The kernel does not know timeline semantics.

## Overlap and conflict reports

Overlap checks are delegated to rulebooks. A conflict report is not resolution and does not prove either claim globally true.

## Experimental blends

A blend candidate is a referent that says multiple continuities may produce a new combined admitted surface after RBC compatibility, segment compatibility, and conflict checks. It is not automatic merge, does not concatenate histories, and does not infer retroactive causality.

## Reserved event kinds

The topology layer currently admits local happenings for `continuity-bridge-admitted`, `continuity-mount-admitted`, and `blend-candidate-admitted`.

`segment-compatibility-admitted` is reserved for a future explicit segment-compatibility admission flow. Current segment compatibility helpers validate policy and return diagnostics; they do not append a segment event.
