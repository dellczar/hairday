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
