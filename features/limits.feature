Feature: Amplitude step and ceiling enforcement

  @id:ver-limits-step @tests:spec-cp-limits
  Scenario: Single adjustment greater than 0.5 mA is rejected
    Given a current amplitude of 2.0 mA
    When the clinician requests 3.0 mA in one adjustment
    Then the adjustment is rejected
    And the clinician is told the per-step limit was exceeded

  @id:ver-limits-ceiling @tests:spec-cp-limits
  Scenario: Value above the implant ceiling is rejected
    Given an implant reporting a maximum amplitude of 4.0 mA
    When the clinician requests 4.5 mA
    Then the adjustment is rejected
    And the clinician is told the implant ceiling was exceeded
