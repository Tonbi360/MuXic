# MuXic — Update & Fix Request

This is a consolidated list of bugs, missing features, and improvements found through manual testing. Please work through it in the order given below — features and fixes first, polish next, security and full testing pass last. Each item includes enough context to act on directly; ask if anything is ambiguous rather than guessing.

---

## 1. Structural Issue — Identity & Trust Model (address early, even though security work is otherwise last)

Currently, user identity is just a UUID stored in `localStorage`, and the server appears to trust whatever `userId` is sent with a request rather than independently verifying ownership. Before building more features on top of this (personal queue, profile pictures, etc.), please confirm and fix:

- A user should not be able to edit, delete, or act on another user's data (profile, playlists, songs, account) just by knowing or guessing their UUID.
- All per-user limits (vote dedup, 3 queue-adds/hour, 1 daily submission/day, 30s forum cooldown) must be enforced **server-side**, not just via disabled buttons in the UI.

This is foundational — please get this right now so later features don't need rework.

---

## 2. Bug Fixes

1. **404 on collapsing Full Player.** Navigating from `/player` back to the previous view (via the "Now Playing ⌄" collapse control) sometimes lands on a 404 page instead of returning to the prior screen. Likely a missing/incorrect fallback route or broken history navigation. Fix the navigation logic and ensure there's always a valid fallback (e.g. redirect to Home if no prior route exists).

2. **Orphaned Song Board entries after song deletion.** Deleting a song from the Library does not clean up references in `board_entries` — the board still shows an entry with no title/artist/cover. Add cascade deletes (or blocking deletion while still referenced) for **all** tables that reference `songId`: `board_entries`, `votes`, `queue`, `queue_vetos`, `playlist_songs`, `daily_playlist`, `inbox`. Confirm deletion is fully and completely cleared everywhere, no orphaned rows left behind.

3. **Severe text truncation in Library cards.** Song titles/artists in the Library list are cut off after ~4-5 characters (e.g. "Bruno Mars - That's What I Like" → "Brun...") despite available horizontal space. Compare to Song Board cards, which truncate much more reasonably. Likely a CSS sizing issue (fixed width/flex-basis too narrow) on the Library card's text container — fix so text uses available space before truncating.

4. **Page header flicker on Forum.** The H1 briefly shows "Board" before updating to "Recommendation Board" on the same page load, with no other content change. Looks like a placeholder/loading state that isn't being replaced cleanly. Fix so the header doesn't visibly change after initial render.

5. **Unstyled native dropdown in Library.** The "All types" / "Newest first" filter dropdowns render as plain browser UI instead of the app's dark theme. Replace with the existing shadcn `Select` component already used elsewhere in the app.

6. **No confirm/cancel on Playlist deletion**, and the delete icon is positioned too close to other controls, making accidental taps likely. Add a confirmation step (similar to the existing Account Deletion flow) and increase spacing/tap-target separation from adjacent buttons.

7. **No working queue/auto-play anywhere in the app.** See Section 3 below — this is the core feature gap, not a small fix.

8. **Sleep timer is untested** — please verify it actually stops playback when the countdown reaches zero, and cancels cleanly if the user taps cancel.

9. **Background/outside-app playback.** Understood that YouTube IFrame API restricts background playback for YouTube-sourced songs. Please confirm whether SoundCloud / direct HTML5 Audio sources can play in the background, since they aren't subject to the same restriction, and enable that if not already working.

---

## 3. Core Feature: Real Queue System (highest priority feature)

Right now, every "play" action plays one song and then stops — there is no underlying queue state, anywhere in the app. This needs to be fixed across the whole app, not just one screen:

- **New personal queue feature.** Users can add songs to their own queue and hit "play all" to auto-advance through it, without manually tapping each song.
- **One-tap "play all"** needed in every list context: Search results, Song Board (Hot / Legends / Mini Board tabs), Playlists, and the user's Library.
- **Mixed Queue should function as one continuous shared station** — currently it requires tapping each song manually. It should auto-advance through everything the community has added, in order, without requiring per-song taps. This is the app's core "shared jukebox" concept and currently doesn't work as intended.
- **Shuffle / alternate play order** option for queues and playlists.
- **Visible "up next" list** — a scrollable view of what's coming up in the current queue, not just the current "Now Playing" song.
- **Drag-to-reorder** within a personal queue or playlist.
- The Skip/Next button likely doesn't work properly right now precisely because there's no queue state to advance through — fixing the queue system should resolve this as well.

---

## 4. Profile & Account Safety

- Hide the user's UUID from the visible Profile page (keep it internally, just don't display it).
- Add profile picture upload support.
- Move "Delete Account" out of the main Profile page and into the hamburger/side menu, so it can't be accidentally tapped while browsing the profile.
- Require confirm/cancel on every destructive action app-wide (account deletion already has this pattern — apply it consistently everywhere, including Playlist deletion above).
- Please confirm whether the badge system (Lyricist, Music Guru, Nominator) and Reputation score are actually implemented and triggering. Testing shows 0 reputation and no badges despite a user having 4 nominations and 4 uploads. If they're not wired up yet, please implement them; if they are, explain the trigger conditions so we can verify.

---

## 5. Content & Moderation

- **Global duplicate-song prevention** — no two users should be able to have separate copies of the same song in the system (block at import/search-import time).
- **Forum word filter** for PG-13 content. A best-effort blocklist is fine — note that it won't catch every bypass (leetspeak, spacing tricks), but should catch obvious cases.
- **Let users delete their own forum posts.**
- **Collapsible hashtags on forum posts** — currently always fully shown; should default to a folded/compact state with an option to expand.
- **Collapsible Activity and Inbox lists** on the Profile page — currently can require a long scroll. Show a short preview with an "expand to view full list" option.
- **Mini Board needs to scale.** It currently shows every nominated song with no pagination, search, or sort — this will become a very long, unmanageable list as usage grows. Add search, sort (e.g. newest first), and pagination/infinite scroll, similar to what Library already has.

---

## 6. Data Safety

- **First-visit warning**: since identity lives only in `localStorage`, clearing browser data or switching devices permanently loses access to that identity, library, and reputation with no recovery. Add a one-time, dismissible notice explaining this on first visit.
- **Export/backup option**: allow a user to export or back up their identity (e.g. a recovery code or exportable file) so it can be restored later or on another device.

---

## 7. Inbox Spam Prevention

Song-sharing to another user's inbox currently has no rate limit. Add a cooldown similar to the forum's 30-second post cooldown, to prevent spam/harassment via repeated shares.

---

## 8. UI/UX Polish

- Keep the current visual identity (dark background, pink/magenta accent, serif display headers) — it's distinct and doesn't read as a YouTube clone. No changes needed here, just confirming it should be preserved through future changes.
- Align the hamburger menu and bottom nav — Library and Playlists are core, frequently-used features but are currently hamburger-only. Consider giving them more prominent placement.
- Fix naming inconsistencies between code/UI/docs: "Mixed Queue" vs "Shared Queue", "Daily Playlist" vs "Daily Mix", "Forum" vs "Board" vs "Recommendation Board" — pick one name per concept and use it consistently everywhere (nav, page headers, code).
- Remove the "0 votes" display from personal Library cards — voting is a Song Board concept and doesn't apply to personal library items, it's just confusing clutter there.
- Surface the app's invisible rules somewhere visible (queue tokens/hour, vote thresholds for graduation, cooldowns) via a small info icon/tooltip, so users understand why certain actions are limited.
- Accessibility pass: check color contrast (pink-on-black in places) and ensure icon-only buttons (share, veto, play, etc.) have proper labels/aria attributes for screen readers.
- Keep the volume slider in the Full Player, but it doesn't need visual priority — most mobile users will use hardware volume controls instead.
- Add a short, skippable first-visit walkthrough or tooltip tour for new users, given the app has several non-obvious concepts (Daily Playlist, Song Board tiers, Mixed Queue, Forum). Should never reappear after being dismissed once.

---

## 9. New Features

- **Explore page** — a discovery view where users can browse/play different songs from across the app.
- **"Surprise Me" button** — plays a random song from the app's library.
- **Personal queue** (see Section 3 — already covered as part of the core queue work).
- Optional, lower priority if time allows:
  - "X people listening now" or similar live activity indicator, to reinforce the "shared station" feel.
  - Recently played history.
  - Resume playback on reopen (remember last position/song on return).
  - External shareable link for a song/playlist (outside the current in-app inbox-only sharing).
  - Search history (recent searches in the Search page).
  - Like/heart as a lightweight personal action, separate from public Song Board voting.

---

## 10. Security & Full Testing Pass (do this last, but don't skip it)

Once the above is built, please run a full check for:

- **IDOR** — can one user act on another user's data by guessing an ID? (Related to Section 1 — verify the fix actually holds across all endpoints.)
- **SQL injection** — confirm no raw string-built SQL anywhere, especially in search/filter endpoints (Drizzle's parameterized queries should already prevent this, but please verify).
- **XSS** — confirm all user-generated content (forum posts, song titles, display names) is rendered as escaped text, never via `dangerouslySetInnerHTML` or equivalent.
- **Mass assignment** — confirm endpoints like `PATCH /api/songs/:id` can't be used to directly set fields that should only change via internal logic (e.g. `voteCount`, `isPublic`).
- **API key exposure** — confirm `YOUTUBE_API_KEY` and `SOUNDCLOUD_CLIENT_ID` never ship in the frontend bundle.
- **File upload validation** (for the new profile picture feature) — restrict file type and size server-side, not just client-side.
- **SSRF** — if any backend logic fetches a "direct URL" song source server-side, confirm it can't be pointed at internal/private network addresses.
- **Excessive data exposure** — check `/api/users` and similar endpoints don't return more than necessary.
- **Error leakage** — confirm failed requests never return raw stack traces or database error details to the client.
- **Dependency audit** — run `npm audit` (or equivalent) and address any known vulnerable packages.
- **Security headers** — confirm basic headers like `X-Frame-Options` / CSP are present.
- **General regression test** — after all the above changes, do a full pass through every feature in the app (Home, Search, Library, Playlists, Song Board, Mixed Queue, Daily Playlist, Forum, Profile, Full Player) to confirm nothing was broken by the changes, especially the queue system rework since it touches playback everywhere.

---

Please flag anything in here that's ambiguous or that you'd implement differently, rather than guessing — happy to clarify before you start if needed.
