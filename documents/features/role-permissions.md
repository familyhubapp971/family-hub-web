# Feature: Role & permission model (admin vs normal user)

**Jira:** [FHS-333](https://qualicion2.atlassian.net/browse/FHS-333) (epic)
**Status:** draft
**Owner:** product-manager
**ADR:** [0015: role model: admin vs normal user](../decisions/0015-role-model-owner-flag.md)

Family Hub is multi-tenant, each family is a tenant, and members share one
roster with a `role` (admin / adult / teen / child / guest). Today permission
is a single blunt rule: the member themselves, OR any admin, OR any **adult**
can manage almost anything. In the legacy app there were two kinds of
grown-up: the one **admin** (full rights, including editing a habit sticker on
a previous day) and everyone else, a **normal user**. Multi-tenancy blurred
that line, a non-admin adult now gets admin-only powers, most visibly the
ability to rewrite a past day's stickers.

This feature restores the legacy two-tier model in the tenancy world:
**admin** (full rights) and **normal user** (everyday rights only). The family
registrant is an admin. An admin can make any **non-child** member an admin or
a normal user. Kids (teen/child) are scoped to their own data and can never be
admins. No new role or flag, just a tighter permission boundary plus a
member-management action.

## Rights matrix

Key: ✓ = allowed · ✗ = blocked · **self** = only on their own record/data.
"Normal user" = an adult who is not an admin (`role = 'adult'`).

| Action                                                    | Admin | Normal user | Teen | Child        |
| --------------------------------------------------------- | ----- | ----------- | ---- | ------------ |
| **My World: economy & history**                           |       |             |      |              |
| Log / edit a sticker for today or later this week         | ✓     | ✓           | self | self         |
| Edit a PAST-day sticker (backdate): _the named gap_       | ✓     | ✗           | ✗    | ✗            |
| Close / finalize a week                                   | ✓     | ✗           | ✗    | ✗            |
| Re-open / un-finalize a closed week                       | ✓     | ✗           | ✗    | ✗            |
| Run the rewards shop (redeem current balance)             | ✓     | ✓           | ✗    | self-request |
| Change conversion rate / economy settings                 | ✓     | ✗           | ✗    | ✗            |
| Manually adjust a member's cash balance                   | ✓     | ✗           | ✗    | ✗            |
| **Members & access**                                      |       |             |      |              |
| Invite / add a member                                     | ✓     | ✗           | ✗    | ✗            |
| Set / reset a child PIN                                   | ✓     | ✗           | ✗    | ✗            |
| Edit another member's profile                             | ✓     | ✗           | ✗    | ✗            |
| Make a member an admin / a normal user                    | ✓     | ✗           | ✗    | ✗            |
| Make a child an admin                                     | ✗     | ✗           | ✗    | ✗            |
| Remove / delete a member                                  | ✓     | ✗           | ✗    | ✗            |
| Wipe family data / delete the family                      | ✓     | ✗           | ✗    | ✗            |
| Manage billing / subscription                             | ✓     | ✗           | ✗    | ✗            |
| **Shared content**                                        |       |             |      |              |
| Edit meals / calendar / assignments / noticeboard / tasks | ✓     | ✓           | ✗    | ✗            |
| Edit Journal / Learn entries                              | ✓     | ✓           | self | self         |
| **Self & visibility**                                     |       |             |      |              |
| Edit own profile                                          | ✓     | ✓           | ✓    | ✓            |
| View another member's data                                | ✓     | ✓           | ✗    | ✗            |
| View own data                                             | ✓     | ✓           | ✓    | ✓            |

## Invite roles & the admin-grant safeguard

[ADR 0019](../decisions/0019-role-privilege-matrix.md) formalised who can be
invited as what, and closed a gap: the invite endpoint originally couldn't
create a second admin at all, and the Manage Members badge mislabelled every
non-admin adult as "Parent."

| Role      | Who                                        | Rights                                                                                     |
| --------- | ------------------------------------------ | ------------------------------------------------------------------------------------------ |
| **admin** | Parent / partner (registrant is one)       | Full: everyday + past-date edits, week close, economy settings, member management, billing |
| **adult** | Invited grown-up (grandma, cousin, sitter) | Everyday + current/future-day writes. Not past-date edits, not admin actions               |
| **teen**  | Own PIN login                              | View-only on shared family content; writes only their own kid-scoped data                  |
| **child** | Own PIN login                              | Same as teen: view-only on shared content, writes only their own data                      |
| **guest** | Login, no write rights                     | Read-only everywhere                                                                       |

`POST /api/invitations` accepts `admin | adult | guest` (never `child`: kids
use PIN login, never a magic-link invite). Teens are added via "Add a child",
not invited.

The invite form pre-selects **Parent / partner** (admin) for an admin sender so
inviting a co-parent is one tap ([FHS-524](https://qualicion2.atlassian.net/browse/FHS-524)).
A non-admin never sees that option, so for them the default stays **Adult**:
the admin-grant safeguard is what gates the default, not just the option list.

### Story 4: Invite a second admin, safely

**As an** admin
**I want** to invite another grown-up directly as an admin (a co-parent or
co-guardian) **so that** two parents can both hold full rights from day one,
without a separate promotion step, but only an admin can hand out that power.

#### Acceptance criteria

**Scenario: Admin invites a co-parent as admin**

- **Given** I am an admin sending an invite
- **When** I pick the "Parent / partner" role and send it
- **Then** the invite is created with role `admin`
- **And** once accepted, that person has full admin rights immediately

**Scenario: Non-admin adult cannot invite someone as admin**

- **Given** I am a normal user (adult, not admin) sending an invite
- **When** I try to set the invited person's role to admin
- **Then** the request is rejected with a 403 "admin-only" error
- **And** the invite is not created

**Scenario: The invite role picker matches what's actually granted**

- **Given** I am opening the "Invite an adult" form as a non-admin
- **When** the form renders
- **Then** the "Parent / partner" (admin) option is not shown to me at all
- **And** the roles I can pick (Adult, Guest) are exactly what gets granted on submit

## User stories

### Story 1: Registrant is the admin; admins set who else is admin or normal

**As a** person registering a new family
**I want** to be the admin, and to choose who else is an admin or a normal user
**so that** the family's controls stay with the people I trust.

**Scenario: Registrant becomes an admin**

- **Given** I register a new family and become its first member
- **When** my member record is created
- **Then** my role is `admin`

**Scenario: Admin promotes an adult to admin**

- **Given** I am an admin and Bola is a normal user (adult)
- **When** I make Bola an admin
- **Then** Bola has admin rights

**Scenario: Admin sets an admin back to a normal user**

- **Given** I am an admin and Bola is an admin
- **When** I set Bola to a normal user
- **Then** Bola keeps only normal-user rights

**Scenario: A child cannot be made an admin**

- **Given** I am an admin and Aisha is a child
- **When** I try to make Aisha an admin
- **Then** the request is rejected and Aisha stays a child

### Story 2: Only an admin can do the legacy admin-only actions

**As an** admin
**I want** the sensitive, historical, and irreversible actions limited to admins
**so that** a normal user can't rewrite history or change the family's setup.

**Scenario: Normal user is blocked from editing a past-day sticker**

- **Given** I am a normal user (adult, not admin)
- **When** I try to change a sticker on a day before today
- **Then** the request is rejected with a 403 "admin-only" error
- **And** the past-day edit control is not shown to me

**Scenario: Admin edits a past-day sticker**

- **Given** I am an admin
- **When** I change a past-day sticker
- **Then** the change is saved with my member id and a timestamp

**Scenario: Normal user keeps everyday actions**

- **Given** I am a normal user
- **When** I log/edit a current-week sticker or edit meals/calendar/tasks
- **Then** the change is saved

**Scenario: Normal user is blocked from setup + destructive actions**

- **Given** I am a normal user
- **When** I try to change a conversion rate, remove a member, or wipe data
- **Then** the request is rejected with a 403 "admin-only" error

### Story 3: Children and teens cannot escalate their own access

**As a** parent
**I want** children and teens to be unable to grant themselves powers
**so that** the family's controls stay with the adults.

**Scenario: Child attempts to make themselves an admin**

- **Given** I am signed in as a child (PIN login)
- **When** I send a request to set my own role to admin
- **Then** the request is rejected with a 403 "forbidden" error
- **And** my record is unchanged

**Scenario: Teen attempts to change another member's role**

- **Given** I am signed in as a teen
- **When** I try to change a sibling's role
- **Then** the request is rejected with a 403 "forbidden" error

### Story 5: The Assignments and Noticeboard tabs don't offer buttons they'll refuse

**As a** guest, teen, or child who somehow lands on the Assignments or
Noticeboard tab
**I want** to see only the controls I'm actually allowed to use
**so that** I never tap "Add" or "Edit" only to be told no by an error message.

Only **admin** and **adult** may add, edit, or (on the Noticeboard) delete;
everyone else is read-only, per the rights matrix above. Before FHS-313 the
buttons showed for every caller and only the API's 403 stopped the action.
FHS-313 hides the buttons up front, using the same `callerRole` the API
already returns from `GET /api/members`.

#### Acceptance criteria

**Scenario: A non-write caller sees no Add or Edit button**

- **Given** I open the Assignments tab or the Noticeboard tab as a guest
  (or, defensively, a teen or child)
- **When** the tab finishes loading
- **Then** I do not see an "Add" / "Post" button
- **And** I do not see an "Edit" pencil on any row or card
- **And** on the Noticeboard, I do not see a "Delete" button either

**Scenario: An admin or adult still sees the full controls**

- **Given** I open either tab as an admin or an adult
- **When** the tab finishes loading
- **Then** I see the "Add" / "Post" button and the "Edit" control on each row

**Scenario: Saving an edit whose row was deleted elsewhere**

- **Given** I am an admin or adult with the edit form open for an assignment
  or notice
- **And** someone else deletes that same row while I'm editing it
- **When** I press Save/Update and the server returns a 404
- **Then** the list refreshes and the now-deleted row disappears from it
- **And** I see a plain-language message telling me it was removed elsewhere,
  not a generic "server returned 404" error

### Story 6: The profile menu only offers doors you can walk through

**As** any grown-up in the family
**I want** the menu to show me the pages I can actually use
**so that** I never open one and find every control closed to me.

Shipped in [FHS-625](https://qualicion2.atlassian.net/browse/FHS-625). Splitting
the old Admin Panel into three pages ([FHS-621](https://qualicion2.atlassian.net/browse/FHS-621))
removed the blanket redirect that had been hiding this: the panel bounced every
non-admin off the whole page, so nobody ever saw a door they could not use.
Three separate pages have no such blanket, and the menu was showing all four
doors to everyone.

The dividing line is **whether the action can be undone**:

| Door            | Who sees it   | Why                                                                     |
| --------------- | ------------- | ----------------------------------------------------------------------- |
| Kids money      | admin + adult | Moving a child's money is reversible, and the server allows it          |
| Earning rules   | admin + adult | Readable by all, changeable by admins, and it says so on screen         |
| Manage family   | admin + adult | An adult can set a kid's PIN even though only an admin can add a member |
| Family settings | admin only    | Every control behind it (name, currency, export, delete) is admin-only  |

**What shipped, and what deliberately did not:**

- The server's rules were **not changed**. They were already right (see the
  rights matrix above); the app was the thing lying about them. Widening or
  narrowing the adult tier is a product decision, deliberately left alone.
- **Kids money now admits any grown-up.** It had inherited the Admin Panel's
  admin-only redirect, which locked adults out of money moves the server has
  always allowed them. This is the one behaviour change in the ticket.
- **Family settings keeps its admin-only redirect.** Unlike Earning rules,
  there is nothing on it for a non-admin to read, so there is no read-only
  view to fall back to.
- Both predicates live in `shared-rules` (family-hub-api) (`isGrownUpRole`,
  `isFamilyAdminRole`) and are pinned to the API's own `canManage` / `isAdmin`
  by `tests/unit/shared/family-permissions.test.ts`, so the menu cannot drift
  from what the server enforces.

#### Acceptance criteria

**Scenario: A door only shows if it leads somewhere**

- **Given** I am an adult who is not an admin
- **When** I open the profile menu
- **Then** I see Kids money, Earning rules and Manage family
- **And** I do not see Family settings, where every control is closed to me

**Scenario: Reading without changing is explained**

- **Given** I am an adult who is not an admin
- **When** I open Earning rules
- **Then** I see the current figures
- **And** one plain line tells me only an admin can change them

**Scenario: The browser is never the gate**

- **Given** someone calls a money or settings endpoint directly, without the app
- **When** their role does not allow it
- **Then** the server refuses with 403, whatever the browser would have shown

**Scenario: A grown-up can still move a child's money**

- **Given** I am an adult who is not an admin
- **When** I open Kids money
- **Then** the page loads and I can bank, invest and cash out for a child
- **And** I am not offered the week controls, which are admin-only

## Story → ticket map

| Story                                                                              | Ticket                                                     | Points |
| ---------------------------------------------------------------------------------- | ---------------------------------------------------------- | ------ |
| Onboarding registrant is admin; admins set members admin/normal (never a child)    | [FHS-334](https://qualicion2.atlassian.net/browse/FHS-334) | 5      |
| Legacy admin-only actions are admin-only (past-day stickers, economy, destructive) | [FHS-335](https://qualicion2.atlassian.net/browse/FHS-335) | 5      |
| Centralize the admin check + hide admin-only UI + child-can't-be-admin guard + RLS | [FHS-336](https://qualicion2.atlassian.net/browse/FHS-336) | 5      |
| The profile menu only offers doors you can walk through                            | [FHS-625](https://qualicion2.atlassian.net/browse/FHS-625) | 5      |

(The earlier owner-tier stories FHS-337/338/339 were cancelled when the model
was simplified.)

## Out of scope

- A separate "owner / super user" tier (the earlier, abandoned design).
- Custom / per-family permission editing, fixed two-tier model only.
- Per-surface granular delegation (e.g. "meals admin" vs "calendar admin").
- A browsable audit-log viewer, sensitive edits record who/when, but the
  history screen is a later ticket.

## Open questions

- Should an admin be able to remove **guests** specifically, or are guests
  out of scope for now?
- Member removal, soft-delete (keep history) or hard-delete?
- Is there ever a case for a normal user (adult) closing a week, or is that
  firmly admin-only? (Currently admin-only.)

## Success metrics

- 0 non-admin past-day sticker edits succeed after rollout (server logs).
- The family registrant is an admin in 100% of new sign-ups.
- 0 children/teens ever hold an admin role (continuous invariant).
