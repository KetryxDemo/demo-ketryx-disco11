---
itemId: spec-cp-telem
itemType: Software Item Spec
itemFulfills: NC-12
---

# Telemetry link supervision and abort handling

Watches the implant telemetry link and aborts in-flight changes when it drops.

## Item fields

### Inputs

Link keepalive from the implant radio.

### Behavior

The link is supervised continuously while a session is open. On loss of keepalive, any in-progress parameter change is aborted within 2 seconds and the implant is left on its last committed parameter set. The clinician is shown the aborted state explicitly rather than a silent failure.

### Outputs

An abort event, and the retained last-known-good parameter set.
