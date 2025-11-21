# IOU Summary Tab Wireframe

Low-fidelity wireframe for adding reciprocity on decreases, trust visibility, and an optional in-person settle helper.

## Mobile summary tab (list view)
```
┌───────────────────────────────────────────────┐
│ Header: "IOUs"                                │
│  • Filter chip: [All] [Pending ▲] [Settled]    │
├───────────────────────────────────────────────┤
│ Pending section (floats to top)               │
│                                               │
│ [Amber badge • Pending confirmation]          │
│  Adi ↔︎ Defna                                 │
│  • -1 Beer (Mark as paid → sent)              │
│  • Note: "IPA at Local Bar"                   │
│  • Buttons: [Cancel] [Nudge confirm]          │
├───────────────────────────────────────────────┤
│ Active IOUs                                   │
│                                               │
│ [Green badge • Mutual confirmed]              │
│  Adi owes You                                 │
│  • +2 Coffee                                  │
│  • Actions: [+ Add item] [Mark as paid]       │
│                                               │
│ [Amber badge • Pending confirmation]          │
│  You owe Defna                                │
│  • -1 Beer (awaiting their confirm)           │
│  • Button: [Cancel request]                   │
│                                               │
│ [Red badge • Disputed]                        │
│  You ↔︎ Defna                                  │
│  • -3 Tickets (flagged)                       │
│  • Button: [Resolve]                          │
└───────────────────────────────────────────────┘
```

### Key behaviors (P0)
- **Reciprocal confirmation on decreases:**
  - "Mark as paid" creates a pending item with amber badge; the recipient sees an approve/cancel prompt.
  - Increasing an IOU remains immediate, shows green badge once mirrored in both ledgers.
- **Trust visibility:**
  - Badges: green = mutual confirmed, amber = pending, red = disputed.
  - Pending rows float above confirmed ones; header chip "Pending" scrolls to the section.

## Detail sheet for "Mark as paid" (P0)
```
┌─────────────────────────┐
│ Sheet: Mark as paid     │
├─────────────────────────┤
│ Amount: 1 Beer (-1)     │
│ Optional note [        ]│
│ [Send for confirmation] │
│ Secondary: [Cancel]     │
└─────────────────────────┘
```
- After send: status = Pending (amber). Other user gets push + inline banner to "Confirm" or "Decline".

## Optional: "Settle together" checklist (P1/P2)
```
┌─────────────────────────┐
│ Sheet: Settle together  │
├─────────────────────────┤
│ Quick checklist:        │
│  [ ] Buy a beer         │
│  [ ] Say thanks         │
│  [ ] Snap a selfie      │
│ Add custom item [+]     │
│ Primary: [Mark done]    │
│ Secondary: [Skip]       │
└─────────────────────────┘
```
- When "Mark done" is tapped, a pending confirmation is sent to the other user (amber). On confirm, the associated decrease is applied and the badge becomes green.

## Empty/pending banner states
- Banner at top: "You have 2 pending confirmations" with quick links to each pending row.
- Empty pending state: friendly illustration + "No pending confirms. Settle something?"

## Colors & iconography
- Green (#16A34A), Amber (#F59E0B), Red (#DC2626) for badges; use consistent dot + label.
- Chevron or caret indicates expandable history per user pair.
