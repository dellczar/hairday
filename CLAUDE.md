# CLAUDE.md — Hairday

Instructions for Claude Code working in this repository. Read this file, then `docs/SPEC.md`, before doing anything.

## The project

Hairday is a beauty salon booking marketplace (customers book; salon owners run their business) shipped as **one native app for iOS and Android**, built with Expo + React Native + TypeScript, with Supabase and Stripe behind it.

- Behavior: `docs/SPEC.md` (source of truth).
- Look and layout: `design/screens/*.html` — one file per screen, see `design/README.md`.
- Build order: `docs/SPEC.md` §14. Work **one phase at a time**.

## The owner

The owner is Dellon. He is not a full-time developer, so:

- Explain what you did in plain words at the end of each step — what changed, what he should tap to see it, what's next.
- When he has to do something himself (create an account, paste a key, press a button in Xcode or a store console), give numbered steps with exact menu names. Never ask him to edit code by hand.
- **Ask before** deciding anything in SPEC §3 "Open questions", adding a paid service, or changing the stack.
- Keep a running log of decisions in `docs/DECISIONS.md` (date, decision, why).

## Stack rules

- Expo, latest stable SDK. Create with `npx create-expo-app@latest`. Use `npx expo install` for Expo-compatible packages so versions match the SDK.
- **Expo Router** for navigation. Route groups: `(auth)`, `(customer)/(tabs)`, `(business)/(tabs)`.
- Use **development builds** (`expo-dev-client`, `eas build --profile development`). Don't rely on Expo Go.
- TypeScript `strict`. No `any` without a comment saying why.
- Styling only through `src/theme` tokens (colors, fonts, radius, spacing in SPEC §5). No hard-coded hex values in screens.
- Shared UI in `src/components/`, data hooks in `src/hooks/` (React Query), pure logic in `src/lib/`.
- Supabase: schema changes only as migrations in `supabase/migrations/`; secrets and Stripe calls only in Edge Functions (`supabase/functions/`). The app only ever holds the Supabase **anon** key and the Stripe **publishable** key.
- Row Level Security on every table, with a test for each policy.
- Stripe in **test mode** until the owner says otherwise. Never charge real cards in development.
- No Apple or Google in-app purchase for bookings (in-person services must use Stripe — Apple Guideline 3.1.3(e)).

## Suggested layout

```
app/                 Expo Router screens (see SPEC §10 for each file)
src/components/      Button, Input, Chip, Card, Sheet, Avatar, Skeleton, EmptyState...
src/theme/           tokens.ts, typography.ts
src/lib/             availability.ts, money.ts, dates.ts, supabase.ts, stripe.ts
src/hooks/           useSalon, useSlots, useBookings...
supabase/migrations/ SQL migrations
supabase/functions/  create-payment-intent, stripe-webhook, connect-onboarding,
                     geocode, send-notifications, release-holds, delete-account
supabase/seed.sql    3 NYC salons with services, pros, hours
e2e/                 Maestro flows
docs/                SPEC.md, PROMPTS.md, STORE_CHECKLIST.md, DECISIONS.md
design/              screen references (read-only)
```

## Matching the designs

- Open the matching `design/screens/<Name>.html` before building a screen. Copy spacing, sizes, colors, copy text and order of elements from it.
- The designs are drawn at 390×844 (iPhone). Build with flexbox so they also work on small Androids (360 wide) and large iPhones; respect safe areas (`react-native-safe-area-context`).
- Tan blocks in the designs are photo placeholders — use real images with the tan color while loading.
- Brand: logo files are in `design/brand/`. Colors come from the logo (navy `#171826`, gold `#F4A942`). **Text on gold is always navy, never white.** Gold text on light backgrounds uses `goldText` (`#8F5A0E`). See SPEC §5.
- Screen files reference the logo as `../brand/logo-on-light.png` / `logo-on-dark.png`.
- Interactions shown in the designs (selected chips, tabs, sheets, toggles, steppers) must work the same way in the app.
- `[YOUR FEE]` and `[TOTAL]` are placeholders for Open question 1. Don't invent a fee.

## Every time you finish a piece of work

1. `npx tsc --noEmit`, `npx eslint .`, `npx jest` — all must pass.
2. Run on iOS Simulator **and** Android Emulator and look at the screens you touched (screenshots if you can).
3. Check accessibility on what you built: labels on icon buttons, 44 pt targets, text readable at large font size.
4. Commit with a clear message. Never commit `.env` files or keys.
5. Tell the owner, in plain words, what's done and what comes next.

## Don'ts

- Don't ask for permissions (location, notifications, contacts, photos) at launch — only at the moment they're needed (SPEC §12).
- Don't build web-only features or a PWA.
- Don't add libraries for things a few lines of code can do.
- Don't skip account deletion, privacy policy links, or Sign in with Apple — the stores will reject the app (SPEC §13).
- Don't move to the next phase until the owner has seen the current one.
