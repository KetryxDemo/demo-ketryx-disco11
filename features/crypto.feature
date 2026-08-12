Feature: Telemetry session cryptography

  @id:ver-crypto-handshake @tests:spec-cp-crypto
  Scenario: Handshake without a valid device certificate is abandoned
    Given an implant presenting a certificate that does not chain to the device CA
    When the programmer performs the telemetry handshake
    Then the handshake is abandoned
    And no telemetry session is opened

  @id:ver-crypto-session-keys @tests:spec-cp-crypto
  Scenario: Session keys are not reused across sessions
    Given two consecutive programming sessions with the same implant
    When session keys are derived for each
    Then the two session keys differ
