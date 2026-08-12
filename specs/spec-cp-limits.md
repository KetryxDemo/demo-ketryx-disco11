---
itemId: spec-cp-limits
itemType: Software Item Spec
itemFulfills: NC-8,NC-9
---

# Amplitude step and ceiling enforcement

Bounds every amplitude adjustment, both per step and against the ceiling the implant reports.

## Item fields

### Inputs

Requested amplitude. Current amplitude. Implant-reported maximum amplitude.

### Behavior

A single adjustment may move amplitude by at most 0.5 mA; a larger request is rejected and the clinician is told why. Independently, any requested value above the implant's configured ceiling is rejected regardless of step size. Both checks run before the confirmation flow, so an out-of-bounds value can never reach a pending state.

### Outputs

An accepted amplitude within bounds, or a rejection with the violated bound named.
