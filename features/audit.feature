Feature: Parameter change audit log

  @id:ver-audit-entry @tests:spec-cp-audit
  Scenario: Committed change writes a complete audit entry
    Given an authenticated clinician
    When they commit an amplitude change from 2.0 mA to 2.5 mA
    Then an audit entry records the prior value, the new value, the timestamp, and the clinician identity
