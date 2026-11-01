# Feature: Assignments

**Jira:** [FHS-231](https://qualicion2.atlassian.net/browse/FHS-231), [FHS-266](https://qualicion2.atlassian.net/browse/FHS-266), [FHS-310](https://qualicion2.atlassian.net/browse/FHS-310), [FHS-313](https://qualicion2.atlassian.net/browse/FHS-313), [FHR-39](https://qualicion2.atlassian.net/browse/FHR-39), [FHR-40](https://qualicion2.atlassian.net/browse/FHR-40), [FHR-41](https://qualicion2.atlassian.net/browse/FHR-41)
**Status:** shipped
**Owner:** product-manager

One-line: the family's homework and chores list on the parent dashboard.
Parents add, edit, tick off and delete assignments; children see and tick them.

## What shipped

| Thing                  | How it works                                                                                       |
| ---------------------- | -------------------------------------------------------------------------------------------------- |
| Who can change it      | Admins and adults add, edit and delete. Everyone else only views and ticks done.                   |
| Title                  | 1 to 50 characters. Long words wrap inside the card instead of stretching it.                      |
| Notes                  | Up to 300 characters. Shown only in the edit form, not on the card.                                |
| Due date               | Optional. A new date must be today or later, using the device's own date.                          |
| Editing an overdue one | Its past date can stay while other fields change. Picking a new date must be today or later.       |
| Delete                 | A red Delete button in the edit form, behind a "Delete "title"?" confirm step. Permanent, no undo. |

The server applies the same rules. It allows one day of slack on past dates,
because it cannot see the family's time zone.

## User stories

### Story 1: Remove an assignment made by mistake (FHR-41)

**As a** parent
**I want** to delete an assignment I added by mistake
**so that** the list only shows real work.

#### Acceptance criteria

**Scenario: A parent deletes an assignment made by mistake**

- **Given** I am an admin or adult on the Assignments tab
- **When** I edit an assignment, tap Delete and confirm
- **Then** the assignment is gone for everyone in the family

**Scenario: A parent who changes their mind keeps the assignment**

- **Given** I tapped Delete on an assignment
- **When** I tap Cancel in the confirm step
- **Then** the assignment stays on the list

### Story 2: Due dates start today (FHR-40)

**As a** parent
**I want** the due date picker to start at today
**so that** a new assignment is never overdue the moment it is made.

#### Acceptance criteria

**Scenario: A new assignment cannot be due in the past**

- **Given** I am adding a new assignment
- **When** I open the due date picker
- **Then** the earliest date I can pick is today

**Scenario: An overdue assignment can still be edited**

- **Given** an assignment whose due date has passed
- **When** I fix a typo in its title and save
- **Then** it saves and keeps its original due date

### Story 3: Long titles stay readable on a phone (FHR-39)

**As a** parent on my phone
**I want** long titles to stay inside the card
**so that** the list never breaks or scrolls sideways.

#### Acceptance criteria

**Scenario: A long assignment title stays inside its card on a phone**

- **Given** I am on a phone-sized screen
- **When** I add an assignment with a 50-character title that has no spaces
- **Then** the title wraps inside its card and nothing scrolls sideways

## Out of scope

- Overdue and upcoming due dates both show in red. That is a separate bug, not
  part of FHR-40.
- Undo or a trash bin for deleted assignments.
- Existing titles longer than 50 characters stay as they are. They must be
  shortened the next time someone edits them. The edit form says so in plain
  words: "This title is over 50 characters. Shorten it to save."
