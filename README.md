# CardDue

A local-first, end-to-end encrypted credit-card due-date tracker that runs entirely in your browser. No accounts, no servers, no telemetry.

---

## Why this exists

Most "credit card managers" want either your bank credentials (Plaid-style aggregators) or your money (subscription apps). For people who just need to **remember which card is due when, how much they owe, and how that's trending** — but who don't want a third party watching their spending — there's surprisingly little in the middle.

CardDue is that middle. It's a Progressive Web App that:

- Stores every card, balance, and payment **only in your browser's IndexedDB**, encrypted under a key derived from your password.
- Has no backend. There's nothing to host, nothing to subscribe to, nothing to breach. Even if a static-hosting provider served a malicious copy of the code, an attacker still wouldn't have your data — it lives on your device.
- Works offline once installed (PWA + service worker).

The trade-off is the trade-off of any local-first app: **you are responsible for your own backup.** The Recovery Key in Settings is the only way back into a vault you've forgotten the password to. Lose both the password and the Recovery Key, and the data is gone.

---

## Use cases

Typical workflows the app is built around:

1. **"What's due this week?"** — open the Dashboard, see total outstanding, minimum required across all cards, the next card due, and any cards that are OVERDUE / DUE_SOON (≤ 7 days).
2. **"I just paid the Chase bill."** — expand the card on the Cards tab, type the amount, hit *Pay*. The balance drops, the due date rolls forward one month, the card flips to *PAID* for the new cycle, an entry lands in the activity log.
3. **"I scheduled an autopay for next Friday."** — same row, hit *Schedule* with the date instead. Card flips to *SCHEDULED*; alerts stop nagging until the cycle moves on.
4. **"Statement just posted, my balance jumped."** — *Update Balance* in the expanded card, enter the new number. Logs a `BALANCE_UPDATED` activity so you can see drift over time on the Activity tab.
5. **"I mistyped the credit limit."** — *Edit* on the expanded card opens a pre-filled form. No need to delete and re-add.
6. **"I lost my password."** — *Lost User ID or Password?* on login. Paste the Recovery Key you saved, set a new User ID and password, the vault is re-encrypted under the new key. Wrong key → recovery aborts before any data is touched (this was a data-loss bug pre-fix; see audit history).
7. **"Don't let me forget."** — toggle the bell icon (sidebar on desktop, bottom nav on mobile). When a card crosses into OVERDUE or due-in-3-days, the browser fires a desktop notification once per session.

Non-goals:

- ❌ No transaction-level tracking. CardDue is statement-level: balance, minimum, due date.
- ❌ No multi-device sync. The data lives in one browser profile. (Roadmap below.)
- ❌ No bank integration. You type the numbers in.

---

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│ Browser                                                  │
│                                                          │
│   ┌───────────────────────────────────────────────────┐  │
│   │ React 19 UI                                       │  │
│   │   Dashboard │ Cards │ Activity │ Settings         │  │
│   └─────────────┬─────────────────────────────────────┘  │
│                 │ useStore() context                     │
│   ┌─────────────▼─────────────┐                          │
│   │ StoreProvider             │                          │
│   │  • alert generation       │                          │
│   │  • cycle/status logic     │                          │
│   │  • encrypt on write       │                          │
│   │  • decrypt on read        │                          │
│   └─────────────┬─────────────┘                          │
│                 │                                        │
│   ┌─────────────▼─────────────┐    ┌──────────────────┐  │
│   │ Dexie (IndexedDB)         │    │ localStorage     │  │
│   │  cards: { id, payload }   │    │  user, hash,     │  │
│   │  activities:              │    │  salt,           │  │
│   │      { id, payload }      │    │  iter,           │  │
│   │  payload = AES(JSON, key) │    │  dismissedAlerts,│  │
│   │                           │    │  notif toggle    │  │
│   └───────────────────────────┘    └──────────────────┘  │
└──────────────────────────────────────────────────────────┘
```

### Layers

- **`src/App.tsx`** — top-level shell. Owns auth state and the active tab. Mounts `StoreProvider` only when an encryption key is present, and auto-locks the vault if the store reports a whole-vault decrypt failure (wrong key).
- **`src/components/`**
  - `LocalLogin.tsx` — three-mode auth (setup / login / recover). Derives the AES key from password + salt via PBKDF2.
  - `Dashboard.tsx` — totals, utilization, next-due, status counts, alert banners.
  - `CardsList.tsx` — list, add/edit forms, expanded actions (Pay, Schedule, Update Balance, Remove).
  - `ActivityTimeline.tsx` — chronological log, grouped by day.
  - `Settings.tsx` — reveal/copy the Recovery Key (= the encryption key).
  - `NotificationSettings.tsx` — bell-icon toggle, requests browser permission, persists choice.
- **`src/hooks/useStore.tsx`** — single React context that owns *all* mutations. Reads encrypted rows via `useLiveQuery`, decrypts in a `useMemo`, exposes `addCard / updateCard / deleteCard / markPaid / markScheduled / updateBalance / addActivity / dismissAlert / getCardStatus`. Generates alerts and computes per-card status from the cycle window (start = `dueDate − 1 month`).
- **`src/db.ts`** — Dexie schema. Two tables (`cards`, `activities`), each `{ id, payload }` where `payload` is the AES ciphertext. Schema v2 dropped the plaintext `date` index that previously leaked timestamps. `rekeyDatabase` validates the old key against a sample row, then re-encrypts everything in a single transaction.
- **`src/lib/crypto.ts`** — thin wrapper over `crypto-js`: PBKDF2 key derivation (100,000 iterations for new vaults; older accounts retain whatever they were created with, persisted in `localStorage` under `carddue-auth-iter`), AES encrypt/decrypt, salt + password hashing.
- **`src/lib/notifications.ts`** — Web Notifications API wrapper, gated on a `localStorage` toggle.
- **`src/main.tsx`, `vite.config.ts`** — Vite entry, PWA registration with an explicit "new version available" prompt (no silent updates).

### Data model

```ts
CreditCard {
  id, userId
  issuer, name
  balance, creditLimit, statementBalance, minimumPayment, interestRate
  dueDate          // YYYY-MM-DD; rolls forward one month each markPaid
  autopayStatus    // OFF | MINIMUM | STATEMENT | FULL | CUSTOM
  createdAt, updatedAt
}

Activity {
  id, userId, cardId?
  type             // PAYMENT_PAID | PAYMENT_SCHEDULED | BALANCE_UPDATED
                   // | CARD_ADDED | CARD_DELETED | REMINDER_SENT
                   // | TIP_VIEWED | ALERT
  text, date       // ISO timestamp; encrypted at rest
  amount?
  createdAt
}

ActionRequired { id, cardId, type, message } // ephemeral, derived
```

### Status & alert logic

A card's **cycle window** runs from `dueDate − 1 month` to `dueDate`. A `PAYMENT_PAID` or `PAYMENT_SCHEDULED` activity dated inside that window pins the card to PAID / SCHEDULED. Otherwise:

- `diffDays(dueDate, today) < 0` → **OVERDUE**
- `≤ 7` → **DUE_SOON**
- otherwise → **UPCOMING**

When `markPaid` runs it both subtracts from the balance and rolls `dueDate` forward, so the next cycle is tracked automatically without manual upkeep.

### Security model

| Asset | At rest | In memory |
|---|---|---|
| Card details, activity log | AES-encrypted in IndexedDB | Decrypted only in the `useStore` `useMemo` |
| Encryption key | Never persisted | Held in React state for the session |
| Password | Never persisted | Hashed (SHA-256 + salt) for auth check; thrown away after key derivation |
| Salt, hash, iteration count, username | Plaintext in `localStorage` | — |

Threats handled:

- **Static hosting compromise** — there's no API to call, no token to leak. An attacker would have to ship malicious JS *and* trick you into running it; even then they only get what you type in *that* session.
- **Stolen device** — vault unlocks only with the password (or the Recovery Key). Wrong key → decrypt fails → app auto-locks.
- **Wrong recovery key** — rekey is gated behind a probe-decrypt of one record before any write. Mistyped recovery keys can't corrupt the vault.

Threats **not** handled:

- **Compromised browser / malicious extension** — anything running in the same origin can read your IndexedDB and observe the in-memory key.
- **Brute force of weak passwords** — PBKDF2-SHA256 at 100k iterations is not a password manager-grade KDF. An 8-character password is the floor; longer is better.
- **No authenticated encryption** — crypto-js AES uses CBC+HMAC-less. Tampering manifests as a JSON parse error rather than an integrity failure. Migrating to WebCrypto AES-GCM is on the roadmap.

---

## Tech stack

- **React 19** (function components, hooks, context only — no Redux/Zustand)
- **TypeScript** with `tsc --noEmit` as the lint step
- **Vite 6** + `vite-plugin-pwa` (Workbox)
- **Tailwind CSS 4** via `@tailwindcss/vite`
- **Dexie 4** + `dexie-react-hooks` (`useLiveQuery`) for IndexedDB
- **crypto-js** for PBKDF2 + AES (slated for replacement, see roadmap)
- **date-fns** for all calendar math
- **lucide-react** for icons

No state library, no router (single SPA with tab state), no test framework yet (see roadmap).

---

## Run locally

**Prerequisites:** Node.js ≥ 18.

```bash
npm install
npm run dev      # http://localhost:3000
```

Other scripts:

```bash
npm run lint     # tsc --noEmit
npm run build    # vite build → dist/
npm run preview  # serve the production build locally
npm run clean    # rm -rf dist
```

The app installs as a PWA; on most browsers, the address bar offers an "Install" affordance after the first visit.

### First-run flow

1. Open the app → "Create Local Vault" screen.
2. Pick a User ID and a password (≥ 8 chars). The password derives the AES key; it never leaves your device.
3. Add your first card. Done.
4. Open Settings → reveal the Recovery Key → save it somewhere safe (password manager, printed copy). Without it, a forgotten password means a wiped vault.

---

## Project layout

```
src/
  App.tsx                       # shell, auth state, tab routing
  main.tsx                      # PWA registration, root render
  db.ts                         # Dexie schema + rekey
  types.ts                      # CreditCard, Activity, ActionRequired
  index.css                     # Tailwind entry
  components/
    LocalLogin.tsx
    Dashboard.tsx
    CardsList.tsx
    ActivityTimeline.tsx
    Settings.tsx
    NotificationSettings.tsx
  hooks/
    useStore.tsx                # the only mutation surface
  lib/
    crypto.ts                   # PBKDF2 + AES wrappers
    notifications.ts            # Web Notifications API
    utils.ts                    # cn(), formatCurrency, calculateUtilization
public/                         # static assets, PWA icons
metadata.json                   # applet manifest (name/description)
vite.config.ts
tsconfig.json
package.json
```

---

## Roadmap

Near-term (small, well-scoped):

- **AES-GCM via WebCrypto.** Replace crypto-js so we get authenticated encryption and a faster KDF (Argon2id where supported, fallback PBKDF2 with much higher work factor). Will require a one-time migration on next login.
- **Export / Import.** A signed, encrypted JSON dump that round-trips into a new browser profile. The cleanest backup story.
- **Per-card cycle length.** Hard-code is "1 month"; some users have non-monthly billing. Add an optional `cycleDays` and use it in `findCycleActivity` and `markPaid`.
- **Tests.** Vitest + Testing Library. Start with `useStore` (alert/status logic, cycle math) and the `rekeyDatabase` happy-path + wrong-key failure mode.
- **Edit / delete an activity.** Today the activity log is append-only; mistyped balance updates can't be corrected.

Medium-term:

- **Optional E2E sync** between devices via a user-supplied storage backend (Dropbox / Google Drive / a self-hosted endpoint). Keep zero-knowledge: the host sees only ciphertext.
- **Forecasting.** Project balance trajectory based on historical `BALANCE_UPDATED` activities + interest rate; surface "if you only pay minimum, here's the payoff date".
- **Smarter alerts.** "Your statement balance jumped 40% vs last cycle"; "this card has been at 80%+ utilization for 3 cycles".
- **iCal feed.** Subscribeable `webcal://` URL of upcoming due dates so reminders ride alongside other calendars.

Long-term, optional:

- **Browser extension** that scrapes statement balance + due date from logged-in issuer pages locally, no scraping over the network. (User runs the extension; CardDue never sees the credentials.)
- **Native wrappers** (Tauri / Capacitor) for users who'd rather not run a PWA.

Things explicitly *not* on the roadmap:

- Plaid / bank-credential aggregation.
- A hosted backend or accounts service.
- Telemetry of any kind.

---

## Contributing

This is a single-author project at the moment. If you're interested in moving any roadmap item, open an issue first to align on scope — the architecture deliberately keeps things small and a PR that bolts on a state library or a backend won't land.

Coding conventions:

- Mutations go through `useStore`. Components don't talk to Dexie directly.
- Keep components stateless where possible; the store is the source of truth.
- Fire-and-forget promises are bugs. Wrap async user actions in `runAction` (CardsList) or equivalent so failures surface in the UI.
- No new dependencies without a real reason — the bundle is currently ~445 KB (~143 KB gzipped) and that's a feature, not an accident.

---

## License

Apache-2.0 (see SPDX header in `src/App.tsx`).
