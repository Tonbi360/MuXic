---
name: Playlist add-song gap
description: addSongToPlaylist and removeSongFromPlaylist were fully implemented in backend and codegen but had no UI
---

The `useAddSongToPlaylist` and `useRemoveSongFromPlaylist` hooks (operationId: addSongToPlaylist/removeSongFromPlaylist in the spec) were generated and the backend routes existed (POST /playlists/:id/songs, DELETE /playlists/:id/songs/:songId) but playlists.tsx never imported or used them. Fixed by adding an "Add song" picker panel and an "×" remove button in the playlist detail view.

**Why:** The spec and backend were built contract-first; the frontend page was scaffolded with only read/create/delete playlist but not song management.

**How to apply:** Always cross-check spec operationIds against what the frontend pages actually call when auditing completeness.
