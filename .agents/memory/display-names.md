---
name: Display names vs UUIDs
description: Multiple pages showed truncated UUIDs instead of user display names
---

Song Board (nominatedBy), Daily Playlist (userId), and Queue (userId) all showed truncated UUIDs like "25ce0c36…" instead of real names. Fixed by importing useListUsers in each page and building a Map<userId, displayName> for lookups, with fallback to truncated UUID.

**Why:** The API response objects include userId/nominatedBy as string fields; the display name join was not added to the buildXxx helper functions. Rather than changing the API spec/codegen, the frontend does a single extra useListUsers call per page.

**How to apply:** When showing any userId field in the UI, always resolve it via the users map. The pattern is: `const userMap = new Map((users ?? []).map((u) => [u.userId, u.displayName]));`
