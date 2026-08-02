# Pending Decisions

Deferred items: decided on an approach but not implementing yet. Check this before starting related work.

---

## Storage access errors (sessionStorage/localStorage blocked)

**Status:** Chrome done (2026-08-02). Other browsers still pending.

**Problem:** Supabase's browser client (`lib/supabase/client.ts`) reads/writes `sessionStorage` on init. In some browser configurations (strict private/incognito mode, aggressive privacy settings, embedded iframes/in-app browsers, locked-down corporate policies), the browser throws `SecurityError` instead of silently no-op'ing, which currently crashes the app with an unhandled error screen.

**Decision:** Scope to Chrome first. Instead of a raw crash, detect the blocked-storage condition and show a friendly in-app UI telling the user what to do (e.g. "please disable private browsing / allow site storage"), rather than a stack trace. Other browsers (Safari, Firefox, Brave, etc.) to be handled in a later pass once the Chrome flow is validated.

**Implemented (Chrome only):**
- `lib/utils/storage-access.ts` — `isWebStorageAccessible()` and `isChrome()` checks.
- `components/system/StorageAccessGuard.tsx` (+ `.module.css`) — client-side guard wrapping `app/layout.tsx`'s `{children}`. If Chrome + storage blocked, shows a card with steps to fix it (site settings → allow cookies/site data, or leave Incognito) and a Reload button, instead of children crashing.

**Still pending:**
1. Extend detection/messaging to other browsers (Safari, Firefox, Brave, Edge, in-app/embedded webviews) once the Chrome flow is validated with real users.
2. Consider whether `lib/supabase/client.ts` itself needs a fallback (e.g. in-memory storage) for cases the UI guard doesn't catch (storage revoked mid-session, not just on load).
