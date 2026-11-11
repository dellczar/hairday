# Prompts to paste into Claude Code

Paste one prompt at a time. Wait until Claude Code says the phase is done and you've tried it on your phone or the simulator before pasting the next one.

---

### Start (first message in a new session)

```
Read CLAUDE.md and docs/SPEC.md. Then tell me in plain words:
1) what you understand we're building,
2) what I need to set up myself before Phase 1 (accounts and keys), as numbered steps,
3) which open questions in SPEC §3 you need answered first.
Don't write code yet.
```

### Phase 0 — Accounts

```
Walk me through Phase 0 one account at a time: Apple Developer, Google Play Console, Expo, Supabase, Stripe (test mode), Google Cloud (Maps + Sign-In). For each: exact steps, what to copy, and where to paste it in .env (use .env.example). Wait for me to say "done" before the next one.
```

### Phase 1 — Foundation

```
Build Phase 1 from SPEC §14. Set up Expo with Expo Router and development builds, the theme from SPEC §5 with both fonts, the base components, Supabase migrations and seed data, and the Welcome and Verify screens (Apple, Google, email code). Match design/screens/Welcome.html and Verify.html. When it runs on both iOS Simulator and Android Emulator, show me how to open it and commit.
```

### Phase 2 — Owner setup

```
Build Phase 2: Set up business (3 steps), Business profile, Services with the edit sheet, Add professional, Availability, photo uploads, and the "Switch to Business" option. Match the matching files in design/screens/. Add RLS tests for every new table.
```

### Phase 3 — Discovery

```
Build Phase 3: Home, Explore (map + list), Filters sheet, Salon page, Professional page, favorites and share links. Ask for location only when Explore opens the first time. Match the designs.
```

### Phase 4 — Booking engine

```
Build Phase 4: getAvailableSlots in src/lib/availability.ts with all the unit tests listed in SPEC §8, the Pick a time screen (Morning / Afternoon / Evening), the 10-minute hold and the release job, and the double-booking constraint. Show me the test results.
```

### Phase 5 — Payments

```
Build Phase 5 in Stripe test mode: Connect onboarding for salons, Review & pay with tips and PaymentSheet (Apple Pay + Google Pay), the webhook function, and the cancellation and refund rules in SPEC §9. Tell me which Stripe test card to use and walk me through a full test booking.
```

### Phase 6 — Owner day-to-day

```
Build Phase 6: Owner Today, Calendar with the Walk-in sheet, Clients (search, add, import from contacts), and marking completed / no-show.
```

### Phase 7 — After booking

```
Build Phase 7: My bookings (Directions, Reschedule, Cancel sheet with exact refund), Booked screen with Add to calendar, Leave a review, push + email notifications and reminders from SPEC §11.
```

### Phase 8 — Store release

```
Build Phase 8 from SPEC §13–14: in-app account deletion, privacy and terms links, permission text, icon and splash, an accessibility pass, Maestro end-to-end tests on both platforms. Then go through docs/STORE_CHECKLIST.md with me step by step and help me send builds to TestFlight and Google Play internal testing.
```

---

### Handy anytime

- **Something looks off:** `The <screen name> screen doesn't match design/screens/<File>.html — compare them and fix the differences. Here's a screenshot: <attach>`
- **Stuck on an error:** `I got this error: <paste>. Explain in plain words what's wrong and fix it.`
- **New session after a break:** `Read CLAUDE.md, docs/SPEC.md and docs/DECISIONS.md, check git log, and tell me where we left off.`
