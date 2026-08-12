---
itemId: spec-cp-soup
itemType: Software Item Spec
itemFulfills: NC-24
---

# Third-party component inventory and vulnerability screening

Defines how third-party software in the programmer is inventoried and screened
for each released version.

## Item fields

### Inputs

The dependency set resolved at build time for the version under release.

### Behavior

Each build publishes a CycloneDX software bill of materials describing every
third-party component included in the programmer, keyed by package URL and
version. The bill of materials for a version is the record of what shipped.
Components are screened against published vulnerability data, and each
vulnerability affecting a released version carries an impact assessment stating
whether the vulnerability is exploitable in this product and why. Assessments
recorded against a version carry forward to the next version, so review at
release covers the components and vulnerabilities that are new or changed rather
than the entire inventory again.

### Outputs

A published bill of materials for the version, and an impact assessment for each
vulnerability affecting it.
