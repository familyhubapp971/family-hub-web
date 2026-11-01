# Feature: Family members

**Jira:** [FHS-1](https://qualicion2.atlassian.net/browse/FHS-1) (schema) · [FHS-513](https://qualicion2.atlassian.net/browse/FHS-513)/[FHS-485](https://qualicion2.atlassian.net/browse/FHS-485)/[FHS-486](https://qualicion2.atlassian.net/browse/FHS-486)/[FHS-514](https://qualicion2.atlassian.net/browse/FHS-514)/[FHS-520](https://qualicion2.atlassian.net/browse/FHS-520)/[FHS-521](https://qualicion2.atlassian.net/browse/FHS-521) (Manage Family redesign) · [FHS-519](https://qualicion2.atlassian.net/browse/FHS-519) (Manage Family follow-up cleanups) · FHR-29/FHR-30/FHR-31 (phone layout fixes, 2026-10-28) · [FHS-715](https://qualicion2.atlassian.net/browse/FHS-715) (Private family code: the Kids' sign-in card)
**Status:** shipped, member data model + the Manage Family page
**Owner:** product-manager
**ADR:** [0015](../decisions/0015-role-model-owner-flag.md), [0019](../decisions/0019-role-privilege-matrix.md)

> **Note (roles):** the real member role enum is `admin | adult | teen |
child | guest` (ADR 0015/0019). Earlier drafts of this doc referenced a
> `guardian`/`grandparent` role that was never built, a grandparent or
> nanny is added today as `adult` (helps day-to-day) or `guest` (read-only).
>
> **Note (Part 1 vs Part 2):** Part 1 below is the **original pre-Sprint-1
> design brief**, it captured the family shapes the schema needed to
> support (twins, blended families, multi-generational households) before
> any table existed. Some of its ideas were never built as literal columns:
> there is no `birth_rank` or `multiple_birth_group_id` field, and the role
> names shipped as `admin | adult | teen | child | guest`, not
> `parent | child | guardian | other`. **Part 2** describes what actually
> shipped (the real `/t/:slug/members` "Manage Family" page) and is the
> one to read for current behaviour.

The model for "who is in this family". Captures parents, children, and
other adults living in the household (grandparents, nannies, guardians).
Designed up-front to handle real-world family shapes that single-child
schemas trip over: twins, triplets, blended families, multi-generational
households.

This doc exists _before_ the Sprint 1 schema work to lock in the shape
the data model has to support. The implementation lives under FHS-1
(epic) once Sprint 1 starts.

## User stories

### Story 1: Add a family member

**As a** parent (signed-in account holder)
**I want to** add a person to my family, child, partner, parent,
guardian, or helper
**so that** the rest of the app (tasks, calendar, milestones) can
reference them.

#### Acceptance criteria

**Scenario: Parent adds a child with a unique name**

- **Given** I am signed in and on my family's setup page
- **When** I add a child named "Aisha" with date of birth 2020-03-12
- **Then** Aisha appears in my family roster
- **And** her role is "child"
- **And** her record has its own stable id (not derived from name + birthday)

**Scenario: Parent adds a second adult to the household**

- **Given** I am signed in
- **When** I add my partner with their email
- **And** I assign the role "parent"
- **Then** they receive an invite to claim a Supabase login
- **And** until they accept, their row exists with `auth_user_id = NULL`

**Scenario: Parent adds a non-parent adult**

- **Given** I am signed in
- **When** I add a household member with role "guardian" (e.g. nanny, grandparent)
- **Then** the member appears with the correct role label
- **And** their permissions are scoped per the role's defaults (Sprint 2)

### Story 2: Add twins, triplets, or higher-order multiples

**As a** parent of twins (or triplets, etc.)
**I want to** add each child as their own person with the same date of
birth and similar names
**so that** I can assign tasks, log milestones, and see schedules per
individual without the system collapsing them into one row.

#### Acceptance criteria

**Scenario: Parent adds twins born on the same day**

- **Given** I am signed in
- **When** I add "Bilal" with date of birth 2022-08-01
- **And** I add "Bashir" with date of birth 2022-08-01
- **Then** both children appear as separate rows in the roster
- **And** the system does **not** flag a duplicate-birthday error
- **And** each has their own stable id

**Scenario: Parent records birth order for twins**

- **Given** I have just added Bilal and Bashir
- **When** I mark Bilal as "first-born" and Bashir as "second-born"
- **Then** the system records `birth_rank: 1` for Bilal and `birth_rank: 2` for Bashir
- **And** the family roster shows them in birth-order
- **And** the `birth_rank` field is optional (cultures where it doesn't
  matter can leave it null)

**Scenario: Parent groups a set of multiples**

- **Given** I have added triplets, Sara, Mira, Lina (all born 2021-05-04)
- **When** I mark them as a multiple-birth set
- **Then** they share a `multiple_birth_group_id`
- **And** the family timeline can render their first-birthday as a single
  shared event ("Sara, Mira, Lina turn 1")
- **And** I can still address each child individually for tasks and milestones

**Scenario: Parent adds children with the same first name**

- **Given** I have a child named "Mohammed" already
- **When** I add another child also named "Mohammed" (e.g. step-child
  joining a blended family)
- **Then** the system accepts the addition without error
- **And** the UI disambiguates them by `display_name` (e.g. "Mohammed
  (Sr)" / "Mohammed (Jr)") or by a parent-supplied nickname
- **And** task assignments to "Mohammed" surface a picker, never a silent
  guess

### Story 3: Blended and multi-generational families

**As a** parent in a blended family (step-children, foster, joint
custody)
**I want** the membership model to recognise relationships beyond
"biological child of two parents"
**so that** my real household shape can be represented without forcing
fictional parentage.

#### Acceptance criteria

**Scenario: Family has more than two parents**

- **Given** the family has my partner and me, plus a co-parent from a
  previous relationship who shares custody
- **When** the co-parent is added with role "parent"
- **Then** the family supports three parent rows without a "max two
  parents" constraint
- **And** all three parents see the same shared roster, calendar, tasks
  (the per-role visibility rules land in Sprint 2)

**Scenario: Grandparent lives in the household**

- **Given** my mother lives with us and helps with the kids
- **When** I add her with role "guardian" (or future role "grandparent")
- **Then** she appears in the roster with that role
- **And** she can be assigned to tasks (e.g. "school pickup") just like
  any other adult

**Scenario: Step-child has their own auth account, joins multiple families**

- **Given** my partner's child has their own Supabase login
- **And** they are also a member of their other parent's family
- **When** I add them to my family with role "child"
- **Then** the same `auth.users` row references two `family_members`
  rows (one per family), Sprint 2 multi-family support
- **And** in _my_ family, they show up under my roster
- **And** in their other parent's family, they show up there too

### Story 4: Children gain their own login as they grow

**As a** child who has reached an age where I can have my own account
**I want to** claim my place in my family without my parent having to
recreate my history
**so that** task history, milestones, and references to me persist
through the transition.

#### Acceptance criteria

**Scenario: Child claims their auth account**

- **Given** I am a child whose parent created my row at age 4 (no login)
- **When** I am old enough and my parent invites me to claim a login
- **Then** I sign up via Supabase with my email
- **And** the existing `family_members` row gets `auth_user_id` populated
- **And** every historical task, milestone, photo previously assigned to
  me remains attached to the same id (no dangling references)

## Part 2: the Manage Family page (shipped)

`/t/:slug/members` is where an admin sees the whole household, split into two
collapsible groups, **Grown-ups** (sign in with email) and **Kids** (sign in
with a PIN), invites new grown-ups, adds new kids, and manages each person's
name, PIN, admin rights, or removal.

### Story 5: See the household at a glance

**As a** family member **I want** to see who's in my family, grouped by how
they sign in **so that** I understand the household shape at a glance.

**Scenario: Members are grouped into Grown-ups and Kids**

- **Given** I open Manage Family
- **Then** I see a "Grown-ups" section (admin/adult/guest, "Sign in with email")
- **And** a "Kids" section (child/teen, "Sign in with a PIN")
- **And** each section starts collapsed, showing just its count, until I expand it

**Scenario: Header shows a live member + pending count**

- **Given** my family has 4 active members and 1 person invited but not signed up
- **Then** the header reads "The {Name} Family" and "4 members · 1 waiting to join"

**Scenario: A group with nobody in it shows a placeholder, not a gap (FHS-519)**

- **Given** my family has grown-ups but no kids yet (or the reverse)
- **Then** the empty group shows a short placeholder ("No kids yet" /
  "No grown-ups yet") instead of just disappearing from the page

### Story 6: Get my kids signed in on their tablet

**As a** grown-up **I want** our family code and plain steps for the kids'
tablet **so that** my kids can sign in without me typing an address.

**Scenario: The Kids' sign-in card shows the family code (FHS-715)**

- **Given** I am a grown-up (admin, adult or guest) on Manage Family
- **Then** a "Kids' sign-in" card shows our family code in big letters, like e29b-41d4, with a "Copy" button
- **And** three steps: "1. On the kids' tablet, open Family Hub." "2. Tap "I'm a Kid"." "3. Type this code. Done, it's never asked again."
- **And** our address with the family name at the end, like fhapp.up.railway.app/t/e29b-41d4/the-smith-family

**Scenario: Hand this tablet to the kids (FHS-715)**

- **Given** I am on Manage Family on the tablet the kids will use
- **When** I tap "Hand this tablet to the kids"
- **Then** the tablet remembers our family for kid sign-in
- **And** I am signed out of this tablet only (my phone stays signed in)
- **And** the kid sign-in for our family opens, showing the kids' faces

**Scenario: Signing out of the tablet fails**

- **Given** the tablet has no signal when I tap "Hand this tablet to the kids"
- **Then** I stay on Manage Family and see "We couldn't sign you out of this tablet. Check your signal and try again."

Notes on what shipped:

- The card replaced the collapsible "How your kids sign in" card, whose link
  carried the family's surname. The card is always open, since the code is the
  one thing a grown-up comes here for.
- Kids (and anyone not a grown-up) never see the card.
- The card stacks on phones, with the button under the address; from 1024px
  the code sits beside the steps. The Copy button drops under the code on the
  narrowest phones rather than squeezing it. The code and Copy button are the
  design system's `CopyCode` piece.

### Story 7: Invite an adult or add a child

**As an** admin **I want** two purpose-built forms, one for grown-ups, one
for kids **so that** the right fields show for each kind of person.

**Scenario: Invite an adult sends an email sign-in link**

- **Given** I am an admin opening "Invite an adult"
- **When** I enter a name + email and pick a role (Parent/partner, Adult, Guest)
- **Then** only an admin can see/select "Parent / partner" (admin), see
  [role-permissions.md](role-permissions.md) for the server-side safeguard
- **And** on submit they appear under "Waiting to join" until they accept

**Scenario: Add a child needs no email**

- **Given** I am an admin opening "Add a child"
- **When** I enter a name and pick "Child" or "Teen"
- **Then** the member is created immediately (no invite) and appears under
  "Kids" with "No PIN yet" until I set one

### Story 8: Manage an existing member

**As an** admin **I want** to edit a name, set/reset a PIN, grant/remove admin,
or remove someone **so that** the roster stays accurate.

**Scenario: Toggle another grown-up's admin rights**

- **Given** I am an admin viewing another admin/adult's card
- **When** I flip their "Admin" switch
- **Then** their role changes between admin and adult
- **And** the switch is disabled ("The last admin cannot be removed") when they
  are the family's only admin

**Scenario: An admin cannot demote themselves (FHS-519)**

- **Given** my family has a second admin, so I am not the last admin
- **When** I flip my OWN "Admin" switch off
- **Then** the switch is not client-side blocked (a second admin exists,
  so the last-admin rule doesn't apply)
- **And** the server rejects the change with "ask another admin to remove
  your admin access", shown as an inline error on the page

**Scenario: A seat waiting to join can't be made admin yet (FHS-278/FHS-519)**

- **Given** I am an admin viewing an invited adult/parent under "Waiting to
  join" (they haven't signed up yet)
- **Then** I see a disabled "Admin" switch with the caption "Available once
  they sign up"
- **And** a guest-role invite never shows the switch at all (guests are
  never admin-eligible)

**Scenario: Set or reset a kid's PIN**

- **Given** I am an admin viewing a child/teen card
- **When** I choose "Set PIN", enter and confirm 4 matching digits, and save
- **Then** the PIN is saved; a mismatch or non-4-digit entry is rejected inline
- **And** the card says "{name} is ready. On the kids' tablet, type {code}." with our family code (FHS-715)
- **And** removing a kid's login does not show that line

### Story 9: Reach family-wide settings from the profile menu

**Scenario: Profile menu lists children, Manage family, Reward settings, Log out**

- **Given** I open the profile menu from any dashboard page
- **Then** I see each child with a "View World →" link into their world
- **And** "Manage family" and "Reward settings" (edits admin-only server-side,
  see [reward-economy.md](reward-economy.md)), with "Log out" at the bottom

### Phone layout fixes (FHR-29, FHR-30, FHR-31)

**Scenario: The remove question fits the card on a phone (FHR-29)**

- **Given** an admin on a 320px or 375px phone
- **When** they tap the bin on a child's card
- **Then** "Remove [name]? (their tasks & meals go too)" wraps inside the card, with Keep beside it

**Scenario: Editing a name shows one set of buttons (FHR-30)**

- **Given** an admin taps "Edit name" on any card
- **Then** "Edit name" hides while the New name box with Save and Cancel is open
- **And** it comes back after Save or Cancel

**Scenario: Card buttons share a row on phones (FHR-31)**

- **Given** a grown-up card ("Edit name", "Change email") or a kid card ("Edit name", "Set PIN" or "Reset PIN")
- **When** viewed on a phone
- **Then** the two main buttons sit side by side in equal halves, with the bin below
- **And** the page uses narrower side margins on phones so cards get more room

## Out of scope

- **A grown-up changing their sign-in email** (FHS-510), shipped as a
  self-serve flow on their own card only; see
  [change-email.md](change-email.md) for the full behaviour.
- **Schema implementation**: lives under FHS-1 (Tenant Foundation
  epic) when Sprint 1 starts. This doc only constrains what the schema
  must support.
- **Per-role permissions**: task visibility, calendar editing rights,
  who can invite a new member, Sprint 2.
- **Custody / legal flags**: court-ordered visitation calendars,
  restricted-access flags. Backlog; needs legal review before design.
- **Pets**: out of scope for the foundation. Could be added as a `role`
  later if user research surfaces strong demand.

## Open questions

- **Role taxonomy.** Starting set: `parent` / `child` / `guardian` /
  `other`. Do we need `grandparent` as a distinct role, or is
  `guardian` enough? Decide in Sprint 1 schema review.
- **Birth rank presentation.** Some cultures (East Asian, Middle Eastern,
  African) assign meaningful seniority to birth order; others don't.
  Default UI: hide `birth_rank` unless the family explicitly enables
  it. Confirm during user research.
- **Display-name vs legal-name.** Probably split, legal_name for
  records (school, healthcare integrations later), display_name for
  the app UI. Validate with a few real families before locking the
  field shape.
- **Identity continuity across families.** A step-child who exists in
  two families: does the app surface that to the parent (e.g. "this
  child also has a calendar in their other parent's family")? Privacy
  question, answer in Sprint 2 alongside multi-family work.

## Success metrics

- **Coverage:** >= 95 % of beta households can model their real
  composition without a workaround (post-Sprint 2 user survey).
- **No data loss on transitions:** when a child claims an auth login,
  100 % of pre-existing assignments / milestones / photos remain
  attached.
- **Twin/triplet error rate:** zero "duplicate child" errors reported
  by twin/triplet families in their first 30 days.
- **Blended-family adoption:** at least 10 % of paying customers in
  Year 1 self-identify as blended/multi-generational households,
  proves the model isn't just nuclear-family-coded.

## Implementation notes for Sprint 1 schema design

These are non-binding hints to the dev who designs the actual tables:

- **One table for everyone.** A single `family_members` table, rows
  for parents, children, guardians, others, keyed on a UUID, with a
  `role` enum and an optional `auth_user_id` foreign key. Avoid a
  separate `children` table; that path makes joins worse and forces
  awkward migrations when a child grows up and gets a login.

- **No accidentally-unique constraints.** Specifically:

  - `(family_id, first_name)` should NOT be unique, twins, blended families.
  - `(family_id, date_of_birth)` should NOT be unique, twins, triplets.
  - `(family_id, last_name)` should NOT be unique, single-parent + biological-father separate surnames.

- **Optional disambiguators.** Add nullable `birth_rank: int` and
  `multiple_birth_group_id: uuid` for the twins/triplets cases. Both
  default to NULL so they don't clutter single-child families.

- **Per-tenant RLS.** Inherits from ADR 0001, every row carries
  `tenant_id` (a.k.a. `family_id`); RLS policies prevent cross-family
  reads. The user-mirror `users` table stays global (a single auth
  identity belongs to multiple families).
