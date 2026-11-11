# Decisions log

| Date | Decision | Why |
|---|---|---|
| 2026-11-08 | Native iOS + Android app with Expo / React Native, one codebase | Owner wants it on both stores; one codebase keeps the build manageable |
| 2026-11-08 | Supabase for database, sign-in, photos and server functions | One service instead of a custom backend; works well from React Native |
| 2026-11-08 | Stripe for payments; Stripe Connect Express for salon payouts | App never handles bank numbers or SSNs; Apple requires non-IAP payments for in-person services |
| 2026-11-08 | Passwordless sign-in: Apple, Google, email code | Fewer screens than passwords; Apple requires Sign in with Apple when Google is offered |
| 2026-11-08 | Look matches the Hairday logo: ivory background, logo navy, logo gold; Instrument Serif + Inter | Owner asked for the app to match the logo — premium, easy on the eyes, easy to read. All text pairs checked for 4.5:1 contrast |
| 2026-11-08 | Navy text on gold, never white | White on the logo gold is 2:1 contrast — too hard to read |
| 2026-11-08 | Tips 15 / 18 / 20% / None, default 18% | Current US norms (original had 10 / 20 / 30%) |
| 2026-11-08 | Free cancellation until 24 h; 50% after or no-show | Carried over from the original design |
| 2026-11-11 | Publisher ("Seller") on both stores is **HairDay, Inc.**, enrolled as an organization; D-U-N-S on file | Owner's choice (Open question 5). Company name on the listing, and avoids Google Play's closed-test rule for new personal accounts. Use the legal name exactly as D&B lists it |
| 2026-11-11 | Domain is **hairday.app** (registered at GoDaddy) — company website, privacy/terms pages, and later share links | Owner's choice (part of Open question 4). Apple's organization enrollment needs a company website |
| 2026-11-11 | Bundle ID / package name **app.hairday** (iOS and Android) | Owner's choice (Open question 4). Reverse of the domain we own; can never change after release |
| 2026-11-11 | Expo **SDK 58** (not 57 as SPEC §4 says) | Latest stable SDK when Phase 1 started (released 2026-09-29); CLAUDE.md says use the latest stable |
| 2026-11-11 | Screens live in `src/app/` (Expo SDK 58 template layout) instead of `app/` | Current Expo convention; the rest of the suggested layout (`src/components`, `src/lib`, …) is unchanged |
| 2026-11-11 | Added an **"Enter your email"** step between Welcome and Verify | The designs go straight from "Continue with email" to the code screen, but the email has to be collected somewhere. Styled like Verify.html |
| 2026-11-11 | Session stored in the phone's secure storage, split into chunks | SecureStore holds ~2 KB per item; a Supabase session is bigger. Chunking avoids two extra libraries (CLAUDE.md: no libraries for a few lines of code) |
| 2026-11-11 | Fonts loaded with `useFonts` while the splash screen shows | Keeps one font name per weight on both platforms, matching the SPEC §5 tokens |
| 2026-11-11 | RLS tests are plain SQL run on a throwaway local Postgres (`npm run test:db`) | Docker isn't installed, so Supabase's local stack can't run on this Mac yet. 34 checks, all passing |
| 2026-11-11 | Google sign-in button shows "coming soon" until the Google Cloud keys exist | The native Google SDK's config plugin needs the iOS client ID at build time (Phase 0) |
