# What changed (Sprint 0 + 1)

## Do these before using it
1. **Firebase console → Authentication → Sign-in method → enable _Anonymous_.**
   The public availability page signs players in anonymously (no account, no form).
2. **Deploy the rules:** `firebase deploy --only firestore:rules,storage`.
   The old rules let any player make themselves owner and any signed-in user read every team.
3. **Squad:** open *Squad*. If you had account-based players, an **Import into squad** button appears.
   Roster ids equal the old user ids, so old stats keep matching.

## New: availability without accounts
- Match page → **Create & share link** → paste in WhatsApp/Viber.
- Player opens `/a/<token>`, taps their name, taps *I can play / Maybe / Can't make it*. The device remembers who they are.
- Coach sees **Available · Maybe · No response · Unavailable** live, can set anyone's status in one tap, and **Copy reminder** lists only the players who haven't answered.
- Security model: the token is 128 random bits and can be fetched but not listed; anonymous players can only write a status for someone on that link's roster. Anyone holding the link can answer as any listed player — acceptable for a group-chat link, and `closed` / a per-player PIN can be added later without changing the flow.

## Fixed
- Club registration created the team before the user was signed in (rejected by the rules).
- Players could set their own `role` to `owner`; every collection is now scoped to the user's team.
- Storage: anyone could overwrite any team logo.
- Auth listener leak; `useMatches` stuck on loading; one realtime listener per match card.
- `npm run lint` had no config; it now runs (0 errors).
- Removed "AI Best XI" (it scored players with an invented default rating).

## Tests
- `npm test` — availability logic (11 tests).
- `npm run test:rules` — Firestore rules (needs Java + the emulator; **not run in the authoring environment**, please run it once locally).

## Not done yet (next sprints)
Visual pitch lineup builder · matchday events (goals/cards/subs) · match report/PDF · real stats · seasons · training RSVP via link · mobile bottom navigation.
