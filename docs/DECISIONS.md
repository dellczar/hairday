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
| 2026-11-14 | **Demo mode**: until the Supabase project exists, owner screens save to the phone only (`src/lib/db.ts`). Profile shows "Reset demo data" | Lets the owner try Phase 2 now. The same screens switch to the real database automatically once `.env` has the Supabase keys — no screen code changes |
| 2026-11-14 | Owners can't set `payouts_enabled` or `stripe_account_id` themselves; only the server (Stripe webhook) can | Found while testing: the Phase 1 rules let an owner mark payouts as done and publish without Stripe. Fixed with column permissions + 5 new tests |
| 2026-11-14 | Photos go in one public Supabase Storage bucket, `photos/<business id>/…`; only that salon's owner can upload or delete | Photos are shown publicly on salon pages anyway; folder-per-business makes the rule simple and testable. Photos are shrunk to 1600 px JPEG before upload |
| 2026-11-14 | Address step: typed fields (street, suite, city, state, ZIP) + "Use my current location". Address search-as-you-type and the real map pin come in Phase 3 | Both need the Google Maps keys (Phase 0, not done yet). The map is the design's drawn preview for now |
| 2026-11-14 | Time pickers are a sheet of time chips, not a spinning wheel | Same look on iPhone and Android, big tap targets, no extra library |
| 2026-11-14 | Form sheets (edit service, break, time off) use the system Modal | Keeps typed fields above the keyboard on both platforms; the swipe sheet stays for Filters / Walk-in later |
| 2026-11-14 | Added a **Team list** screen (Business → Team) before "Add professional" | The designs only show adding one person; owners also need to see and edit everyone |
| 2026-11-14 | New professionals start with the salon's opening hours and every service ticked; a new service is offered by the whole team | Fewer taps for small salons; owners untick what doesn't apply |
| 2026-11-14 | "Add from catalog" suggests typical NYC prices and times; the owner always sets their own before saving | Speeds up setup; nothing is published with a suggested price unless the owner keeps it |
| 2026-11-14 | Today, Clients and Get paid are placeholder screens until Phases 5–6 | Phase 2 scope is setup only (SPEC §14) |
| 2026-11-14 | "Switch to booking" button at the bottom of Business profile returns to customer mode; the app remembers the last mode | SPEC §6 says owners can still book as customers; the designs don't show the way back |
| 2026-11-14 | Big serif headings grow at most 1.4× with the phone's text-size setting; body text up to 2× | At the largest iPhone text sizes the headings broke mid-word ("Cro W…"); body text stays fully scalable |
| 2026-11-14 | Scrolling a form closes the keyboard | The iPhone number pad (ZIP, price) has no "Done" key and could hide the Continue button |
| 2026-11-14 | Service description hint reads "What's included, and anything clients should know." instead of the design's "Looking for a quick cut?" | The design's example only fits a haircut; the hint shows for every service type |
| 2026-11-15 | Maps: **Apple Maps on iPhone** (no key, free); **Google Maps on Android** once the Google Cloud key is added to `.env` (`GOOGLE_MAPS_ANDROID_API_KEY`). Until then Android shows the design's drawn map with the same price pins | SPEC §4 (`react-native-maps`). Google's mobile Maps SDK has no per-map charge; the key itself is Phase 0 |
| 2026-11-15 | Location is asked the first time Explore opens, never on Home or at launch. If it's denied, or the phone is more than 60 miles from New York, distances are measured from Union Square | SPEC §10/§12. Hairday is New York only for now, so "2,500 mi" from another city isn't useful |
| 2026-11-15 | Reviews are shown through a read-only `public_reviews` view: reviewer as first name + last initial ("Dana T."), only for live salons, no customer ids | Profiles are private to each person; the view shares just those two letters. 14 new database tests cover it and favorites |
| 2026-11-15 | Filters start on **Any day** instead of Today; tapping a selected day again clears it | Late in the evening "Today" would hide almost every salon. Filters.html's Reset still clears everything |
| 2026-11-15 | Price filter runs $0 – $300+ in $5 steps; a salon matches if at least one chosen service is in range | Covers NYC price levels from a beard trim to knotless braids |
| 2026-11-15 | Share links are `hairday.app/salon/?id=…`. The page opens the app on phones that have it, otherwise says the app is coming soon | Domain is hairday.app (Open question 4). Opening the app directly from the link (universal links) needs the Apple Team ID, so it waits for the Apple Developer account |
| 2026-11-15 | Home's service tiles are tan blocks, as drawn, until there are real category photos | No licensed photos yet; the designs use tan as the photo placeholder |
| 2026-11-15 | "Your next appointment" on Home, "Choose a time" and "Book with …" are wired to show a note until Phase 4 builds booking | Phase 3 scope is discovery (SPEC §14) |
| 2026-11-15 | Demo mode includes the same 3 sample salons as `supabase/seed.sql`, with 8 sample reviews | So Home, Explore and favorites can be tried before Supabase exists. Reset demo data keeps them |
| 2026-11-15 | The owner's **Preview** button opens their own salon page, with a note while it isn't live | It was a placeholder in Phase 2 |
