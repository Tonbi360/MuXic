# SoundBoard

A community-driven music PWA where users discover songs via YouTube/SoundCloud search, vote on a Song Board, share a Mixed Queue jukebox, contribute to a Daily Playlist, and recommend songs in a forum.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080, proxied at `/api`)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string
- Optional env: `YOUTUBE_API_KEY` — enables real YouTube search (falls back to mock)
- Optional env: `SOUNDCLOUD_CLIENT_ID` — enables real SoundCloud search (falls back to mock)

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite (music-app), Tailwind CSS v4, wouter routing, React Query
- API: Express 5 (api-server)
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec in `lib/api-spec/openapi.yaml`)
- Build: esbuild (CJS bundle for API server)
- UI: shadcn/ui components, lucide-react icons

## Where things live

- `lib/db/src/schema/` — Drizzle schema files (songs, users, playlists, songboard, queue, daily, forum, inbox)
- `lib/db/src/index.ts` — DB client export
- `lib/api-spec/openapi.yaml` — OpenAPI spec (source of truth for API contract)
- `lib/api-client-react/src/generated/` — Orval-generated React Query hooks
- `lib/api-zod/src/generated/` — Orval-generated Zod schemas for backend validation
- `artifacts/api-server/src/routes/` — All Express route handlers
- `artifacts/api-server/src/routes/index.ts` — Route registration
- `artifacts/music-app/src/pages/` — All 10 page components
- `artifacts/music-app/src/hooks/use-player.tsx` — Audio player context
- `artifacts/music-app/src/lib/auth.ts` — UUID-based user identity (localStorage)

## Architecture decisions

- **Anonymous identity via UUID**: No login required. UUID stored in localStorage, auto-registered on first profile visit.
- **Contract-first API**: OpenAPI spec drives both frontend hooks (Orval → React Query) and backend validation (Orval → Zod). Always run codegen after changing the spec.
- **Storage tiers**: `limited` (48h expiry), `permanent`, `public_limited` (48h community), `public_download` (permanent, 50 votes needed to graduate from Song Board).
- **Anti-spam built into routes**: Queue limited to 3 songs/hour via DB count; Forum has 30s cooldown via in-memory Map; Daily locked to 1 song/user/day; Votes deduplicated by songId+userId in DB.
- **YouTube/SoundCloud search falls back to mock data** when API keys are not set — useful for development without credentials.

## Product

- **Home**: Community stats, trending songs (last 24h votes), today's Daily Playlist preview, Queue status
- **Search**: YouTube + SoundCloud search with source tabs; import saves as 48h limited song and auto-nominates to Song Board
- **Library**: Personal song collection with storage type badges, countdown timers for expiring songs, sort/filter, promote to permanent
- **Playlists**: Create/delete personal playlists, add songs from library
- **Song Board**: Hot (24h), Legends (all-time), and Mini Board tabs; vote on songs; auto-graduates to `public_download` at 50 votes
- **Shared Queue**: Community jukebox with 3-song/hour token limit; veto system (3 vetos = auto-remove)
- **Daily Playlist**: 1 song/user/day submissions that reset at midnight; archive view by date
- **Forum (Recommendation Board)**: Threaded posts with mood tags (#Sad, #Gym, #Study, etc.); 30s anti-spam cooldown
- **Profile**: Auto-created UUID identity, display name editing, reputation/badges, Inbox for shared songs
- **Full Player**: Seek bar, volume, shuffle, repeat (one/double), sleep timer (15/30/60m), sleep timer countdown

## User preferences

_None recorded yet._

## Gotchas

- Always run `pnpm --filter @workspace/api-spec run codegen` after modifying `lib/api-spec/openapi.yaml`
- Always run `pnpm --filter @workspace/db run push` after modifying schema files in `lib/db/src/schema/`
- The API server re-builds on every `dev` restart (esbuild) — restart the workflow to pick up route changes
- Profile page always 404s on initial GET (user doesn't exist yet) then auto-registers — this is expected behavior
- `toSongResponse` is exported from `artifacts/api-server/src/routes/songs.ts` and imported by other route files — do not remove the export

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
