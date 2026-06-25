# Segment Compatibility

Continuity can grow without bound. Segment compatibility lets an observer or RBC declare how much source history is required before a topology operation can be considered locally compatible.

Supported policy modes:

- `full`: the source continuity must be available for full replay.
- `checkpoint`: a valid admitted checkpoint may satisfy bounded compatibility.
- `seed`: a valid continuity seed may satisfy bounded compatibility.
- `happenings`: the last bounded number of happenings may satisfy compatibility.

Bounded modes always carry a non-claim: bounded compatibility is not full history proof. This is intentional. Compatibility depth is observer/RBC-relative, and some domains do not need ancient history to admit a local operation.

Storage or substrate availability does not decide compatibility. The kernel validates candidate continuity material against the policy, while domain adapters decide what state, surfaces, and reducer outputs matter.
