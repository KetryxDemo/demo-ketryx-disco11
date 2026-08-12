Feature: Clinician authentication and session lifecycle

  @id:ver-auth-login @tests:spec-cp-auth
  Scenario: Session is refused without successful clinician authentication
    Given a clinician who has not authenticated
    When they attempt to open a programming session
    Then the session is refused
    And no telemetry link is established

  @id:ver-auth-timeout @tests:spec-cp-auth
  Scenario: Session terminates after 15 minutes of inactivity
    Given an open programming session
    When 15 minutes pass with no clinician interaction
    Then the session is closed
    And resuming requires a fresh authentication
