# FC Manager

A small, fast tool for amateur football teams: squad, availability by link, lineup, matchday, report, stats.
Built for "I have 5 minutes before kick-off". Next.js 16 · Supabase (Postgres) · Tailwind.

## Set up (about 10 minutes, all free)

1. **Create a Supabase project** (free plan).
2. **Run the schema:** Supabase → SQL Editor → paste `supabase/migrations/0001_init.sql` → Run, then `0002_personal_links_multi_team.sql` → Run. *(Already running 0001? Only run 0002.)*
3. **Auth settings:** Authentication → Providers → Email → turn **off "Confirm email"** (coaches sign up with email + password; players never sign up). Optionally turn on CAPTCHA under Authentication → Attack Protection.
4. **Env vars:** copy `.env.local.example` to `.env.local` and fill it in
   (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and the **server-only** `SUPABASE_SERVICE_ROLE_KEY`, plus any long random `LINK_HASH_SALT`).
   Set the same variables on your host (e.g. Vercel). Never expose the service-role key to the browser.
5. `npm install && npm run dev`, open the app, **New club** → create your account and club.
6. *(Free plan)* Supabase pauses a project after a week of no use. Set the GitHub repository variable `APP_URL`; `.github/workflows/keepalive.yml` then pings `/api/keepalive` twice a week.

## How it works
- **Teams:** one account can run several teams (U19, U17 …). Use the team name at the top (menu on desktop and phone) to switch, add a team, or join another with an invite code. Each team has its own squad, matches, coaches, seasons and stats.
- **Coaches/staff** sign in (owner / coach / staff). Extra coaches join with an invite code from Settings.
- **Players have no accounts.** A match or training has a public link `/a/<token>`. The player taps their name (or opens their **personal link**, see below), then *I can play / Maybe / Can't make it*. The coach sees Available · Maybe · **No response** · Unavailable, can answer for anyone, and **Copy reminder** lists only people who haven't answered.
- **Lineup:** pick a formation (or type e.g. `4-1-4-1`), drag players onto the pitch (or tap a player then a spot), bench, copy a previous lineup, **download as image** or share it straight to the group chat.
- **Auto-fill:** one tap fills the empty spots from the players who can play, using their positions (main + extra ones), this season's goals/assists, how regularly they start, and whether they said yes / maybe / nothing. It is plain rules, not an external AI: nothing leaves the app, you see what it did, and **Undo** reverts it. Players you placed yourself stay put.
- **Social post:** on a match, *Social post* writes an announcement, the starting XI or the final result in English, Shqip or Македонски (editable, copy or share).
- **Matchday:** Kick off → big buttons for goals, cards, subs, own goals → Full time. Stats are computed from the events.
- **Report:** view, copy as text for the group chat, PDF, print.
- **Seasons:** one is active; start a new one in Settings. Stats and lists are per season.

- **Languages:** English, Shqip, Македонски (switch on the login page or in the menu; the public player link follows the phone's language).
- **Install:** open the site on a phone → *Add to Home Screen*.

## Who is answering? (personal links)
A browser cannot read a MAC address or hardware ID, and an IP address changes with 4G or a VPN, so neither can identify a player. Instead the identity is in the link: **Availability → Personal links** gives every player their own link (and a WhatsApp button when the player has a phone number). Opening it needs no name tapping and works on any phone or network. The phone remembers who the player is for next time. In **Settings → Personal links only** the shared link stops listing names, so nobody can answer for someone else. IP addresses are used only, hashed, for rate limiting.

## Spam protection on public links
Unguessable 128-bit token · hidden honeypot field · minimum time-to-tap · same-origin check · answers only for people on that club's roster · per-device (60/min) and per-link (300/min) rate limits in the database · IPs are hashed with a secret salt and never stored · bots receive a normal-looking success and nothing is written.
The browser never talks to the public tables: only the server route, using the service key, can call the two `public_*` functions.

## Security model
Every table carries `team_id`; Row Level Security restricts reads to club members and writes to owner/coach/staff. Composite foreign keys make cross-club references impossible. Tested against a real Postgres engine (`npm test`).

## Scripts
`npm run dev` · `npm run lint` · `npm test` (160+ tests incl. SQL/RLS) · `npm run build`

## Not included on purpose
Transfers, finances, player attributes/ratings, match simulation.

## Landing page & owner invites

- `/` is a public landing page (English / Shqip / Македонски, follows the language switcher). Code in `src/components/landing/`, copy under the `lp.*` keys in `src/i18n/*`. Signed-in users see "Open the app" instead of sign-up buttons.
- Run **`supabase/migrations/0003_owner_invites.sql`** (after 0001 and 0002). Owners can now pick **Owner / Coach / Staff** when creating an invite code (Settings → Members) and change a member's role later.
