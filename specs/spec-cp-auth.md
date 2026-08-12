---
itemId: spec-cp-auth
itemType: Software Item Spec
itemFulfills: NC-6,NC-10,NC-23
---

# Clinician authentication and session lifecycle

Controls who may open a programming session and how long that session stays open.

## Item fields

### Inputs

Clinician credentials from the hospital identity provider. Implant identity from the telemetry handshake.

### Behavior

A session is established only after the identity provider returns a valid assertion for a clinician with the Programmer role. An idle timer starts on session establishment and resets on every clinician interaction. At 15 minutes of inactivity the session is closed and the telemetry link is released; resuming requires a fresh authentication.

### Outputs

An open session handle, or a rejection reason surfaced to the clinician.
