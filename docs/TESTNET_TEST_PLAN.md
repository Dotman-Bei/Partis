# Testnet test plan

Run this on **https://partis-seven.vercel.app** (BOT Chain Testnet) before mainnet. It covers
every PRD §5 step and every threat in `THREAT_MODEL.md` that a person can trigger. Takes about
30 minutes with 3 people, or one person with 3 wallets and a phone.

Everything here creates real testnet records, so name the event honestly (e.g. "Partis test
run") — PRD §3.5: never present test activity as real usage.

## Setup

| Role | Device | Needs |
|---|---|---|
| **Organizer** (wallet A) | laptop | MetaMask or BO Wallet, ~1 tBOT |
| **Attendee** (wallet B) | phone | wallet app with in-app browser, ~2 tBOT |
| **Staff** (wallet C) | phone with camera | wallet app with in-app browser, ~0.5 tBOT |

- tBOT faucet: https://faucet.botchain.ai/basic (10 tBOT per address per 24h)
- Network: BOT Chain Testnet, chain ID `968`, RPC `https://rpc.bohr.life`. The app offers to add
  it when you connect.
- On phones, open the site **inside the wallet app's browser** so the wallet can connect.

## 1. Organizer creates an event (wallet A)

- [ ] Organizer → Connect → ＋ Create event.
- [ ] Fill the sentence: start time **30–60 minutes from now**, check-in opens **60** minutes
      before (so check-in is open right away), **paid** at `0.5` BOT, supply `5`, one per wallet.
- [ ] Preview reads correctly → Create event → confirm in wallet → "Event published".
- [ ] Event appears on Events and the Home counters go up.
- [ ] Staff → add wallet C's address → it appears in the list.

## 2. Attendee buys a pass (wallet B, phone)

- [ ] Open the event link (Organizer can use "Copy link").
- [ ] Connect → "Buy pass · 0.5 BOT" → confirm → "Pass issued to your wallet".
- [ ] Try buying again → blocked: "This wallet already claimed its pass".
- [ ] My Passes shows the pass as **ACTIVE**, with date, venue and check-in status.
- [ ] Optional: the pass image (wallet NFT tab or BOTScan token page) shows the Partis logo.

## 3. Check-in at the door (wallet C, phone camera)

- [ ] Attendee: My Passes → Show QR → **Sign entry QR** (free, no gas).
- [ ] Staff: Check-In → enter the event ID → "Your role: Staff".
- [ ] Start camera → scan the attendee's QR → **Valid pass**, "Holder signature verified".
- [ ] Confirm check-in → confirm in wallet → **Checked in**.
- [ ] Scan the same QR again → **Do not admit — Already checked in**.
- [ ] Attendee's My Passes now shows **CHECKED IN**.

## 4. Things that must fail (any wallet)

- [ ] **Unauthorized:** a 4th wallet (or wallet B) opens Check-In for the event → "This wallet
      can't check people in for this event."
- [ ] **Wrong event:** organizer creates a second free event, attendee claims it; staff on
      event 1 scans that pass → "Pass is for a different event".
- [ ] **Fake pass:** staff types `999` → "Pass does not exist".
- [ ] **Stale QR:** a screenshot of a signed QR older than 10 minutes → "Entry code expired".
- [ ] **Transfer after use:** try sending the checked-in pass to another wallet from the wallet
      app → the transaction fails.

## 5. Money (optional but recommended)

- [ ] Create a paid event that **ends soon** (e.g. 30 minutes long), sell one pass, wait for the
      end → Organizer card shows **Withdraw 0.5 BOT** → withdraw → wallet balance increases.
- [ ] Create another paid event, sell one pass, **Cancel event** → attendee opens the event →
      **Refund 0.5 BOT** → refund arrives; the pass disappears from My Passes.

## Record the result

- [ ] Run `./scripts/metrics.sh https://rpc.bohr.life 0x4caC8911DC322033861cda5Bc18d1496102b3ff9`
      and paste the output into `docs/BUILD_LOG.md`.
- [ ] Note anything confusing, slow or broken (with the device and wallet used) in the build log.
- [ ] If every box above is ticked and nothing is broken, the testnet gate in `DEPLOYMENT.md`
      is met except for a real event with real attendees.
