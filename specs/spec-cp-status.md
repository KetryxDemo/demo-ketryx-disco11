---
itemId: spec-cp-status
itemType: Software Item Spec
itemFulfills: NC-13,NC-14
---

# Implant status and patient identity verification

Establishes what is being programmed, and for whom, before a session may proceed.

## Item fields

### Inputs

Implant serial number and battery telemetry. Patient record from the clinical system.

### Behavior

Before a session opens, the programmer displays the implant serial with the associated patient record and requires the clinician to confirm the match. Battery state of charge and estimated remaining service life are displayed in the same step so readiness is a single decision.

### Outputs

A confirmed patient-to-implant binding, or a blocked session.
