---
itemId: spec-cp-audit
itemType: Software Item Spec
itemFulfills: NC-11,NC-22
---

# Parameter change audit log

Records every committed parameter change in a form that can be reconstructed later.

## Item fields

### Inputs

Committed parameter changes. Authenticated clinician identity. Session metadata.

### Behavior

Each committed change appends an entry capturing the parameter, its prior value, its new value, a timestamp, and the identity of the clinician who confirmed it. Entries are append-only for the life of the session.

### Outputs

An ordered audit log for the session.
