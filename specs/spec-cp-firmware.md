---
itemId: spec-cp-firmware
itemType: Software Item Spec
itemFulfills: NC-15
---

# Implant firmware compatibility screening

Governs how the programmer decides whether it is able to program the implant it
has just identified, before any programming session is opened.

## Item fields

### Inputs

The firmware version reported by the implant during identification, and the
programmer's compatibility list.

### Behavior

The compatibility list is a versioned, replaceable artifact rather than a
constant compiled into the programmer, so the set of supported implant firmware
can be revised without reinstalling the application. The reported firmware
version is compared against that list on every identification. A version that is
present in the list allows the session to proceed to authentication and patient
matching. A version that is absent, or a reported version that is missing or
unparseable, halts session establishment: no session is opened, no telemetry
link is left open, and the clinician is told which firmware version was reported
and that it is unsupported.

Compatibility screening runs before authentication and patient matching so that
an unprogrammable implant is rejected without exposing session credentials.

### Outputs

An open programming session for a supported implant, or a refusal carrying the
rejected firmware version.
