# IOU App

A social IOU tracker for casual debts between friends — beers owed, coffees borrowed, meals shared.

---

## The Problem

You and your friends trade small favors constantly. One person grabs coffee, another gets the next round, someone gives a ride home. Over time, you develop a rough mental ledger: *"I feel like I've been getting more than I give lately."*

The problem is that mental ledger is invisible, so it either goes unaddressed or gets awkward. Venmo and Splitwise exist for money — but most of this isn't about money. Nobody is going to request $4.75 for a coffee. The friction isn't financial, it's social. People need a low-stakes way to acknowledge that a debt exists, without it feeling petty.

The specific people with this problem: close friend groups where reciprocity actually matters to them, but where bringing it up explicitly would feel weird.

---

## The Solution

IOU App lets you log hangs with friends — coffee, beer, meal, walk, ride, pizza — and track who owes whom. Both sides see the same balance. Neither person has to bring it up out of nowhere; it's just there.

**How it works:**

1. Add friends by username or phone number
2. Log a hang: pick a friend, a type (e.g. Beer), a quantity, and direction (you owe / they owe)
3. If you log that someone owes you, they get a notification and must confirm — no unilateral debt assignment
4. Balances accumulate per type. When you're ready, you can forgive a debt, offer to settle, or add to your own tab
5. Any adjustment that affects the other person requires their approval; adjustments in your own favor don't

The result is a running, mutual record that both friends can see and act on without an awkward conversation.

---

## Tradeoffs and Decisions

### Tracking by hang type, not by dollar amount

The most obvious design would be a single numeric balance per friend pair — you owe Alex $12.50. I went the opposite direction: balances are tracked by *type* (beers, coffees, meals) with integer quantities, and there's no money involved.

The tradeoff: you lose precision. A "meal" could be a $9 burrito or a $60 dinner. You also can't aggregate across types into one total debt.

The reason I kept it this way: the social object matters more than the monetary value. Saying "Alex has bought me 4 coffees and I've only bought 1 back" is more natural than "$18.75." The types also create specific, actionable opportunities to settle — next time we get coffee, I'll get it. Integer quantities mean there's no argument over exact values; the relationship is the unit of measurement.

### Phone search with client-side hashing

The friend discovery problem is real: usernames require coordination up front ("what's your username on that app?"). Phone numbers are the universal identifier people already have for each other.

Storing raw phone numbers and querying them server-side is the obvious approach. I chose not to. Instead, phone numbers are normalized to 10 digits, hashed with SHA-256 using the Web Crypto API entirely in the browser, and only the hash is ever sent to or stored on the server. When you search for a friend by phone, your app hashes the number locally and asks the backend "does this hash exist?" — the backend never sees the number.

The tradeoff: SHA-256 without a salt is deterministic and theoretically rainbow-tableable. The US has ~10 digits of phone number space, which is small enough to precompute. For a high-stakes application this would matter. For a social hang tracker, the threat model doesn't justify the added complexity of a salted scheme, and the hashing still prevents casual database exposure — if the database leaked, raw phone numbers wouldn't be in it.

---

## What I Learned

**Confirmation flows change social dynamics more than you'd expect.** The single biggest product decision in the data model is that IOUs you log *for yourself* (you owe someone) are immediately confirmed, but IOUs you log *against someone else* (they owe you) require their confirmation. This sounds obvious in hindsight, but it changed everything — it means neither person can feel like the app is being used against them. It also naturally surfaces disagreements: if someone thinks they bought 3 rounds and you only log 1, the number has to get negotiated.

**Real-time subscriptions need more thought than the happy path.** Supabase's `postgres_changes` subscriptions are easy to set up and feel like magic. The problem is that every component that sets up a channel needs to clean it up on unmount, and if you have multiple components subscribing to the same table, you can end up with redundant re-fetches or stale closures capturing old state. The pattern I landed on — reload function called from subscription callback, not inline data manipulation — is more reliable than trying to patch local state from the event payload.

**The consolidation approach loses history.** When a balance is adjusted (forgiven, settled, increased), the code deletes all confirmed IOUs for that friend-pair and type, recalculates the net, and re-inserts a single consolidated record. This is simple to reason about and keeps the DB clean. What it loses: transaction history. If you forgave 3 beers, there's no record of that; the balance just goes down. For this use case I think that's fine — the point is the current state of the relationship, not an audit log — but it's a real limitation if you ever wanted to show history or let people dispute a calculation.

**Known limitations:**
- No mobile app — it's a web app that you can add to your home screen, but no native push notifications
- No group IOUs — everything is 1:1 between friends
- Balances don't roll up across types — you can't see "net, Alex owes me the equivalent of ~5 things"
- Phone hash lookup is US-number-centric (drops leading 1, assumes 10 digits)

**If I were to continue:**
- Push notifications (currently in-app only)
- A history/timeline view per friend
- Group hang support
- A "streak" or reciprocity score to make the social dynamic more visible

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
