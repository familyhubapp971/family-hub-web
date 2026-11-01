# FHR-39, FHR-40, FHR-41: QA bugs on the Assignments tab. Scenario names match
# documents/features/assignments.md character for character.

Feature: Assignments

  As a parent on my phone
  I want to add, fix and remove the family's homework and chores
  so that the list stays true and readable.

  # @authed-local: needs the LOCAL api booted with the E2E_TEST_JWKS override,
  # so these run in the critical config only (see authed-smoke.feature).
  @critical @authed-local
  Scenario: A parent deletes an assignment made by mistake
    Given I am signed in as the admin of a family with something in every area
    And I am on a phone-sized screen for the dashboard
    When I open the Assignments area
    And I edit the assignment "Finish reading"
    Then the open edit form does not scroll sideways
    When I delete it and confirm
    Then the assignment "Finish reading" is no longer listed

  @critical @authed-local
  Scenario: A new assignment cannot be due in the past
    Given I am signed in as the admin of a family with something in every area
    When I open the Assignments area
    And I start a new assignment
    Then the earliest due date I can pick is today

  @critical @authed-local
  Scenario: A long assignment title stays inside its card on a phone
    Given I am signed in as the admin of a family with something in every area
    And I am on a phone-sized screen for the dashboard
    When I open the Assignments area
    And I add an assignment with a 50-character title that has no spaces
    Then the new assignment is listed
    And no area scrolls sideways
