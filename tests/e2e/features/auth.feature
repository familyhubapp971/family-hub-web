# Scenario names here MUST match scenarios in docs/features/auth.md
# character-for-character. This is the Jira AC ↔ test traceability
# contract. See /CLAUDE.md "E2E: Playwright + playwright-bdd".

Feature: Auth

  As a prospective Family Hub member
  I want to sign in with a magic link or Google OAuth (no password)
  so that I can use the app without remembering credentials.

  # FHS-224 retired the password signup scenario. The hermetic
  # equivalents now live in signup.feature (signup form behaviour) +
  # verify-email.feature (post-submit confirmation). Scenario 1 below
  # is the legacy /me vertical slice (FHS-196) which still uses the
  # synthetic e2e account; it stays out of @critical because it signs in
  # on the real staging sign-in service over the network (FHS-700).

  # FHS-196: Vertical-slice check. Signs in with the dedicated
  # synthetic e2e@familyhub.test account, then visits /me and asserts
  # the api-rendered greeting matches the signed-in email.
  Scenario: Signed-in user sees their email greeting on /me
    Given I am signed in with the e2e test account
    When I navigate to /me
    Then I see a greeting with my email
    And my user id and account-creation timestamp are visible
