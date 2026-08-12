Feature: Third-party component inventory

  @id:ver-soup-bom-published @tests:spec-cp-soup
  Scenario: Released version publishes a bill of materials
    Given a build of the programmer for a released version
    When the build completes
    Then a CycloneDX bill of materials is published for that version
    And every third-party component is listed with a package URL and version
