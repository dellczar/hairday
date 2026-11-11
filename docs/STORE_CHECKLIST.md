# App store release checklist

Check each box before submitting. Claude Code will help with every step.

## Accounts (one-time)
- [ ] **Apple Developer Program** membership (paid yearly). If enrolling as a company, the company needs a D-U-N-S number — apply early, it can take days.
- [ ] **Google Play Console** developer account (one-time fee). New personal accounts must run a closed test with testers before going public — plan for it.
- [ ] **Expo** account, logged in with `eas login`.
- [ ] Decide the publisher name and the **bundle ID / package name** (SPEC §3).

## Both stores
- [ ] Privacy policy URL live, linked in the app (Profile) and in both store listings
- [ ] Terms of service URL live
- [ ] In-app **Delete account** works and is easy to find (Profile)
- [ ] Support email or URL
- [ ] App icon (1024×1024, no transparency for iOS), splash screen
- [ ] Screenshots: iPhone 6.9" and Android phone — Home, Salon, Pick a time, Review & pay, Owner Today
- [ ] Short description, full description, keywords, category (Lifestyle or Health & Fitness → Beauty)
- [ ] Demo accounts for reviewers: one customer, one salon owner with a published test salon (Stripe test mode is fine for review if noted)
- [ ] Every permission asked only when needed, with clear text (SPEC §12)
- [ ] Stripe switched to **live** keys for the production build (owner approves)

## Apple (App Store Connect)
- [ ] Sign in with Apple works
- [ ] App Privacy ("nutrition label") filled in: contact info, location, photos, purchases, identifiers
- [ ] Review notes explain: payments are for in-person salon services via Stripe (Guideline 3.1.3(e)), and how to log in with the demo accounts
- [ ] TestFlight build tested on a real iPhone
- [ ] Age rating questionnaire

## Google (Play Console)
- [ ] targetSdkVersion 36 (Android 16)
- [ ] Data safety form matches the privacy policy
- [ ] Account deletion web link added in the Data safety section
- [ ] Content rating questionnaire
- [ ] Internal testing → closed testing → production

## Final run-through on real phones
- [ ] New salon: sign up → set up → add services, team, hours → connect Stripe → publish
- [ ] Customer: sign up → search → book → tip → pay with Apple Pay / Google Pay → confirmation → reminder arrives
- [ ] Cancel more than 24 h out → full refund; less than 24 h → 50%
- [ ] Two phones try to book the same slot → only one succeeds
- [ ] Delete account → data gone, can't sign back in to old data
