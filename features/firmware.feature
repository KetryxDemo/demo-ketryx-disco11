Feature: Implant firmware compatibility screening

  @id:ver-firmware-unsupported @tests:spec-cp-firmware
  Scenario: Session is refused for an implant running unsupported firmware
    Given an implant reporting firmware version "2.9.4"
    When the clinician attempts to open a programming session
    Then no programming session is opened
    And the clinician is told the implant firmware is unsupported

  @id:ver-firmware-supported @tests:spec-cp-firmware
  Scenario: Session proceeds for an implant on the compatibility list
    Given an implant reporting firmware version "3.3.0"
    When the clinician attempts to open a programming session
    Then the programming session is opened

  @id:ver-firmware-list-update @tests:spec-cp-firmware
  Scenario: Compatibility list is replaced without reinstalling the programmer
    Given an implant reporting firmware version "3.4.0"
    When a compatibility list adding firmware version "3.4.0" is loaded
    And the clinician attempts to open a programming session
    Then the programming session is opened
