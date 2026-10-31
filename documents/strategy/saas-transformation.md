# Family Hub: SaaS Transformation Strategy

**Status:** living document
**Updated:** 2026-10-30
**Owner:** product + leadership
**Audience:** internal team, prospective investors / acquirers

---

## Vision

> **Every family, one team. No one carrying it alone.**

**Mission:** We bring every kind of family onto the same page, and lift
the mental load off the people who hold it all together.

**Tagline:** Same page. Lighter load.

The full statement, with what we believe and the change we make, is the
Vision and Mission document (FHS-679), source
`scripts/docs/doc-src/fh-vision-mission.html`.

### What we build to get there

Family Hub is **the operating system for family life**: a single
multi-tenant platform that combines family admin (calendars, meals,
announcements, assignments, journaling), beneficial screen time
(maths, logic, world flags), a child-friendly sticker economy, and
cultural flexibility (optional cultural journals, community integration,
extended-family roles).

We are transforming the existing single-family application into a
multi-tenant SaaS that any family, and eventually any community
organization, can spin up at `<slug>.familyhub.app` in minutes.

## What we're building

| Pillar                     | Description                                                                                                 |
| -------------------------- | ----------------------------------------------------------------------------------------------------------- |
| **Family Admin Hub**       | Calendars, meals, announcements, assignments, journal: one dashboard replaces five apps.                    |
| **Beneficial Screen Time** | Maths, world flags, logic games: children earn stickers by learning. Screen time parents feel good about.   |
| **Sticker Economy**        | Earn, save, invest, spend in a rewards shop. Children learn economics through real consequence.             |
| **Cultural Flexibility**   | Optional cultural journals, community integration, extended-family roles. Built for how real families work. |

## How it works

1. **Register**: family signs up, picks a name, gets a custom URL: `smith-family.familyhub.app`.
2. **Set up**: first user becomes admin; toggle on the modules your family needs, turn off what you don't.
3. **Invite**: add family members via email or invite code; everyone lands in your private family space.
4. **Grow**: each family is isolated; multiple families on one platform, each in their own world.

## Market & whitespace

The four-way intersection, **family admin + children's education +
reward economy + cultural flexibility**, is uncontested. Existing
players occupy at most two corners:

| Competitor            | Family admin | Education | Reward economy  | Cultural flex |
| --------------------- | ------------ | --------- | --------------- | ------------- |
| Cozi, FamilyWall      | ✅           | ❌        | ❌              | ❌            |
| Khan Academy, Prodigy | ❌           | ✅        | partial         | ❌            |
| GoHenry, RoosterMoney | partial      | ❌        | ✅ (money only) | ❌            |
| Culture-focused apps  | ❌           | ❌        | ❌              | partial       |

**The whitespace:** no product combines all four pillars. Family Hub
sits dead-centre.

## Who we're building for

### Early adopters

- Tech-comfortable parents managing 2+ children's schedules.
- Households where one parent values structured screen time / educational habits.
- Multicultural households underserved by one-size-fits-all family apps.
- Homeschool and supplemental-learning families.

### Launch geography (in order)

1. **UAE / Saudi Arabia**: high income, strong community structures, extended-family norms, English-speaking expats.
2. **US / Canada / UK**: massive market, high tech adoption, homeschooling growth.
3. **Indonesia / Pakistan**: large family-centric populations, strong family culture, mobile-first usage.

## Pricing strategy

### Consumer tiers

| Tier                 | Price                | Notes                                                 |
| -------------------- | -------------------- | ----------------------------------------------------- |
| **Household (Free)** | $0                   | Up to 3 members, limited features, no sticker economy |
| **Family**           | $7.99/mo or $69/yr   | Unlimited members, all core features, maths module    |
| **Family Pro**       | $12.99/mo or $109/yr | Adds World Flags, Logic, custom subdomain             |

### Enterprise / white-label tiers

For schools, homeschool co-ops, clubs and community organisations,
community centres, NGOs.

| Org size          | Annual price | Includes                       |
| ----------------- | ------------ | ------------------------------ |
| Up to 20 families | $299         | Branded subdomain, custom logo |
| 21–100 families   | $999         | + admin tools, member roles    |
| 101–500 families  | $1,999       | + reporting, bulk invites      |
| 501+ families     | $3,499       | + dedicated support, SSO       |

The four base products map 1-to-1 to the Stripe billing model defined
in [ADR 0004](../decisions/0004-stripe-billing.md): Starter, Growth,
Scale, Enterprise, with metered usage on Scale and Enterprise.

## Architecture

| Concern           | Decision                                                                                                                           | ADR                                                   |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| Tenant isolation  | Shared DB, shared schema, `tenant_id` + Postgres RLS                                                                               | [0001](../decisions/0001-multi-tenancy.md)            |
| Tenant routing    | Subdomain (`<slug>.familyhub.app`) resolved by middleware + AsyncLocalStorage                                                      | [0002](../decisions/0002-subdomain-tenant-routing.md) |
| Auth              | Our own GoTrue on Railway behind the api (magic links, Google, ES256 passes, branded emails); production on Supabase until FHS-701 | [0022](../decisions/0022-own-sign-in-server.md)       |
| Auth environments | One private GoTrue service per Railway environment (staging, production)                                                           | [0022](../decisions/0022-own-sign-in-server.md)       |
| Billing           | Stripe (Checkout + Customer Portal + webhooks + metered usage)                                                                     | [0004](../decisions/0004-stripe-billing.md)           |
| Codebase          | Three repos: `family-hub-api`, `family-hub-web`, `family-hub-app`, grouped by product area (split in progress)                     | [0021](../decisions/0021-three-repo-split.md)         |
| Branching         | `feature/*` → `staging` → `main`, conditional squash / merge-commit                                                                | [0006](../decisions/0006-branching-strategy.md)       |
| Stack reuse       | Reuse the proven family-hub stack verbatim; swap individual libraries via superseding ADRs only when a concrete metric forces it   | [0007](../decisions/0007-stack-reuse.md)              |

Module toggling per tenant means each family / organization activates
only the pillars they need, Family Admin Hub may be on for one
tenant while another adds Beneficial Screen Time + Sticker Economy.

## AI moat

The defensibility flywheel:

1. Each family's children generate per-child learning data (maths
   problem patterns, time-of-day performance, error fingerprints).
2. The maths / logic / world-flags engines personalize lessons per
   child using that data, not generic placement, but the next problem
   _this specific child_ needs to grow.
3. Outcomes (mastery rate, streak retention, sticker earn rate)
   compound over months. A child six months in has a personalized
   curriculum no competitor can clone overnight.
4. Switching to a generic app means starting from cold-start placement,
   a felt regression. Per-child data is the moat, not the algorithm.

Initial AI surface is the maths module (already in the legacy app
under `MathsAILesson`). Logic and world-flag engines extend the same
pattern. Track AI quality with per-child mastery curves alongside
business KPIs.

## 24-month milestones

| Quarter         | Milestone                                     | KPI target                                                   |
| --------------- | --------------------------------------------- | ------------------------------------------------------------ |
| Q1 (Sprint 0–4) | Foundations + first paying tenants            | Production live; 100 paid families                           |
| Q2              | Enterprise pilot                              | 5 paid org tenants; first $1k MRR enterprise deal            |
| Q3              | Module marketplace + AI-personalized maths v2 | 1,000 paid families; 15 enterprise tenants                   |
| Q4              | Geography expansion (UAE / Saudi launch)      | 2,500 paid families; 25 enterprise tenants                   |
| Q5              | UK / US / Canada launch + scale ops           | 4,000 paid families                                          |
| Q6              | Indonesia / Pakistan; mature retention loops  | 5,000+ paid families; 30+ enterprise tenants; **$720k+ ARR** |

At target ARR, an 8–12× multiple range puts the business in the
**$5.7M–$8.6M acquisition** band. Operate the business with this
band visible in dashboards from Day 1 so financial diligence is
zero-friction.

## Sprint-to-milestone mapping

The Jira sprint plan in project FHS maps directly to these milestones.
Authoritative live view: the
[FHS: Epics & Tickets](https://qualicion2.atlassian.net/spaces/FA/pages/3079340034/FHS+Epics+Tickets)
Confluence page.

| Sprint cluster                     | Epics                                 | Milestone served                                                  |
| ---------------------------------- | ------------------------------------- | ----------------------------------------------------------------- |
| **Sprint 0: Bootstrap**            | FHS-143, 149, 155, 160, 165, 171, 177 | Foundations: repo, monorepo, infra, CI, observability, ADRs       |
| **Sprint 1: Tenant Foundation**    | FHS-1, 7, 12, 18                      | Multi-tenant data layer (RLS, context middleware, migration)      |
| **Sprint 2: Signup & Custom URL**  | FHS-23, 29, 35, 42                    | Public signup, subdomain routing, onboarding wizard               |
| **Sprint 3: Modules & Gating**     | FHS-47, 53, 58, 64                    | Module toggle UI, customization settings, feature gating          |
| **Sprint 4: Stripe Billing**       | FHS-68, 73, 78, 84                    | Subscriptions, checkout, portal, webhooks, metered usage          |
| **Sprint 5: Invites & Roles**      | FHS-90, 97, 104, 110                  | Invitation system, role hierarchy, member management, audit       |
| **Sprint 6: White-Label & Launch** | FHS-116, 123, 129, 136                | Org-of-tenants, white-label branding, launch hardening, marketing |

Each epic links back to its child stories in the Confluence overview.

## Open questions

- Final UI / brand system before W1 vertical slice ships
  ([FHS-199](https://qualicion2.atlassian.net/browse/FHS-199) ports
  the legacy design system).
- Pricing experimentation: are the consumer tiers correctly priced for
  UAE / Saudi vs US/UK markets? Run pricing test in Q2.
- LICENSE: MIT (per repo bootstrap) or proprietary, leadership to
  confirm before any public launch.

## References

- [Architecture Decision Records](../decisions/) (0001–0007)
- [documents/README.md](../README.md): full documentation index
- Legacy strategy HTML (source material): `~/Documents/Toonday/Business/FamilyHub/family-hub/documents/enterprise/family-hub-saas-strategy.html`
