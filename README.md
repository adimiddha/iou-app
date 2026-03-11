# IOU App

An app for turning IOUs into excuses to hang out — log a coffee owed, get a reason to meet up.

---

## The Problem

Staying close with friends takes deliberate effort, and that effort needs a reason. The best reason is usually a small, lingering obligation: *"You still owe me that beer."* Those casual debts are social currency — they're low-stakes invitations to see each other again.

The problem is they evaporate. You forget who bought last round, the mental tally gets fuzzy, and eventually neither person brings it up. The debt that could have been a reason to hang out just disappears.

Venmo and Splitwise exist for money, but that's not what this is. Nobody is requesting $4.75 for a coffee. The friction is social, not financial. The specific people with this problem: close friends who actually want to keep score a little, not to collect, but because it gives them something to act on.

---

## The Solution

IOU App is a shared log of hangs between friends. When you grab coffee for someone, log it. When they give you a ride, log it. The balance sits there, visible to both of you, until one of you acts on it.

The point isn't settlement — it's momentum. An open IOU is a standing invitation.

**How it works:**

1. Add friends by username or phone number
2. Log a hang: pick a friend, a type (coffee, beer, meal, walk, ride, pizza), and direction (you owe / they owe)
3. If you log that someone owes you, they get a notification and must confirm — no unilateral debt assignment
4. Balances accumulate per type. When you're ready, you can forgive a debt, offer to settle, or add to your own tab
5. Any adjustment that affects the other person requires their approval; adjustments in your own favor don't

The result is a running, mutual record that gives both people a low-friction reason to reach out.

---

## Tradeoffs and Decisions

### Hang types with integer quantities, not dollar amounts

The most obvious design would be a single numeric balance per friend pair — you owe Alex $12.50. I went the opposite direction: balances are tracked by *type* (beers, coffees, meals) with integer quantities, and there's no money involved.

The tradeoff: you lose precision. A "meal" could be a $9 burrito or a $60 dinner. You also can't aggregate across types into one total balance.

The reason I kept it this way: the social object matters more than the monetary value. Saying "Alex has bought me 4 coffees and I've only bought 1 back" is more actionable than "$18.75." The types also create specific opportunities to settle — next time we get coffee, I'll get it. Dollar amounts make it feel like a debt to repay; hang types make it feel like a reason to see each other.

### Pending vs. confirmed: requiring mutual agreement

Early on, IOUs were logged and immediately counted — one person could unilaterally decide the other owed them something. I changed this so that IOUs you log *for yourself* (you owe someone) are immediately confirmed, but IOUs you log *against someone else* (they owe you) require their confirmation.

This added a whole confirmation flow that didn't exist before — a new `pending` status, a separate view for pending items, approve/decline buttons, notifications. It was a significant chunk of work.

The reason it was worth it: without mutual agreement the app feels adversarial. If someone can just say "you owe me 3 beers" and it shows up on your balance, it stops being a social tool and becomes a way to pressure people. Confirmation means both people have to agree the hang happened, which keeps the tone right.

### The summary tab layout: cards over a list

The first pass at the IOUs tab was a flat list — every IOU as a row, sorted by recency, with filter chips at the top for confirmed / pending / settled. It was a wireframe I explored in detail before building: sections with amber/green/red badges, pending items floating to the top, inline action buttons on each row.

I moved away from it in favor of summary cards grouped by friend. Instead of seeing individual IOU events, you see one card per friend that shows the net balance per hang type. You expand the card to take action.

The tradeoff: the flat list shows history; the card view doesn't. You can't see "Alex and I have grabbed coffee 6 times this year." The card view only shows the current net state.

The reason: the flat list got cluttered fast and the actions (forgive, settle, add more) are always about the *relationship*, not a specific IOU event. Grouping by friend made the right actions immediately obvious. The current-state view also reinforces the "excuse to hang out" framing — it's not a ledger of transactions, it's the current state of a friendship.

### Username placement: after account creation, not before

Originally the signup flow asked for a username first — before the account was created — which is the standard pattern for apps that want to front-load identity. I moved it to after: you create your account with email/password, then pick a username.

The problem with username-first: if account creation fails (bad password, email already taken), the user has already put effort into a username they can't use yet. Worse, the username they want might be taken and they'd have to re-enter their email and password after finding one that works. The flow felt backwards.

Moving username to after account creation means the hard parts (auth credentials, email verification) happen first. Username selection is then a lower-stakes step where you can iterate without re-entering anything.

### Phone search with client-side hashing

The friend discovery problem is real: usernames require coordination up front ("what's your username on that app?"). Phone numbers are the universal identifier people already have for each other.

Storing raw phone numbers and querying them server-side is the obvious approach. I chose not to. Instead, phone numbers are normalized to 10 digits, hashed with SHA-256 using the Web Crypto API entirely in the browser, and only the hash is ever sent to or stored on the server. When you search for a friend by phone, your app hashes the number locally and asks the backend "does this hash exist?" — the backend never sees the number.

The tradeoff: SHA-256 without a salt is deterministic and theoretically rainbow-tableable. The US has ~10 billion possible phone numbers, which is small enough to precompute against. For a high-stakes application this would matter. For a social hang tracker, the threat model doesn't justify the added complexity of a salted scheme, and the hashing still prevents casual database exposure — if the database leaked, raw phone numbers wouldn't be in it.

---

## What I Learned

**Real-time subscriptions need more thought than the happy path.** Supabase's `postgres_changes` subscriptions are easy to set up and feel like magic. The problem is that every component that sets up a channel needs to clean it up on unmount, and if you have multiple components subscribing to the same table, you can end up with redundant re-fetches or stale closures capturing old state. The pattern I landed on — call a reload function from the subscription callback, don't try to patch local state directly from the event payload — is more reliable.

**The consolidation approach loses history.** When a balance is adjusted (forgiven, settled, increased), the code deletes all confirmed IOUs for that friend-pair and type, recalculates the net, and re-inserts a single consolidated record. This is simple to reason about and keeps the DB clean. What it loses: transaction history. If you forgave 3 beers, there's no record of that; the balance just goes down. For this use case that's acceptable — the point is the current state of the relationship, not an audit log — but it's a real limitation.

**Known limitations:**
- No mobile app — it's a web app you can add to your home screen, but no native push notifications
- No group IOUs — everything is 1:1 between friends
- Balances don't roll up across types — you can't see "net, Alex owes me the equivalent of ~5 things"
- Phone hash lookup is US-centric (drops leading 1, assumes 10 digits)

**If I were to continue:**
- Push notifications (currently in-app only)
- A history/timeline view per friend
- Group hang support
- A reciprocity score or streak to surface who you've been neglecting

---

## Setup

```bash
npm install
npm run dev       # http://localhost:5173
npm run build     # Production build → dist/
npx tsc --noEmit  # Type-check
```

**Environment variables** (optional — dev fallbacks are baked in):
```
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

**Stack:** React 18 + TypeScript, Vite, Tailwind CSS, Supabase (Auth + PostgreSQL + Real-time), deployed on Vercel.
