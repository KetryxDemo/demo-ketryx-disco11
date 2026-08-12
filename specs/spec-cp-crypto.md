---
itemId: spec-cp-crypto
itemType: Software Item Spec
itemFulfills: NC-21
---

# Telemetry session cryptography

Establishes the mutually authenticated, encrypted channel that every programming
session runs over.

## Item fields

### Inputs

Programmer device certificate. Implant device certificate presented during the
telemetry handshake.

### Behavior

The programmer and the implant each present a device certificate chaining to the
NeuroCue device CA, and each verifies the other before any application data is
exchanged. Session keys are derived per session and are not reused across
sessions. A handshake that fails verification is abandoned and no telemetry
session is opened, so an unauthorized device within radio range cannot establish
or observe a session.

### Outputs

An encrypted session channel, or an abandoned handshake with the verification
failure recorded.
