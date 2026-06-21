---
name: Profile 404 on load
description: GET /users/:userId 404s before auto-registration — this is expected behavior
---

The profile page always shows 2 console 404s on first load for a new browser session. The flow is: GET /users/:userId → 404 → useEffect triggers POST /users/:userId/register → invalidates cache → GET /users/:userId → 200. This is documented in replit.md as expected behavior. The activity/inbox endpoints do NOT return 404 (they query the DB directly and return empty arrays for non-existent users).

**Why:** The app uses anonymous UUID identity with lazy registration (no login page). The 404 is the signal to auto-register.

**How to apply:** Do not treat these 404s as bugs. The profile card shows correctly after registration completes (usually <300ms).
