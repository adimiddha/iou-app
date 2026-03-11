# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev       # Start dev server (http://localhost:5173)
npm run build     # Production build (outputs to dist/)
npm run preview   # Preview production build
npx eslint .      # Run linter
npx tsc --noEmit  # Type-check without emitting
```

## Architecture

This is a React + TypeScript SPA using Vite, with Supabase as the backend (auth, PostgreSQL DB, real-time subscriptions). Deployed to Vercel.

### Auth & Navigation Flow

```
Landing (unauthenticated)
  → AuthForm (email/password login or signup with optional phone)
    → Username Setup (new users only)
      → IOUDashboard (3 tabs: IOUs | Friends | Profile)
```

`App.tsx` owns session state and drives this top-level navigation. It listens to `supabase.auth.onAuthStateChange` and renders the appropriate view.

### Core Data Model (Supabase PostgreSQL)

- **`profiles`** — extends Supabase Auth users; stores username, avatar_url, phone_hash, phone_normalized, phone_search_enabled
- **`ious`** — tracks debts between two users; fields: from_user_id, to_user_id, description (type enum), amount, status, optional_note, requester_user_id
  - IOU types: Coffee, Beer, Meal, Walk, Ride, Pizza
  - Statuses: `pending`, `confirmed`, `pending_decrease`, `disputed`
- **`friendships`** — friend requests/acceptance; statuses: `pending`, `accepted`, `rejected`
- **`notifications`** — per-user notification records with is_read flag

All tables have Row Level Security (RLS) enabled.

### Key Source Files

| File | Purpose |
|------|---------|
| `src/App.tsx` | Root component; session management and view routing |
| `src/lib/supabase.ts` | Supabase client init and all TypeScript DB types |
| `src/components/IOUDashboard.tsx` | Main app UI with real-time Supabase subscriptions |
| `src/components/FriendRequests.tsx` | Friend request management |
| `src/components/Profile.tsx` | Avatar, phone settings, account management |
| `src/lib/phone-utils.ts` | Phone normalization and hashing logic |
| `src/components/ui/` | 50+ reusable shadcn/ui-style components |

### Real-time Updates

`IOUDashboard` and `NotificationBell` use `supabase.channel()` with `postgres_changes` to subscribe to live DB updates. When working on features involving data mutations, check for existing subscriptions that may need to handle new event types.

- **Subscription pattern**: call a reload function from the subscription callback — don't try to patch local state directly from the event payload. Stale closures will bite you.
- **Cleanup**: every `supabase.channel()` must be removed on component unmount. Check for existing cleanup logic before adding new channels.

### IOU Balance Logic

Balances are never stored — they're calculated at runtime by summing `amount` across all `confirmed` IOUs for a given friend-pair + type.

When any adjustment is made (forgive, increase, settle), the pattern is:
1. Fetch all `confirmed` IOUs for that pair + type
2. Calculate the new net balance
3. **Delete all** of those confirmed IOUs
4. Re-insert a single consolidated IOU at the new balance

Do not add individual adjustment records or try to mutate existing IOUs in place. The delete-recalculate-reinsert pattern is intentional.

### Confirmation Asymmetry (important)

- IOU logged where **you owe** someone → status is immediately `confirmed`
- IOU logged where **they owe you** → status is `pending`, requires their confirmation

This asymmetry is a core design decision. Don't change it. It prevents one-sided debt assignment.

### Notifications

Whenever a mutation affects another user, insert a `notifications` record for them. Check existing mutation functions in `IOUDashboard.tsx` for the pattern — type, title, message, and `related_user_id`/`related_iou_id` fields.

### Phone Numbers

Never send raw phone numbers to Supabase. Always normalize + hash client-side via `src/lib/phone-utils.ts` before querying or storing. The backend only ever sees the SHA-256 hex digest.

### Environment Variables

```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

Fallback hardcoded values exist in `src/lib/supabase.ts`, so the app runs without a `.env` file in development.

### Styling

Custom Tailwind color palette: `coral-*`, `sage-*` (plus standard `gray-*`, `red-*`, `green-*`). Check `tailwind.config.js` before reaching for a color that isn't showing up. UI components live in `src/components/ui/` — use them before writing custom markup.

### Path Aliases

`@/*` maps to `./src/*` (configured in `vite.config.ts` and `tsconfig.app.json`).

### Multi-entry Build

`vite.config.ts` configures two HTML entry points: the main app (`index.html`) and a standalone privacy policy page (`privacy.html`).
