# Design System (UDS)

**One line:** every Family Hub screen draws its look from one place, the shared
Tailwind preset and the `@familyhub/ui` component library, both derived from the
Magic Patterns design. Don't restyle ad-hoc; extend the source.

**Jira:** FHS-380 · **Status:** living document
**Design source of truth:** Magic Patterns editor `kudjspxd3xxroueg5jw11o`
(v74 "Kid Reward Request & Parent Approval System").

---

## Single source

| Layer                                                                | Lives in                                                                             | Rule                                                                                                                                                                       |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Design tokens** (colours, shadows, fonts, breakpoints, animations) | [`design-system/tailwind.preset.js`](../../design-system/tailwind.preset.js)         | Apps `presets: [preset]`. **Never copy tokens into an app config**: extend the preset. Guarded by [tailwind-preset.test.ts](../../tests/unit/web/tailwind-preset.test.ts). |
| **Global CSS + fonts**                                               | [`design-system/src/styles/globals.css`](../../design-system/src/styles/globals.css) | Imports Fredoka One + Nunito (Google Fonts) and sets the kingdom body bg. Apps `@import '@familyhub/ui/styles/globals.css'`.                                               |
| **Components**                                                       | `design-system/src/*`                                                                | Use these. When porting a Magic Patterns component, port it **into `design-system` first**, then consume it from the page. Don't re-implement per screen.                  |

## Tokens (mirror of the Magic Patterns design)

- **Brand purple, `kingdom`**: full `50→950` scale; `kingdom.900` / `kingdom.bg` = `#3d1065` (page background), `kingdom.950` = `#2a0b46` (headers/nav). ChildWorld layers 600–950.
- **Pastel card fills, `pastel.{yellow,pink,cyan,lime}`** (= Tailwind 100-shades; named for MP-ported markup).
- **Neo-brutalist shadows: `shadow-neo-xs|sm|neo|md|lg`** = `1|2|3|4|6 px` hard black offset.
- **Fonts, `font-heading`** = Fredoka One (also `font-display`, legacy alias); **`font-body`** = Nunito.
- **Extras**: `xs` breakpoint (375px), `border-3` (3px), `animate-shake`, `space-bg` starfield.

## Neo-brutalist conventions

- Cards/buttons/pills: `border-2 border-black` (`sm:border-3` on big cards), `shadow-neo-sm` (cards) / `shadow-neo-xs` (sub-items/buttons), **`rounded-xl`** (our standard radius), `overflow-hidden` on cards with edge-to-edge content.
- Headings/numbers: `font-heading` (often `uppercase tracking-wide`); body: `font-body`.
- Interactive lift: `motion-safe:hover:-translate-y-0.5` (gated for reduced-motion).
- Section/card fills use the pastel palette; the page sits on `bg-kingdom-bg`.

## Core components (`@familyhub/ui`)

Button, Card, Badge, TopNav, Input, Label, Select, SearchableSelect, Dropdown,
Dialog, ConfirmDialog, Toast, AvatarGrid, PinInput, StepperHeader, FeatureCard,
PricingCard, CurrencyPicker, TimezonePicker, DynamicCalendar, FloatingDecorations.

## Storybook: the component catalogue

**Jira:** [FHS-643](https://qualicion2.atlassian.net/browse/FHS-643)

Every component gets a page showing its real states, so design and build argue
about the same artefact instead of about screenshots.

```bash
pnpm storybook          # opens the catalogue on localhost:6006
pnpm build-storybook    # what CI compiles; output is gitignored
```

| Thing          | Where                                                                                            |
| -------------- | ------------------------------------------------------------------------------------------------ |
| Config         | [`design-system/.storybook/`](../../design-system/.storybook/)                                   |
| Stories        | Beside the component: `design-system/src/<Name>.stories.tsx`                                     |
| Coverage guard | [`tests/unit/web/ui/stories-coverage.test.ts`](../../tests/unit/web/ui/stories-coverage.test.ts) |

**A new component ships with a story.** The guard test fails the build otherwise,
and names the component. If a story genuinely has to wait, add the name to
`AWAITING_STORIES` in that test so the debt is visible rather than silent.

Three things about the setup are deliberate:

- **Stories sit next to the component**, not under `tests/`. The repo's
  no-colocation rule is about tests; stories are documentation, and Storybook's
  own tooling assumes they live beside the source.
- **The canvas is kingdom purple by default.** These components are drawn for a
  purple page, so a white canvas would make correct components look broken.
  White and the deeper purple are both available from the backgrounds toolbar.
- **Storybook serves `public`** via `staticDirs`. The brand fonts are
  self-hosted (FHS-566), so without it every heading in the catalogue would fall
  back to a system face and misrepresent the design.

Stories are typechecked, but by `design-system/tsconfig.stories.json` rather than
the main config: they are not part of the package's public surface, so they stay
out of the declaration build.

**Not yet done:** 23 of the 36 components are still uncovered, all composites
that need providers or fixture data. Restructuring the package into Atomic
Design layers (atoms / molecules / organisms) was considered and deferred; every
consumer imports through the barrel `design-system/src/index.ts` with no deep
imports, so that regrouping stays a cheap file move whenever it is wanted.

## Deliberate divergences from the MP component prototypes

The MP `components/*` files are prototype scaffolding; ours are the production
system and intentionally differ, **do not "revert" these to match the mock**:

- **Radius:** our standard is `rounded-xl` (the MP prototypes use `rounded-md`
  on Button/Card, but the MP _pages_ use `rounded-xl`/`2xl`). One standard:
  `rounded-xl`.
- **Button:** adds `ghost` / `danger` / `success` variants, `font-black`,
  Tailwind `shadow-neo` tokens (not framer inline), `forwardRef`, `testId`.
- **Badge:** typed `variant` enum (vs the mock's raw colour string).
- **Card:** responsive padding (`p-3 sm:p-4 md:p-5`), `hover`/`radius` props.
- **TopNav:** generic `brand` / `rightSlot` / `tabs[]` slots (vs hardcoded);
  badge carries `aria-label` + `data-testid`.

## Opportunistic alignment backlog (low priority)

Match these to the mock when the relevant component is next touched (not a
blocking sweep): Badge neo border + `shadow-neo-xs`; Button `accent` (cyan)
variant; TopNav tab-row `hide-scrollbar`.

## How to apply (the rule)

1. Need a token? It's in the preset, use the class. Missing? Add it to the
   preset (+ a preset-test assertion), never to an app config.
2. Need a UI element used on 2+ screens? It belongs in `design-system`.
3. Matching a Magic Patterns screen? Read the mock via the magic-patterns MCP,
   port the component into `design-system`, then consume it.
