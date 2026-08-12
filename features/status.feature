Feature: Implant status and patient identity

  @id:ver-status-serial @tests:spec-cp-status
  Scenario: Programming is blocked until implant serial is confirmed
    Given an implant whose serial has not been confirmed against the patient record
    When the clinician attempts to open a programming session
    Then the session is blocked
    And the clinician is prompted to confirm the patient-to-implant match
