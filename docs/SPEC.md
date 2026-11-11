# Hairday — Build Spec (v1, native iOS + Android)

This file is the source of truth for **behavior**. The screen files in `design/screens/` are the source of truth for **layout and look**. If they disagree, follow this spec and tell the owner.

---

## 1. What we're building

Hairday is a two-sided beauty booking marketplace, starting in New York.

- **Customers** find salons near them, pick services, a professional and a time, pay, and manage their appointments.
- **Salon owners** list their business, services, staff and hours, run their day from a calendar, manage clients and get paid.

**One app** on the App Store and Google Play. Everyone signs in the same way. A user who sets up a business gets a **Business mode** they can switch into from Profile.

## 2. Decisions already made

| Topic | Decision |
|---|---|
| Platforms | **Native iOS and Android** from one codebase with **Expo (React Native + TypeScript)**. Not a web app, no PWA. |
| Market | New York first. Store all times in UTC; show them in the salon's time zone (`America/New_York` for now). |
| Payments | **Stripe**. Customers pay by card, Apple Pay or Google Pay through Stripe. Salons get paid through **Stripe Connect (Express)**. The app never sees SSNs, routing or account numbers. **Do not use Apple/Google in-app purchase** — these are in-person services, which Apple requires to be paid outside in-app purchase (App Review Guideline 3.1.3(e)). |
| Sign in | **Passwordless**: Sign in with Apple, Google, or email + 6-digit code. Sign in with Apple must be offered on iOS because Google sign-in is offered (Guideline 4.8). |
| Cancellation policy | Free until 24 hours before. After that, or a no-show: 50% is kept. Salon cancels: full refund. |
| Time grid | Durations and start times in 15-minute steps. |
| Look | Matches the Hairday logo: soft ivory background, **logo navy** for text and dark surfaces, **logo gold** for highlights and the main call-to-action, Instrument Serif headlines + Inter body. Premium, calm, easy to read. See §5 and `design/`. |
| Logo | `design/brand/` — `logo-on-light.png` (gold + navy, transparent) for light screens, `logo-on-dark.png` (gold + white, transparent) for navy screens, `logo-original-navy.png` (square, navy background) as the base for the app icon and splash. |

## 3. Open questions — ask the owner before building these parts

1. Booking fee: how much, and do customers or salons pay it? (Screens show `[YOUR FEE]` and `[TOTAL]`.)
2. Charge in full at booking (default here) or save the card and charge after the appointment?
3. Do salons pay a monthly subscription?
4. Final app name, **bundle ID / package name** (suggest `com.hairday.app`), and domain for share links.
5. Which company publishes the app on the stores (the name shown as "Seller")?
6. SMS reminders in v1, or push + email only?
7. Support email and the URLs for the privacy policy and terms.

## 4. Tech stack

**App (one codebase → iOS + Android)**
- **Expo**, latest SDK (57 as of November 2026), TypeScript strict, **Expo Router** (file-based navigation).
- **Development builds** (`expo-dev-client`), not Expo Go — Stripe, Google sign-in and maps need native code.
- Styling: a small theme module (`src/theme`) with the tokens in §5 + `StyleSheet`. Fonts via `@expo-google-fonts/instrument-serif` and `@expo-google-fonts/inter`.
- UI pieces: `@gorhom/bottom-sheet` (sheets), `react-native-reanimated` + `react-native-gesture-handler`, `lucide-react-native` (icons, 1.8 stroke), `expo-image`.
- Data: `@supabase/supabase-js` with session stored in `expo-secure-store`; `@tanstack/react-query` for fetching/caching.
- Native features: `expo-apple-authentication`, `@react-native-google-signin/google-signin`, `@stripe/stripe-react-native` (PaymentSheet with Apple Pay / Google Pay), `react-native-maps` (Apple Maps on iOS, Google Maps on Android), `expo-location`, `expo-notifications`, `expo-calendar` (add to calendar), `expo-contacts` (owner: import clients), `expo-image-picker` + `expo-image-manipulator` (photos), `expo-web-browser` (Stripe onboarding), `expo-linking` (deep links), `expo-haptics`.

**Backend**
- **Supabase**: Postgres, Auth (Apple, Google, email OTP), Storage (photos), Row Level Security, **Edge Functions** for anything secret (Stripe, webhooks, geocoding, sending email/SMS/push), **pg_cron** for reminders and releasing held slots.
- **Stripe**: PaymentIntents + Connect Express, webhooks to an Edge Function.
- **Email**: Resend. **SMS** (optional): Twilio. **Push**: Expo push service.
- **Geocoding**: Google Geocoding API (or Mapbox), called only from an Edge Function.

**Build & release**
- **EAS Build** for iOS and Android binaries, **EAS Submit** to TestFlight and Google Play internal testing, **EAS Update** for over-the-air JS fixes.
- Android: target API level 36 (Android 16) — required by Google Play for new apps and updates from Aug 31, 2026.

**Testing**
- Jest + React Native Testing Library for logic and components.
- **Maestro** end-to-end flow on iOS Simulator and Android Emulator: sign in → search → book → pay (Stripe test card) → cancel.
- `tsc --noEmit` and ESLint must pass before every commit.

## 5. Design tokens

```ts
// src/theme/tokens.ts
colors: {
  bg: '#F7F4EE',          // ivory screen background
  surface: '#FFFFFF',     // cards, inputs
  ink: '#171826',         // logo navy: main text, dark buttons, dark cards, switches, checkboxes (16:1 on bg)
  muted: '#5D6070',       // secondary text (5.7:1 on bg)
  line: '#E5DFD5',        // borders
  lineSoft: '#EFEAE2',    // dividers inside cards
  cardLine: '#ECE6DC',    // card borders
  tint: '#F3EADB',        // chips, info boxes (warm gold tint)
  placeholder: '#CBBFB2', // photo loading blocks
  gold: '#F4A942',        // logo gold: highlight fills, selected time, date badges, main CTA
  onGold: '#171826',      // ALWAYS navy text/icons on gold (8.9:1). Never white on gold (2:1 — unreadable)
  goldText: '#8F5A0E',    // gold-colored TEXT on light backgrounds (5.3:1), e.g. the italic headline word, "NEW", "Finish setup"
  star: '#D58E39',        // rating stars (logo's darker gold)
  onDark: '#F7F4EE', onDarkMuted: '#AEB1C2', onDarkAccent: '#F4A942',
}
fonts: { display: 'InstrumentSerif_400Regular', displayItalic: 'InstrumentSerif_400Regular_Italic',
         body: 'Inter_400Regular', medium: 'Inter_500Medium', semibold: 'Inter_600SemiBold' }
type:  { hero: 42–46, title: 34–38, cardTitle: 22–30 (display font);
         body: 15, small: 13–14, label: 12 (never smaller) }
radius: { input: 14, card: 16, bigCard: 20, sheet: 28, pill: 999 }
space:  screen side padding 20; gaps 8 / 12 / 16 / 20
touch:  every tappable thing at least 44×44
```

- Headlines use the serif with one italic word in `goldText` on light screens and `gold` on navy screens ("Book your *next look.*").
- Button hierarchy: **gold fill + navy text** for the one main action on money screens (Confirm booking, Continue to pay, Walk-in add); **navy fill + white text** for other primary buttons; white with a `line` border for secondary.
- App icon: the swirl mark from the logo on navy; splash: `logo-on-dark.png` centered on navy `#171826`.
- Respect the system text size setting (Dynamic Type / font scale) — layouts must not break at 130%.
- Dark mode: not in v1; lock to light appearance.
- Photo areas in the designs are plain tan blocks — use real salon/pro photos from Storage, with the tan color as the loading placeholder.

## 6. Users and roles

- `customer` — every new account.
- `owner` — after completing "Set up business". Owners can still book as customers. Profile shows "Switch to Business" once a business exists.
- `staff` — later. In v1, professionals are records the salon owns, not logins.

## 7. Data model (Postgres)

```
profiles        id (= auth user id), first_name, last_name, phone, avatar_url,
                notify_push bool, notify_email bool, notify_sms bool, created_at
push_tokens     id, profile_id, expo_token, platform (ios|android), updated_at
businesses      id, owner_id → profiles, name, type, description, phone, website,
                instagram, tiktok, address_line1, address_line2, city, state, zip,
                lat, lng, time_zone default 'America/New_York', logo_url,
                amenities text[], health_safety text[],
                cancellation_hours int default 24, late_cancel_percent int default 50,
                stripe_account_id, payouts_enabled bool, is_published bool, created_at
business_photos id, business_id, url, sort_order
business_hours  id, business_id, weekday 0–6, opens_at time, closes_at time
                (several rows per weekday allowed; no row = closed)
categories      id, slug, name  (haircut, barber, kids-haircut, braids, color,
                hair-treatments, eyelashes, brows, makeup, nails)
services        id, business_id, category_id, name, description, price_cents,
                duration_min (multiple of 15, 15–480), is_visible bool, sort_order
professionals   id, business_id, role (hair stylist, colorist, barber, braider,
                cosmetologist, makeup artist, nail technician, lash artist,
                massage therapist, other), first_name, last_name, avatar_url,
                instagram, is_active
professional_services   professional_id, service_id
professional_photos     id, professional_id, url, sort_order
availability    id, professional_id, weekday 0–6, starts_at time, ends_at time
breaks          id, professional_id, weekday 0–6 (null = every day), starts_at, ends_at
time_off        id, professional_id, starts_at timestamptz, ends_at timestamptz, note
clients         id, business_id, profile_id (nullable), name, email, phone, notes
bookings        id, business_id, professional_id, customer_id → profiles (nullable for walk-ins),
                client_id, starts_at timestamptz, ends_at timestamptz,
                status (pending_payment | confirmed | completed | cancelled | no_show),
                source (online | walk_in | phone),
                subtotal_cents, fee_cents, tip_cents, total_cents,
                stripe_payment_intent_id, cancelled_at, cancelled_by, refund_cents, created_at
booking_services booking_id, service_id, professional_id, price_cents, duration_min
                (copied at booking time; each service can have its own professional)
reviews         id, booking_id (unique), business_id, professional_id, customer_id,
                rating 1–5, tags text[], body, photo_url, created_at
favorites       customer_id, business_id (nullable), professional_id (nullable)
```

- **No double booking:** exclusion constraint so one professional can't have two overlapping `confirmed` or `pending_payment` bookings:
  `EXCLUDE USING gist (professional_id WITH =, tstzrange(starts_at, ends_at) WITH &&) WHERE (status IN ('confirmed','pending_payment'))`
- **Row Level Security** on every table: customers read published businesses and their own bookings/favorites/reviews; owners read and write everything for their own business; nobody reads another business's clients.
- Keep `business_id` on everything a later "multiple locations" feature would need.
- All schema changes as Supabase migrations in `supabase/migrations/`. Seed data in `supabase/seed.sql` (3 New York salons with services, professionals, hours and photos placeholders).

## 8. Availability logic

Free time for a professional on a date =
`availability` (that weekday) ∩ `business_hours` (that weekday) − `breaks` − `time_off` − existing `confirmed`/`pending_payment` bookings.

- Offer a start time only if the **whole duration of the chosen services** fits inside one free window. Starts every 15 minutes. Nothing in the past or less than 1 hour from now.
- **Anyone**: merge slots across active professionals who offer all chosen services; assign the one with the fewest bookings that day.
- Group returned slots into Morning (before 12:00), Afternoon (12:00–16:59), Evening (17:00+).
- Implement as one pure function `getAvailableSlots()` in `src/lib/availability.ts`, also run server-side in an Edge Function before a booking is created. Unit tests must cover: closed day, breaks, a booking mid-day, a service too long for the last gap, time off across midnight, and the daylight-saving change weeks.

## 9. Payments and cancellations

- **Salon onboarding:** "Continue to Stripe" calls an Edge Function that creates a Connect Express account and returns an Account Link; open it with `expo-web-browser`; return URL is a deep link `hairday://business/payouts`. Webhook `account.updated` sets `payouts_enabled`. A business can't be published until payouts are enabled.
- **Customer payment:** Edge Function creates a PaymentIntent (destination charge to the salon; Hairday fee in `application_fee_amount`; tip goes 100% to the salon). App shows Stripe **PaymentSheet** with Apple Pay and Google Pay enabled. Saved cards via Stripe Customer.
- **Tip:** 15% / 18% / 20% / None of the services subtotal, default 18%.
- **Hold the slot:** booking is created as `pending_payment` when the customer taps Continue on "Pick a time"; a cron job releases it after 10 minutes if unpaid.
- **Cancellation:** more than 24 h before → full refund of services (+ tip); less than 24 h or no-show → refund 50% of services, tip refunded in full; salon cancels → everything refunded including the fee. The cancel sheet must show the exact refund amount before the customer confirms.
- **Walk-ins** created from the owner Calendar skip online payment (`source = walk_in`).
- **Webhooks:** `payment_intent.succeeded`, `payment_intent.payment_failed`, `charge.refunded`, `account.updated`. Verify signatures. Make handlers safe to run twice.
- Use **Stripe test mode only** until the owner says to switch.

## 10. Screens

Each row names the design file in `design/screens/`. Routes are Expo Router files under `app/`.

### Customer

| Screen | Design file | Route | Must do |
|---|---|---|---|
| Welcome | `Welcome.html` | `app/(auth)/welcome.tsx` | Photo hero; Continue with Apple (iOS only), Google, email; Skip (browse without account — ask to sign in at checkout); Terms + Privacy links; "List your business" |
| Verify email | `Verify.html` | `app/(auth)/verify.tsx` | 6 boxes, auto-advance, paste and iOS/Android one-time-code autofill (`textContentType="oneTimeCode"` / `autoComplete="sms-otp"`), resend after 60 s, code expires in 10 min |
| Home | `Main.html` | `app/(customer)/(tabs)/index.tsx` | Greeting, location pill, search, 6 service tiles, "Your next appointment" card when there is one, tabs Home / Explore / Bookings / Profile |
| Search results | `Results.html` | `app/(customer)/(tabs)/explore.tsx` | Map with price pins (tap pin → highlights card) + salon cards (3 photos, name, rating, distance, open-until, from-price, Book). Ask for location here the first time, not at launch; if denied, use New York |
| Filters | `Filters.html` | bottom sheet over Explore | Service chips (multi), When (Today / Tomorrow / Pick date), price range, sort (Nearest / Top rated / Lowest price), Reset, "Show N salons" live count |
| Salon page | `Salon.html` | `app/salon/[id].tsx` | Photo gallery, share (native share sheet with a salon link), favorite, name, rating, address, hours; tabs Services / Team / Reviews / About (amenities, health & safety, contact, socials, cancellation policy); add/remove services; sticky bar with count, price, duration → Choose a time |
| Professional | `Pro.html` | `app/pro/[id].tsx` | Photo, role, rating, Instagram; tabs Portfolio / Services / Reviews; "Book with [name]" |
| Pick a time | `Book.html` | `app/book/[salonId]/time.tsx` | Who (incl. Anyone), 7-day strip (swipe for more weeks), Morning / Afternoon / Evening slots, booked ones crossed out, sticky summary → Continue (creates the hold) |
| Review & pay | `Confirm.html` | `app/book/[salonId]/pay.tsx` | Summary, price breakdown, tip chips, payment method, cancellation note, Confirm booking → PaymentSheet |
| Booked | `Booked.html` | `app/book/[salonId]/done.tsx` | Success, Add to calendar (`expo-calendar`), Directions (opens Apple/Google Maps), View my bookings |
| My bookings | `MyBookings.html` | `app/(customer)/(tabs)/bookings.tsx` | Upcoming / Past; Upcoming: Directions, Reschedule, Cancel (sheet with exact refund, "Keep my booking" first); Past: Leave a review, Book again |
| Leave a review | `Review.html` | `app/review/[bookingId].tsx` | Stars with a word per level, quick tags, optional text and photo |
| Profile | `Profile.html` | `app/(customer)/(tabs)/profile.tsx` | Name/photo edit, favorites (salons + professionals), payment methods, notifications (push / email / SMS), location, help, privacy policy, terms, "Own a salon?" / "Switch to Business", sign out, **Delete account** |

### Owner (Business mode)

| Screen | Design file | Route | Must do |
|---|---|---|---|
| Today | `OwnerToday.html` | `app/(business)/(tabs)/index.tsx` | Stats, staff chips, day timeline with open gaps ("Add" walk-in), Week view link; tap a booking → details, mark completed / no-show, cancel |
| Calendar | `Calendar.html` | `app/(business)/calendar.tsx` | Week strip, one column per professional, open gaps, Walk-in sheet (client, service, professional, next open times) |
| Set up business | `Setup.html` | `app/(business)/setup.tsx` | 3 steps with progress: name/logo/type → address ("Use my current location", autocomplete, map pin) → open days + hours |
| Business profile | `BizProfile.html` | `app/(business)/(tabs)/business.tsx` | Logo, Preview (opens customer view of the salon), photos, links to Services / Team / Location & hours / Payouts, amenities, health & safety, About + socials, cancellation policy |
| Services | `Services.html` | `app/(business)/services.tsx` | Grouped by category, Add from catalog, edit sheet (price, duration stepper 15 min–8 h, description, show on profile), reorder |
| Add professional | `Team.html` | `app/(business)/team/[id].tsx` | Photo, name, role chips, services checklist, portfolio photos, Preview, Save and set hours |
| Availability | `Availability.html` | `app/(business)/(tabs)/hours.tsx` | Per professional: day switches + hours, breaks, time off; "changes only affect new bookings" |
| Clients | `Clients.html` | `app/(business)/(tabs)/clients.tsx` | Search as you type, filters, A–Z list, add client (email and phone validated separately with the right message under each), import from phone contacts (ask permission when tapped), visit history |
| Get paid | `Payouts.html` | `app/(business)/payouts.tsx` | Stripe onboarding steps, Continue to Stripe, payout schedule, late-cancel setting |

Every list needs an **empty state** and a **loading state** (tan skeleton blocks). Every form shows errors under the right field. Pull-to-refresh on lists. Haptic tick on selecting chips and confirming a booking.

## 11. Notifications

- Customer: booking confirmed, reminder 24 h before, reminder 2 h before, cancelled/refunded, review request 2 h after.
- Owner: new booking, cancellation, daily summary at 8 AM salon time.
- Push via Expo push service (store tokens in `push_tokens`); email via Resend; SMS via Twilio only if the owner says yes (Open question 6). Respect the user's toggles.
- Ask for push permission **after the first booking is confirmed**, not at launch.
- Tapping a notification deep-links to the booking.

## 12. Permissions (ask only when needed, with a plain reason)

| Permission | When | iOS text (`app.json` infoPlist) |
|---|---|---|
| Location (when in use) | First time the user opens Explore or taps "Use my current location" | "Hairday uses your location to show salons near you." |
| Notifications | After first booking | (system prompt) |
| Photos | Adding a review photo, logo, portfolio | "Hairday needs your photos so you can add pictures to your profile or review." |
| Camera | Same, when "Take photo" is chosen | "Hairday uses the camera so you can take a photo for your profile or review." |
| Calendar | "Add to calendar" | "Hairday adds your appointment to your calendar." |
| Contacts | Owner taps "Import from contacts" | "Hairday imports the contacts you choose into your client list." |

Never request a permission at app launch.

## 13. App store requirements (must be in v1)

- **Account deletion inside the app** (Profile → Delete account): deletes the account and personal data (reviews and photos too, unless legally required to keep), revokes Sign in with Apple tokens, says how long it takes. No email-us-to-delete. Required by Apple Guideline 5.1.1(v); Google Play also requires an in-app path and a web link.
- **Privacy policy** link in the app and on both store listings. Fill in Apple's privacy "nutrition label" and Google Play's Data safety form to match what the app collects.
- **Sign in with Apple** on iOS alongside Google.
- **No in-app purchase** for bookings; Stripe only.
- Android `targetSdkVersion` 36. iOS minimum version set by the Expo SDK.
- App icons, splash screen (navy background, Hairday logo from `design/brand/`), store screenshots for 6.9" iPhone and Android phone.
- Deep links: custom scheme `hairday://` now; universal links / app links once the domain is chosen.

## 14. Build phases

Build one phase at a time. At the end of each: run typecheck, lint and tests, run it on both iOS Simulator and Android Emulator, show the owner, then commit.

0. **Accounts (owner does these, Claude gives step-by-step help):** Apple Developer Program, Google Play Console, Expo account, Supabase project, Stripe account (test mode), Google Cloud project (Maps + Sign-In keys).
1. **Foundation** — Expo project, Expo Router, theme + fonts, base components (Button, Input, Card, Chip, Tabs, SegmentedControl, BottomSheet, Avatar, Skeleton, EmptyState), Supabase client, auth screens (Apple, Google, email code), profiles, migrations + seed, development builds for both platforms.
2. **Owner setup** — set-up flow, business profile, services, team, availability, photo upload, Business mode switch.
3. **Discovery** — home, explore with map + list, filters, salon page, professional page, favorites, share links.
4. **Booking engine** — `getAvailableSlots` + tests, pick-a-time, hold + release job, exclusion constraint.
5. **Payments** — Stripe Connect onboarding, PaymentSheet with Apple Pay / Google Pay, tips, webhooks, cancellations and refunds.
6. **Owner day-to-day** — Today, Calendar, walk-ins, clients (incl. contacts import), no-shows.
7. **After booking** — My bookings, reschedule, reviews, notifications (push + email), add to calendar, directions.
8. **Store release** — account deletion, privacy/terms screens, permissions copy, icons/splash, accessibility pass (screen reader labels, 44 pt targets, large text), Maestro E2E on both platforms, EAS Build production, TestFlight + Play internal testing, store listings.

## 15. Not in v1

Staff logins, gift cards, packages and memberships, marketing messages to clients, multiple locations per business (keep the data model ready), languages other than English, dark mode, tablet-specific layouts, web version.

## 16. Definition of done for v1

- A new salon can sign up on iPhone or Android, add services, staff and hours, connect Stripe, and publish.
- A customer can find that salon, book, tip and pay with card / Apple Pay / Google Pay, get a confirmation and reminders, and cancel with the right refund.
- Two customers can't book the same professional at the same time.
- Account deletion works end to end.
- The app passes TestFlight and Google Play internal testing review.
