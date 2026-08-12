---
itemId: spec-cp-stim
itemType: Software Item Spec
itemFulfills: NC-7
---

# Stimulation parameter commit and confirmation flow

Governs how a proposed stimulation change is presented, confirmed, and transmitted to the implant.

## Item fields

### Inputs

Proposed amplitude, rate, and pulse width from the programming screen.

### Behavior

A proposed change is held in a pending state and rendered for review with the prior value alongside the new value. No value reaches the implant until the clinician performs an explicit confirmation action. Dismissing the review discards the pending change.

### Outputs

A committed parameter set written to the implant, or a discarded pending change.
