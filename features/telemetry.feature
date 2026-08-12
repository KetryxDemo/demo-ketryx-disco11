Feature: Telemetry link supervision

  @id:ver-telem-abort @tests:spec-cp-telem
  Scenario: Parameter change aborts within 2 seconds of link loss
    Given an in-progress parameter change
    When the telemetry link is lost
    Then the change is aborted within 2 seconds
    And the implant retains its last committed parameter set
