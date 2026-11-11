# Hairday — Claude Code handoff

Everything Claude Code needs to build the Hairday app for iPhone and Android.

## What's in this folder

| File | What it's for |
|---|---|
| `CLAUDE.md` | Standing instructions Claude Code reads automatically every session |
| `docs/SPEC.md` | The full build spec — screens, data, payments, store rules, build phases |
| `docs/PROMPTS.md` | The exact messages to paste into Claude Code, phase by phase |
| `docs/STORE_CHECKLIST.md` | What the App Store and Google Play need before launch |
| `docs/DECISIONS.md` | Decisions made so far (Claude Code keeps adding to it) |
| `design/` | The 22 redesigned screens + the Home screen image |
| `.env.example` | The keys you'll collect in Phase 0 |

## How to start

1. Unzip this folder somewhere easy, e.g. `Documents/hairday`.
2. You'll need a Mac to build and test the iPhone version (Xcode + iOS Simulator). Android works on Mac or Windows (Android Studio + emulator). Claude Code walks you through installing both.
3. Open Claude Code **in this folder**.
4. Paste the "Start" prompt from `docs/PROMPTS.md`.
5. Answer the open questions it asks (booking fee, bundle ID, publisher name...), then go phase by phase.

Tip: commit after every phase so you can always go back.
