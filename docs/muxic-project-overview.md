# MuXic — Full Project Overview

> Community-Driven Music PWA · React + Vite + Express + PostgreSQL · Anonymous UUID identity

---

## What Is MuXic?

MuXic is a community-driven music PWA where users discover songs via YouTube and SoundCloud search, vote on a Song Board, share a Mixed Queue jukebox, contribute to a Daily Playlist, and recommend songs in a forum-style board. No account creation or login is required — each browser gets a unique anonymous identity automatically.

The app is a shared music station: the community collectively curates what's trending, what's in the jukebox, and what's recommended today. Songs that earn enough votes graduate to permanent public status.

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 19 + Vite, Tailwind CSS v4, wouter routing, React Query, shadcn/ui |
| **Backend** | Express 5, Zod validation, OpenAPI 3.1 spec, Orval codegen |
| **Database** | PostgreSQL with Drizzle ORM, drizzle-zod for validation bridging |
| **Monorepo** | pnpm workspaces, Node.js 24, TypeScript 5.9, esbuild for API bundling |
| **Audio** | YouTube IFrame API (YouTube tracks), HTML5 Audio (SoundCloud/direct URLs) |
| **Mobile** | PWA-ready, responsive, Media Session API for OS lock screen controls |

---

## Monorepo Structure

```
artifacts/
  music-app/          ← React + Vite frontend (served at /)
  api-server/         ← Express 5 API (served at /api)

lib/
  db/                 ← PostgreSQL schema + Drizzle ORM client
  api-spec/           ← OpenAPI 3.1 YAML spec (source of truth)
  api-client-react/   ← Orval-generated React Query hooks
  api-zod/            ← Orval-generated Zod schemas for backend validation
```

---

## Architecture Decisions

**Anonymous Identity** — No login required. A UUID is generated and stored in `localStorage` on first visit. The user is auto-registered in the database on first profile view.

**Contract-First API** — `lib/api-spec/openapi.yaml` is the single source of truth. Orval generates both frontend React Query hooks and backend Zod validation schemas from it.

**Storage Tiers:**
- `limited` — 48h expiry (default for imported songs)
- `permanent` — user-promoted, never expires
- `public_limited` — community, 48h expiry
- `public_download` — graduated via 50 votes, permanently public

**Anti-Spam Built In:**
- Queue: 3 songs/hour per user (enforced at DB level)
- Forum: 30-second cooldown between posts
- Daily: 1 submission/user/day
- Votes and vetos: deduplicated at DB level per (songId, userId)

**Proxy Routing** — `/` → music-app, `/api` → api-server. Services never communicate directly.

---

## Features

### 🏠 Home
- Community stats: total songs, members, votes, forum posts
- **Trending Now**: top 5 songs by votes in last 24h (falls back to all-time)
- Today's Daily Playlist preview (first 5 songs)
- Mixed Queue status (shown when songs are queued)

### 🔍 Search
- YouTube + SoundCloud tabs
- Real API search when `YOUTUBE_API_KEY` is set; falls back to mock data
- Play preview directly from search results (without saving)
- **Import**: saves song as `limited` (48h) to library and auto-nominates to Song Board

### 📚 Library
- Personal song collection (filtered by UUID)
- Storage type badges with color coding (amber/green/blue/pink)
- Countdown timers on expiring songs (hours + minutes remaining)
- Sort by: newest, oldest, title, artist, most voted
- Filter by storage type; text search by title/artist
- Actions: **Play**, **Share to inbox**, **Promote to permanent**, **Delete**
- Share modal: pick any user, add an optional message, sends to their inbox

### 🎵 Playlists
- Create named personal playlists
- Add songs from your library (prevents duplicates)
- Remove songs from a playlist
- Play songs directly from within a playlist
- Delete playlists

### 🏆 Song Board
- **Hot tab**: ranked by votes cast in the last 24 hours
- **Legends tab**: all-time highest vote count
- **Mini Board tab**: all nominated songs, newest first
- Votes deduplicated per user per song at DB level
- **Auto-graduation**: at 50 votes → upgrades to `public_download`, expiry cleared permanently

### 🎚️ Mixed Queue (Shared Jukebox)
- Community jukebox — anyone can add songs
- **Token system**: 3 tokens per hour per user; visual dot meter shows usage
- Add from your library; songs already in queue are disabled
- **Veto system**: 3 vetos = song auto-removed; vetos are deduplicated
- Play button removes from queue and starts playing
- First song highlighted as "up next"

### 📅 Daily Playlist
- Each user can submit exactly 1 song per day
- Locked after submitting; resets at midnight (server date-based)
- **Archive tab**: browse past playlists grouped by date

### 💬 Forum (Recommendation Board)
- Post song recommendations or ask for suggestions
- Mood tags: `#Sad` `#Happy` `#Gym` `#Study` `#Chill` `#Party` `#Focus` `#Sleep`
- Filter posts by mood tag; paginated (20 per page)
- **30-second anti-spam cooldown** between posts
- **Threaded replies**: expand a post to read and add replies

### 👤 Profile
- Auto-created on first visit (`User_abc123` default name)
- Edit display name inline (upsert — creates or updates)
- Stats: Reputation, nominated count, upload count
- Badges: Lyricist, Music Guru, Nominator
- **Activity tab**: timeline of nominations, daily submissions, forum posts
- **Inbox tab**: songs shared by other users with sender name + message
- **Delete Account**: removes profile, clears local UUID, resets identity

### 🎧 Full Player (`/player`)
- Album art, title, artist, album
- Seek bar with time (current / total)
- Volume slider
- Shuffle toggle
- **Repeat modes**: Off → Repeat One (1) → Repeat All (∞)
- **Sleep timer**: 15 / 30 / 60 min with live countdown + cancel
- Source and storage type badges
- **Media Session API**: OS lock screen / notification controls with album art

### 📱 Mini Player
- Persistent bar on every page (except full player)
- Quick play/pause and next buttons; "Full player" link
- Desktop: right of sidebar · Mobile: above bottom nav bar

---

## API Endpoints

### Songs
| Method | Path | Description |
|---|---|---|
| GET | `/api/songs` | List songs (filter: category, storageType, search, sort) |
| POST | `/api/songs` | Create / import a song |
| GET | `/api/songs/:id` | Get a single song |
| PATCH | `/api/songs/:id` | Update song metadata |
| DELETE | `/api/songs/:id` | Delete a song |
| POST | `/api/songs/:id/promote` | Change storage tier |
| POST | `/api/songs/:id/tags` | Add a tag to a song |
| GET | `/api/categories` | List song categories with counts |

### Search & Import
| Method | Path | Description |
|---|---|---|
| GET | `/api/search/youtube` | Search YouTube (real or mock) |
| GET | `/api/search/soundcloud` | Search SoundCloud (real or mock) |
| POST | `/api/search/import` | Import a search result into the library |

### Song Board
| Method | Path | Description |
|---|---|---|
| GET | `/api/songboard` | List board entries (tab: hot / legends / mini) |
| POST | `/api/songboard/:songId/vote` | Vote on a song (deduped per user) |
| POST | `/api/songboard/:songId/nominate` | Nominate a song to the board |

### Mixed Queue
| Method | Path | Description |
|---|---|---|
| GET | `/api/queue` | Get current queue (ordered by position) |
| POST | `/api/queue` | Add song (enforces 3/hr token limit) |
| POST | `/api/queue/:id/veto` | Veto entry (auto-removes at 3 vetos) |
| DELETE | `/api/queue/:id` | Remove an entry |

### Daily Playlist
| Method | Path | Description |
|---|---|---|
| GET | `/api/daily` | Get today's entries |
| POST | `/api/daily` | Submit a song (1 per user per day) |
| GET | `/api/daily/archive` | Browse past playlists |

### Forum
| Method | Path | Description |
|---|---|---|
| GET | `/api/forum` | List posts (filter: moodTag, page, limit) |
| POST | `/api/forum` | Create a post (30s cooldown) |
| GET | `/api/forum/:id/replies` | Get replies for a post |
| POST | `/api/forum/:id/replies` | Reply to a post |

### Users & Profile
| Method | Path | Description |
|---|---|---|
| GET | `/api/users` | List all users (for sharing UI) |
| GET | `/api/users/:userId` | Get user profile |
| POST | `/api/users/:userId/register` | Create or update user (upsert) |
| DELETE | `/api/users/:userId` | Delete account |
| GET | `/api/users/:userId/activity` | Get activity timeline |
| GET | `/api/users/:userId/inbox` | Get inbox |
| POST | `/api/users/share` | Share a song to another user's inbox |

### Stats
| Method | Path | Description |
|---|---|---|
| GET | `/api/stats` | Community stats |
| GET | `/api/stats/trending` | Top songs by recent votes (24h window) |

---

## Database Schema

| Table | Key Columns |
|---|---|
| `songs` | id, title, artist, album, duration, coverUrl, source, sourceUrl, storageType, category, tags[], userId, expiresAt, voteCount, isPublic |
| `users` | userId (UUID), displayName, reputation, badges[] |
| `board_entries` | id, songId, nominatedBy, voteCount |
| `votes` | id, songId, userId — unique per (songId, userId) |
| `queue` | id, songId, userId, vetoCount, position |
| `queue_vetos` | id, queueId, userId — unique per (queueId, userId) |
| `daily_playlist` | id, songId, userId, date (YYYY-MM-DD) |
| `forum` | id, userId, content, moodTag, parentId (for replies) |
| `playlists` | id, name, userId, isPublic |
| `playlist_songs` | playlistId, songId — unique per pair |
| `inbox` | id, fromUserId, toUserId, songId, message |

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | ✅ Yes | PostgreSQL connection string |
| `SESSION_SECRET` | ✅ Yes | Secret for session signing |
| `YOUTUBE_API_KEY` | Optional | Enables real YouTube search (falls back to mock) |
| `SOUNDCLOUD_CLIENT_ID` | Optional | Enables real SoundCloud search (falls back to mock) |

---

## Developer Commands

| Command | What it does |
|---|---|
| `pnpm --filter @workspace/api-server run dev` | Run API server (port 8080) |
| `pnpm --filter @workspace/music-app run dev` | Run frontend dev server |
| `pnpm run typecheck` | Full TypeScript check across all packages |
| `pnpm run build` | Typecheck + build all packages |
| `pnpm --filter @workspace/api-spec run codegen` | Regenerate hooks + Zod schemas from OpenAPI spec |
| `pnpm --filter @workspace/db run push` | Push schema changes to database (dev only) |

> ⚠️ Always run **codegen** after modifying `lib/api-spec/openapi.yaml`, and **db push** after modifying schema files in `lib/db/src/schema/`. Restart the API server workflow after any route changes.
