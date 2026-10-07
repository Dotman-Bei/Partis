# Partis threat model

Scope: `PartisEventPass` + `PartisPassRenderer` (contracts) and the web app's verification
flow. This covers the eight threats PRD §23 requires, the privileged roles, and the residual
risks we accept for the MVP. Each mitigation names the test that proves it.

## Assets and trust boundaries

| Asset | Where it lives | Authority |
|---|---|---|
| Event config (times, supply, price) | contract storage | immutable after creation, except description/venue |
| Pass ownership | ERC-721 state | contract |
| Pass used / check-in state | `PassData.checkedInAt` | contract |
| Paid-pass funds | contract balance, tracked per event in `proceeds` | contract |
| Entry QR | attendee's screen | **untrusted input** — never authoritative |
| Event lists, stats in the UI | read from contract views | contract (no off-chain database) |

The frontend is a convenience layer. Every decision that matters (is this pass real, for this
event, unused, and may this wallet admit it?) is enforced by the contract, and the UI re-reads
contract state for every scan.

## Roles and privileges

There is **no protocol admin, owner, pauser or upgrade path**. The deployed bytecode is final.

| Role | Scope | Can | Cannot |
|---|---|---|---|
| Organizer | one event (the wallet that created it) | update description/venue, pause/resume sales, add/remove staff (≤50), cancel (before end, before any check-in), withdraw proceeds (after end), check in | change times, supply or price; touch other events; withdraw before the event ends; withdraw after cancelling |
| Staff | one event | `checkIn` for that event | anything else |
| Holder | own passes | transfer before check-in, refund after cancellation | check themselves in; transfer a used pass |
| Anyone | — | create events, claim/buy passes, read everything | — |

## PRD §23 threats

### 1. Copied QR
*Someone photographs or forwards another attendee's QR.*

- The QR holds only `chain:event:pass` plus an optional `issuedAt` + wallet signature. It is
  never treated as proof of ownership (PRD §11).
- **Single use is on-chain.** Whoever presents first, a pass is admitted at most once:
  `checkIn` reverts with `PassNotValid(AlreadyCheckedIn)` afterwards.
  *Tests:* `CheckIn.t.sol::test_checkIn_secondAttemptRejected`, `Invariants.t.sol::invariant_noDuplicateCheckIns`.
- **Holder signature.** The pass page has the holder's wallet sign a free, short-lived entry
  message (event, pass, chain, contract, timestamp). The scanner checks that it recovers to the
  pass's *current on-chain owner* (EOA or ERC-1271 via `publicClient.verifyMessage`) and is under
  10 minutes old. Signatures by anyone else, stale screenshots, and the previous owner's signature
  after a transfer are all rejected and block admission.
  *Tests:* `web/src/lib/verify.test.ts` ("copied QR" cases).
- **Residual risk:** an *ID-only* QR (no signature) or manual pass-ID entry proves nothing
  about the presenter. The check-in screen flags it ("ownership by the presenter is not proven")
  and requires staff to tick an explicit confirmation before admitting. Organizers who want strict
  entry can tell staff never to tick it.

### 2. Replay
*A used pass is presented again, at the same or another entrance.*

- `checkedInAt != 0` makes `verifyPass` return `AlreadyCheckedIn` and `checkIn` revert.
- A used pass cannot be transferred (`_update` reverts `PassAlreadyUsed`), so it can't be
  laundered to a fresh wallet. *Tests:* `Transfer.t.sol`.
- Entry signatures bind chain id and contract address, so they can't be replayed against another
  deployment or network.

### 3. Fake pass
*A forged QR, a token that doesn't exist, or a pass from a look-alike contract.*

- The scanner calls `verifyPass(selectedEventId, tokenId)` on the configured contract for every
  scan; nonexistent and burned tokens return `PassNotFound`. QR content from another network is
  rejected before any call. *Tests:* `test_checkIn_nonexistentPassRejected`, `verify.test.ts`.

### 4. Wrong event
*A genuine pass for event B is presented at event A.*

- Staff choose the event they are admitting to; that id, never the id written in the QR, is
  what goes to `verifyPass`/`checkIn`. Mismatch → `WrongEvent`. A QR that *claims* another event
  is rejected even if its token happens to belong here.
  *Tests:* `test_checkIn_wrongEventRejected`, `verify.test.ts` (two wrong-event cases).

### 5. Unauthorized staff
- `checkIn` requires `msg.sender` to be the event's organizer or in that event's staff set.
  Holders, other organizers and revoked staff are rejected (`NotCheckInOperator`).
  *Tests:* `test_checkIn_unauthorizedRejected`, `test_checkIn_revokedStaffRejected`,
  `test_checkIn_organizerOfOtherEventRejected`, and the browser test for a stranger wallet.
- Only the organizer can change staff (`NotOrganizer`). Staff can't escalate.

### 6. Supply abuse
- `minted < maxSupply` checked before every mint; `maxSupply ≤ 100,000`; optional
  one-pass-per-wallet tracked by *claimer*, so transferring a pass away doesn't let a wallet
  claim again. *Tests:* `test_claim_enforcesMaxSupply`, `testFuzz_claim_neverExceedsSupply`,
  `test_claim_onePerWallet_survivesTransfer`, `invariant_supplyAndCheckInBounds`.
- **Residual risk:** one-per-wallet does not stop one person using many wallets (Sybil). For a
  free event, organizers who need tighter control should keep supply realistic or use a paid
  price. Identity checks are a PRD non-goal.

### 7. Payment abuse
- `msg.value` must equal the configured price exactly (over- and under-payment revert);
  free events reject any value. Native BOT is the only asset (`paymentAsset = address(0)`).
- Funds are escrowed per event and can only leave via the organizer's `withdrawProceeds`
  (after the event ends, never if cancelled) or a holder's `refund` (only if cancelled).
  Cancellation is only possible before the end and before any check-in, so cancel and
  withdraw are mutually exclusive and every cancelled pass is fully refundable.
- Checks-effects-interactions plus `nonReentrant` on `claim`, `refund`, `withdrawProceeds`;
  ETH is only ever sent to `msg.sender`; failed sends revert the whole call.
  *Tests:* `Payments.t.sol` (reentrancy, isolation per event, failed payment),
  `invariant_solvency` (contract balance always equals the sum of per-event proceeds).

### 8. Admin compromise
- There is no admin key to compromise. The blast radius of a compromised **organizer key** is
  that organizer's events: it can pause sales, add rogue staff (who could check in passes for
  people not present), cancel before check-in starts (holders are refunded), or withdraw
  proceeds after the event ends — the same powers the organizer legitimately has.
- A compromised **staff key** can only mark passes of that one event as used.
- Recommendations for organizers: use a hardware wallet for the organizer address; give door
  staff separate low-value hot wallets and revoke them after the event.
- **Deployer key:** has no on-chain power after deployment. It is only needed to deploy and
  verify; see `docs/DEPLOYMENT.md`.

## Other considerations

| Topic | Handling |
|---|---|
| Unbounded loops | none in state-changing paths; every view loop is bounded by `MAX_PAGE_SIZE` (100) or `MAX_STAFF_PER_EVENT` (50) |
| `block.timestamp` | used for windows measured in minutes/hours; validator drift of seconds is irrelevant |
| Integer casts | `uint64(block.timestamp)` is safe for billions of years; `uint128(msg.value)` only after `msg.value == price` where `price` is `uint128` |
| Metadata injection | event strings are JSON-escaped and XML-escaped before going into `tokenURI` (`Metadata.t.sol::test_tokenURI_escapesHostileStrings`) |
| Frontend XSS | React escapes all on-chain strings; no `dangerouslySetInnerHTML` |
| Personal data | none on-chain or in QR codes; the app has no backend and stores nothing |
| Race at the door | if a holder transfers a pass between scan and check-in tx, the check-in still lands on that pass (now held by the recipient). Only a holder acting against their own pass can cause this |
| Description/venue edits | organizers can edit these after sales; times, supply and price are immutable. Attendees trust the organizer to run the event, as with any ticket |
| RPC trust | the app reads through the configured RPC. A malicious RPC could lie to the UI, but cannot forge a `checkIn` — that is a signed transaction validated by the chain |

## Static analysis notes (forge lint)

| Lint | Assessment |
|---|---|
| `arbitrary-send-eth` | sends go only to `msg.sender` after authorization checks |
| `reentrancy-eth` | `refund` burns and zeroes before sending, under `nonReentrant` |
| `block-timestamp` | intended, see above |
| `unsafe-typecast` | bounded, see above |
| `missing-events-access-control` | false positive: `updateEventDetails` emits `EventDetailsUpdated` |
