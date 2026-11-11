# Design reference

These are the Hairday screens redesigned in November 2026 from the original 2021 Figma file. Each `.html` file is one phone screen at 390×844.

**How to use them (Claude Code):** read the file as a precise layout reference — every size, color, font, gap and piece of copy is written inline in the markup. The `<script>` at the bottom of each file shows the interactive behavior (which chip is selected, what a tab switches, what a sheet contains). They run inside a design tool, so they won't open correctly in a normal browser; don't try to render them, read them.

**How to see them (Dellon):** open the Hairday Redesign canvas in Claude and press Play on any screen. `hairday-home.jpg` is a finished render of the Home screen.

| # | File | Screen |
|---|---|---|
| 1 | `Main.html` | Home |
| 2 | `Results.html` | Search results (map + list) |
| 3 | `Salon.html` | Salon page |
| 4 | `Pro.html` | Professional |
| 5 | `Book.html` | Pick a time |
| 6 | `Confirm.html` | Review & pay (tips) |
| 7 | `Booked.html` | Booking confirmed |
| 8 | `Welcome.html` | Welcome / sign in |
| 9 | `Verify.html` | Email code |
| 10 | `Filters.html` | Filters sheet |
| 11 | `MyBookings.html` | My bookings (+ cancel sheet) |
| 12 | `Review.html` | Leave a review |
| 13 | `Profile.html` | Profile |
| 14 | `OwnerToday.html` | Owner: Today |
| 15 | `Calendar.html` | Owner: Calendar (+ walk-in sheet) |
| 16 | `Setup.html` | Owner: set up business (3 steps) |
| 17 | `BizProfile.html` | Owner: business profile |
| 18 | `Services.html` | Owner: services (+ edit sheet) |
| 19 | `Team.html` | Owner: add professional |
| 20 | `Availability.html` | Owner: availability |
| 21 | `Clients.html` | Owner: clients |
| 22 | `Payouts.html` | Owner: get paid (Stripe) |

Brand files (`brand/`):
- `logo-on-light.png` — transparent, gold + navy, for ivory/white screens
- `logo-on-dark.png` — transparent, gold + white, for navy screens and the splash
- `logo-original-navy.png` — the original square logo on navy (512×512), base for the app icon

Notes:
- Links between files (`href="Book.html"`) show the navigation flow.
- Tokens used everywhere: see `docs/SPEC.md` §5.
- Fonts: Instrument Serif (headlines) and Inter (everything else), both from Google Fonts.
