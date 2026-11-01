import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { ensureReaderFunctions, getE2eDb, schema } from './db.js';
import { liveWeekStart, previousWeekStart } from './seed-week-anchor.js';

// FHS-516: seed one small, fully-isolated family per test. Every test that
// uses the `authedFamily` fixture gets its own tenant + admin user + child
// member + habit with randomised slug/email, so parallel workers never
// collide on the unique `tenants.slug` / `users.email` constraints. The
// tenant row's `onDelete: 'cascade'` FKs mean deleting it (cleanupFamily)
// removes every child row (members, habits, ...) in one statement.

export interface SeededFamily {
  tenantId: string;
  slug: string;
  tenantName: string;
  /** Matches the JWT `sub` the fixture mints, see support/fixtures.ts. */
  userId: string;
  email: string;
  adminMemberId: string;
  childMemberId: string;
  personaNames: PersonaNames;
  childMemberName: string;
  habitId: string;
  /** The child's OPEN week. The seed also creates a finished week before it,
   *  which already carries its own recorded action, so anything counting
   *  actions must scope to this id. */
  liveWeekId: string;
  /** Only present when seeded with `withPersonas`. */
  personas?: SeededPersonas;
}

/**
 * FHS-645: the extra people a role journey needs. Kept off the default seed
 * because a second adult and a teen change the member count and the number of
 * children, which the specs written against the minimal family assert on.
 */
export interface SeededPersonas {
  adultMemberId: string;
  adultUserId: string;
  adultEmail: string;
  teenMemberId: string;
  /** The 4-digit PIN seeded on BOTH the child and the teen. */
  pin: string;
}

export interface PersonaNames {
  admin: string;
  adult: string;
  child: string;
  teen: string;
}

function buildPersonaNames(suffix: string): PersonaNames {
  return {
    admin: `E2E Admin ${suffix}`,
    adult: `E2E Adult ${suffix}`,
    child: `E2E Kid ${suffix}`,
    teen: `E2E Teen ${suffix}`,
  };
}

/** The 4-digit PIN seeded on the child and the teen under `withPersonas`. */
const SEEDED_PIN = '1234';

function shortId(): string {
  return randomUUID().slice(0, 8);
}

export interface SeedFamilyOptions {
  /**
   * FHS-638: anchor the live week so that TODAY is its last day, whatever day
   * that is.
   *
   * The My World board only offers "Close Week" from the week's last day
   * onward, so a spec that taps it against the default seed passes on Sundays
   * and fails the rest of the week. Anchoring the week to today removes the
   * calendar from the test, the same trick FHS-608 already uses to date its
   * finished week.
   *
   * Dates are computed in LOCAL time on purpose: the board compares local
   * dates, and the browser and this process share a machine, so local-to-local
   * is the comparison that cannot drift by a day near midnight.
   */
  weekEndsToday?: boolean;
  /**
   * FHS-645: also seed a second adult (own user + `adult` member) and a
   * PIN-enabled teen, and give the child the same PIN. Needed by any spec
   * that drives the app as somebody other than the admin.
   */
  withPersonas?: boolean;
  /**
   * FHS-645: put one real row behind every parent dashboard tab (meal, event,
   * assignment, notice, task, journal entry, learning progress and a waiting
   * reward request) so a spec can tell a loaded tab from an empty one.
   */
  withContent?: boolean;
  /**
   * FHS-646: give the child this many unallocated stickers in the LIVE week,
   * which is what "ready to spend" counts. Off by default: the money row and
   * close-week specs assert against a child with nothing spendable.
   *
   * Max 7. `habit_stickers_unique` is (tenant, member, habit, week, day), so
   * one habit can hold one sticker per day and no more.
   */
  earnedStickers?: number;
}

export async function seedFamily(options: SeedFamilyOptions = {}): Promise<SeededFamily> {
  // The api pushes schema on boot but never creates the SECURITY DEFINER
  // reader functions GET /api/me needs, apply them once before seeding so
  // authed pages resolve the family name (not the "Your family" fallback).
  await ensureReaderFunctions();
  const db = getE2eDb();
  const suffix = shortId();
  const slug = `e2e-${suffix}`;
  const tenantName = `E2E Test Family ${suffix}`;
  const userId = randomUUID();
  const email = `e2e-${suffix}@example.invalid`;
  const adultUserId = randomUUID();
  const adultEmail = `e2e-adult-${suffix}@example.invalid`;
  const personaNames = buildPersonaNames(suffix);

  const [tenant] = await db
    .insert(schema.tenants)
    .values({ slug, name: tenantName, timezone: 'UTC', currency: 'USD' })
    .returning({ id: schema.tenants.id });
  if (!tenant) throw new Error('seedFamily: tenant insert returned no row');

  // Mirrors what authMiddleware's getOrCreateUser would do on first
  // request, pre-inserting it here lets `members.user_id` FK to it
  // immediately. The middleware's own upsert on the first authenticated
  // request is a no-op refresh against this same row (idempotent).
  await db.insert(schema.users).values(
    options.withPersonas === true
      ? [
          { id: userId, email },
          { id: adultUserId, email: adultEmail },
        ]
      : [{ id: userId, email }],
  );

  const [adminMember] = await db
    .insert(schema.members)
    .values({
      tenantId: tenant.id,
      userId,
      displayName: personaNames.admin,
      role: 'admin',
      isChild: false,
    })
    .returning({ id: schema.members.id });
  if (!adminMember) throw new Error('seedFamily: admin member insert returned no row');

  let adultMemberId: string | undefined;
  if (options.withPersonas === true) {
    const [adultMember] = await db
      .insert(schema.members)
      .values({
        tenantId: tenant.id,
        userId: adultUserId,
        displayName: personaNames.adult,
        role: 'adult',
        isChild: false,
      })
      .returning({ id: schema.members.id });
    if (!adultMember) throw new Error('seedFamily: adult member insert returned no row');
    adultMemberId = adultMember.id;
  }

  const [childMember] = await db
    .insert(schema.members)
    .values({
      tenantId: tenant.id,
      displayName: personaNames.child,
      role: 'child',
      isChild: true,
      age: 8,
    })
    .returning({ id: schema.members.id });
  if (!childMember) throw new Error('seedFamily: child member insert returned no row');

  let personas: SeededPersonas | undefined;
  if (options.withPersonas === true) {
    // Cost 4: the api verifies with bcryptjs `compare`, which reads the cost
    // out of the hash itself, so a cheap hash still logs in and keeps the
    // per-scenario seed fast.
    const pinHash = await bcrypt.hash(SEEDED_PIN, 4);
    const [teenMember] = await db
      .insert(schema.members)
      .values({
        tenantId: tenant.id,
        displayName: personaNames.teen,
        role: 'teen',
        isChild: true,
        age: 14,
        pinHash,
      })
      .returning({ id: schema.members.id });
    if (!teenMember) throw new Error('seedFamily: teen member insert returned no row');

    await db.update(schema.members).set({ pinHash }).where(eq(schema.members.id, childMember.id));

    if (!adultMemberId) throw new Error('seedFamily: adult member missing for personas');
    personas = {
      adultMemberId,
      adultUserId,
      adultEmail,
      teenMemberId: teenMember.id,
      pin: SEEDED_PIN,
    };
  }

  if (options.withContent === true) {
    const today = new Date().toISOString().slice(0, 10);
    await db.insert(schema.mealTemplates).values({
      tenantId: tenant.id,
      dayOfWeek: 'mon',
      slot: 'dinner',
      name: 'Family pasta',
    });
    await db.insert(schema.events).values({
      tenantId: tenant.id,
      date: today,
      title: 'Family catch-up',
      memberId: childMember.id,
    });
    await db.insert(schema.assignments).values({
      tenantId: tenant.id,
      title: 'Finish reading',
      dueDate: today,
      memberId: childMember.id,
    });
    await db.insert(schema.notices).values({
      tenantId: tenant.id,
      body: 'Welcome to the family board',
      authorMemberId: adminMember.id,
    });
    await db.insert(schema.tasks).values({
      tenantId: tenant.id,
      memberId: adminMember.id,
      title: 'Book the dentist',
      dueDate: today,
    });
    await db.insert(schema.journalEntries).values({
      tenantId: tenant.id,
      memberId: childMember.id,
      entryDate: today,
      mood: 'happy',
      gratitude1: 'My family',
    });
    await db.insert(schema.learnProgress).values({
      tenantId: tenant.id,
      memberId: childMember.id,
      subject: 'world-flags',
      progress: 20,
    });

    const [reward] = await db
      .insert(schema.rewards)
      .values({ tenantId: tenant.id, name: 'Choose a film', stickerCost: 5 })
      .returning({ id: schema.rewards.id });
    if (!reward) throw new Error('seedFamily: reward insert returned no row');
    await db.insert(schema.redemptionRequests).values({
      tenantId: tenant.id,
      memberId: childMember.id,
      rewardId: reward.id,
      starCost: 5,
    });
  }

  // FHS-607: a live week + one active investment, so the Active Investments
  // card renders a real row (not just its empty state) in the responsive
  // check. The board opens on the current week, so the week's start date is
  // this week's Monday in UTC.
  const now = new Date();
  const live = liveWeekStart(now, options.weekEndsToday === true);
  const monday = new Date(`${live.startDate}T00:00:00Z`);
  // FHS-608 seeds a finished week dated LAST week; FHS-616 scopes a finished
  // week's habits to ones that existed before it closed, so the habit must
  // actually predate that week (not just be inserted before it in this
  // script, which all happens "now"). Back-date createdAt to before
  // lastMonday so it counts.
  const lastMonday = new Date(monday.getTime() - 7 * 24 * 60 * 60 * 1000);
  const habitCreatedAt = new Date(lastMonday.getTime() - 24 * 60 * 60 * 1000);

  const [habit] = await db
    .insert(schema.habits)
    .values({
      tenantId: tenant.id,
      memberId: childMember.id,
      name: 'Brush teeth',
      createdAt: habitCreatedAt,
    })
    .returning({ id: schema.habits.id });
  if (!habit) throw new Error('seedFamily: habit insert returned no row');

  const [week] = await db
    .insert(schema.mwWeeks)
    .values({
      tenantId: tenant.id,
      memberId: childMember.id,
      // The unique index is (tenant, member, year, weekNumber), so the live
      // week and the finished one before it must carry different numbers.
      weekNumber: 2,
      year: live.year,
      startDate: live.startDate,
    })
    .returning({ id: schema.mwWeeks.id });
  if (!week) throw new Error('seedFamily: week insert returned no row');

  // One sticker per day, worth 1 each, unallocated: exactly what the save,
  // cash-out and invest routes draw from (habit_stickers where is_allocated
  // is false, see family-hub-api src/areas/my-world/mw-financial.ts).
  const earned = options.earnedStickers ?? 0;
  if (earned > 7) {
    throw new Error(
      `seedFamily: earnedStickers is capped at 7 (one per day for the seeded habit), got ${earned}`,
    );
  }
  if (earned > 0) {
    await db.insert(schema.habitStickers).values(
      Array.from({ length: earned }, (_, i) => ({
        tenantId: tenant.id,
        memberId: childMember.id,
        habitId: habit.id,
        weekId: week.id,
        day: i,
        sticker: 'gold-star' as const,
        stickerValue: 1,
        isAllocated: false,
      })),
    );
  }

  // FHS-608: a finished week before this one, with one banked action, so the
  // recap has a real record to render in the responsive check. `closureSnapshot`
  // mirrors what a real POST /finalize call stamps (FHS-616 reads
  // `capturedAt` from it as the week's real close moment); a moment inside
  // the week's own span keeps the "closed early" case realistic.
  const [pastWeek] = await db
    .insert(schema.mwWeeks)
    .values({
      tenantId: tenant.id,
      memberId: childMember.id,
      weekNumber: 1,
      // Deliberately the live week's year, not lastMonday's: across a new-year
      // boundary the two would otherwise land in different years and the
      // board would order them apart.
      year: live.year,
      startDate: previousWeekStart(live.startDate),
      isFinalized: true,
      carriedOverStickers: 3,
      closureSnapshot: {
        capturedAt: new Date(lastMonday.getTime() + 6 * 60 * 60 * 1000).toISOString(),
      },
    })
    .returning({ id: schema.mwWeeks.id });
  if (!pastWeek) throw new Error('seedFamily: past week insert returned no row');
  await db.insert(schema.mwWeekActions).values({
    tenantId: tenant.id,
    memberId: childMember.id,
    weekId: pastWeek.id,
    actionType: 'save',
    stickersUsed: 3,
  });

  // FHS-631: `deductible: false` on purpose. A deductible investment loses
  // value for every missed day, so with no stickers placed its worth decayed
  // as the week went on and hit zero by about Friday. Kids money then showed
  // its "nothing yet" empty state, which is correct behaviour, and the smoke
  // tests failed depending on which day of the week CI happened to run. The
  // seed must not change meaning with the calendar.
  await db.insert(schema.mwInvestments).values({
    tenantId: tenant.id,
    memberId: childMember.id,
    habitId: habit.id,
    weekId: week.id,
    investedAmount: '5.00',
    investedStickers: 10,
    originalInvestedStickers: 10,
    coefficient: 3,
    deductible: false,
  });

  return {
    tenantId: tenant.id,
    slug,
    tenantName,
    userId,
    email,
    adminMemberId: adminMember.id,
    childMemberId: childMember.id,
    personaNames,
    childMemberName: personaNames.child,
    habitId: habit.id,
    liveWeekId: week.id,
    ...(personas ? { personas } : {}),
  };
}

/**
 * Deletes the tenant row (cascades to every tenant-scoped child row: members,
 * habits, ...) and the users-mirror row. The mirror has no tenant_id (a user
 * can belong to several tenants), so it doesn't cascade off the tenant
 * delete: remove it explicitly so repeated local runs don't accumulate
 * `e2e-*@example.invalid` fixture rows.
 */
export async function cleanupFamily(
  family: Pick<SeededFamily, 'tenantId' | 'userId' | 'personas'>,
): Promise<void> {
  const db = getE2eDb();
  await db.delete(schema.tenants).where(eq(schema.tenants.id, family.tenantId));
  await db.delete(schema.users).where(eq(schema.users.id, family.userId));
  if (family.personas) {
    await db.delete(schema.users).where(eq(schema.users.id, family.personas.adultUserId));
  }
}
