Feature: Stimulation parameter commit

  @id:ver-stim-confirm @tests:spec-cp-stim
  Scenario: Amplitude is not transmitted without explicit confirmation
    Given a proposed amplitude of 2.0 mA
    When the clinician does not confirm the change
    Then no value is transmitted to the implant
    And the pending change is discarded
