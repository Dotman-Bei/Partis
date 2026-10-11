# Build log

A public record of how Partis was built, the decisions made along the way, and what's next.
Newest entries first.

## 2026-10-11 — Mainnet smoke test (team-operated)

**Disclosure: this is team verification of the deployment, not user activity.** Five wallets
created and funded by the team ran the full flow on mainnet event **#1, "Partis mainnet smoke
test"** (its on-chain description also says "Not user activity"). These wallets, event #1 and
passes #1–#4 must be excluded from any usage metrics or milestone reporting.

| Wallet | Role | Address |
|---|---|---|
| W1 | organizer | `0xFA2077bAb4835fFfC0dA0175c476d4059B767E3c` |
| W2 | staff + attendee | `0xF192ef80747a08Ac865FDd574E1811d1acd12d31` |
| W3 | attendee | `0x1E6cD1338155d1ab75b047d051a6FbA3405F1d87` |
| W4 | attendee | `0x378a074fb23712F31d457e94f1Aa584cf1977dE9` |
| W5 | attendee | `0xF76682Cd505DB117c4A04E59B94464f7A0D52FB0` |

| # | Action | Gas | |
|---|---|---|---|
| 1 | W1 creates free event | 390,222 | [tx](https://scan.botchain.ai/tx/0xccae9c8621c69965bbf04e9a0c53601ecee5afcdc4205e433bf9475a5ee67ef2) |
| 2 | W1 adds W2 as staff (event #1) | 94,098 | [tx](https://scan.botchain.ai/tx/0x20a7fcf415016239f5006627b66cbd93c4e375cde0b5a6fdb7af0d7220567495) |
| 3 | W2 claims a pass | 366,798 | [tx](https://scan.botchain.ai/tx/0x84cd6446ef70d89f869b6c3e2ea0ed98cfa3e52a8d755d3b55a6a14cf732eec8) |
| 4 | W3 claims a pass | 301,198 | [tx](https://scan.botchain.ai/tx/0x4750e4ee943305347790beef589f93f50a23cf70999d88a002083e15510ac242) |
| 5 | W4 claims a pass | 301,198 | [tx](https://scan.botchain.ai/tx/0x179fec0e74aef9c21b2a3e106a38049011a11815317e1bb5cf3da49d586323f3) |
| 6 | W5 claims a pass | 301,198 | [tx](https://scan.botchain.ai/tx/0x6b9faa62090a3e2cdaf5c6a586779cedda3616790dcb79e11fb5c79e1358502b) |
| 7 | W2 (staff) checks in W3 (pass #2) | 93,346 | [tx](https://scan.botchain.ai/tx/0x2209d538b932df875d3ccf8c5a1d8ac1d047962c715aa1ee2e313f689b9d5ea6) |
| 8 | W2 (staff) checks in W4 (pass #3) | 76,246 | [tx](https://scan.botchain.ai/tx/0xddeea6a15373f20615408993d8a2d3c734855d16a59a9f532ef415a87dc4f358) |
| 9 | W1 (organizer) checks in W5 (pass #4) | 73,975 | [tx](https://scan.botchain.ai/tx/0x3bc18ba0c3177cb0b53d4b2e895c015a842d722c4e28976149e313ba3adbfea5) |
| 10 | W1 (organizer) checks in W2 (pass #1) | 73,975 | [tx](https://scan.botchain.ai/tx/0xb150ad10566fa9683bef80ec8bc4f863d591ac6f0c8a6ec7fd2e9db1b3fd1163) |

- All 10 succeeded at 20 gwei (legacy, no tip): ~2.07M gas ≈ 0.0415 BOT.
- Free simulations (no transactions): a replayed check-in and a second claim from the same
  wallet were both rejected. `verifyPass` reports all four passes as AlreadyCheckedIn.
- Afterwards the remaining 0.010455 BOT was returned to the funding address in 5 plain
  transfers; all five wallets are empty.
- Reproducible with `CONFIRM_MAINNET=yes ./scripts/mainnet-smoke-test.sh`.

## 2026-10-11 — Deployed to BOT Chain Mainnet

- Re-verified on deployment day from dev-docs.botchain.ai and the live RPC: chain id 677,
  `https://rpc.botchain.ai`, explorer `https://scan.botchain.ai`.
- Gas: mainnet has no base fee and the tx pool rejects anything under **20 gwei** ("gasPrice too
  low" at 19 gwei, probed with an empty wallet). Deployed at exactly 20 gwei, legacy, no tip, with
  a 10% gas-estimate margin.
- `PartisEventPass` → [`0x27e12C1059F21169Bc6652E624D57A5C9ff77302`](https://scan.botchain.ai/address/0x27e12C1059F21169Bc6652E624D57A5C9ff77302)
- `PartisPassRenderer` → [`0x14D79d1e58305fB1c7D510AD45939ea21b61BaCe`](https://scan.botchain.ai/address/0x14D79d1e58305fB1c7D510AD45939ea21b61BaCe)
- Block 26325389; both verified on BOTScan. Cost **0.1216 BOT** (6.08M gas) from a dedicated
  deployer wallet funded with 0.14 BOT.
- Same source as the tested testnet deployment, including the new pass art.
- Deployed before a real event with real attendees had been run on testnet (the gate in
  `DEPLOYMENT.md` asked for one). The automated testnet run passed every check; the first real
  events on mainnet should be watched closely.
- A bug in the new mainnet script's balance guard (64-bit overflow let it proceed with an empty
  wallet) was caught in a dry run with 0 BOT and fixed before funding; nothing was spent.

## 2026-10-10 — Automated testnet test run (pre-mainnet gate)

Ran every step of `docs/TESTNET_TEST_PLAN.md` against the live testnet contract
`0x4caC8911DC322033861cda5Bc18d1496102b3ff9`, driving the real UI in a browser with three
dedicated test wallets (organizer, attendee, staff). **All 9 groups / 22 checks passed:**

- organizer created a paid, a free and a to-be-cancelled event and authorized a staff wallet;
- attendee bought a paid pass, claimed a free one; a second purchase was not offered in the UI
  and reverted on-chain (`AlreadyClaimed`);
- attendee signed an entry QR (decoded from the rendered image); staff saw "Valid pass" with the
  holder signature verified and checked the pass in on-chain;
- rejected as expected: replayed QR (Already checked in), pass from another event, nonexistent
  pass, an 11-minute-old QR, a non-staff wallet (UI + `NotCheckInOperator`), and transferring the
  used pass (`PassAlreadyUsed`);
- My Passes showed CHECKED IN; cancelled event refunded 0.5 tBOT; organizer withdrew 0.5 tBOT
  after the paid event ended.

Notes:
- **This is test activity, not usage.** Every event is named "Partis test run"; the metrics below
  must not be reported as traction.
- Vercel's Security Checkpoint blocked the automated headless browser on
  partis-seven.vercel.app after repeated loads, so the run used a local production build of the
  same commit pointed at the same live contract. Normal visitors were unaffected.
- Two earlier attempts aborted before any passes were issued (one hung on a test-harness wait,
  one hit the Vercel checkpoint), leaving test events #1–#4 with no passes.
- Not covered by automation: scanning with a physical phone camera.

```
Events created 7 · Organizers 1 · Unique attendees 1 · Passes issued 3 · Check-ins 1 ·
Paid pass volume 1 tBOT   (all test activity)
```

## 2026-10-10 — Testnet redeploy with the new pass art

- `PartisPassRenderer` now draws the new Partis mark and outlined wordmark in every pass image
  (checked by minting locally and rendering the on-chain SVG). Renderer bytecode 6.6KB → 9.5KB.
- Because `PartisEventPass` references its renderer immutably, both contracts were redeployed:
  - `PartisEventPass` → [`0x4caC8911DC322033861cda5Bc18d1496102b3ff9`](https://scan.bohr.life/address/0x4caC8911DC322033861cda5Bc18d1496102b3ff9)
  - `PartisPassRenderer` → [`0x17411D09105d3276B75a5423ecE3494814050f87`](https://scan.bohr.life/address/0x17411D09105d3276B75a5423ecE3494814050f87)
  - block 26403956, both verified on BOTScan.
- The first testnet deployment (`0x07aF133344a4da79872117e612febCf4851798F5`) had no events or passes, so nothing was migrated; it is
  retired.
- Mainnet will deploy this same source, so its pass art is correct from day one.

## 2026-10-08 — Responsive and performance pass

- New Playwright check runs every route at 320, 375, 430, 768, 1024, 1366 and 1920px with real
  on-chain data: no horizontal overflow anywhere; on touch screens every button is ≥40px tall and
  form text is 16px (stops iOS zooming into fields).
- Fixed what it found: the staff dialog overflowed small phones by 162px (full wallet addresses),
  the create-event dialog by 7px; small buttons were 33px tall on touch screens.
- Performance: the QR encoder and camera decoder now load only when used (check-in page JS
  343 → 298KB gzipped); the shipped contract ABI is trimmed to what the app calls (99 → 58
  entries); countdowns tick in place instead of re-rendering whole pages every second.
- Lighthouse accessibility is 100 on every page (fixed landing heading order). Profiling showed
  the remaining load cost is the one-time React/Next and wallet-library startup; pages are idle
  once loaded.

## 2026-10-08 — Deployed to BOT Chain Testnet

- Re-verified chain id 968 at `https://rpc.bohr.life` immediately before deploying.
- `PartisEventPass` → [`0x07aF133344a4da79872117e612febCf4851798F5`](https://scan.bohr.life/address/0x07aF133344a4da79872117e612febCf4851798F5)
- `PartisPassRenderer` → [`0x0405b784346330f690c85A559ba4C2B05e610650`](https://scan.bohr.life/address/0x0405b784346330f690c85A559ba4C2B05e610650)
- Deployed at block 26131805; both contracts verified on BOTScan (Blockscout) via
  `forge --verifier blockscout`. Verification took ~20s in the explorer's queue.
- Confirmed on-chain: `renderer()` points at the renderer, `eventCount()` is 0, and the web app
  reads live testnet state.
- Deployment record: `contracts/deployments/968.json` and `contracts/broadcast/Deploy.s.sol/968/`.
- Frontend live at https://partis-seven.vercel.app (Vercel, root `web`, testnet config);
  checked in a browser: all routes load, live testnet reads, no console errors.
- Next: run a real testnet event, record the demo.

## 2026-10-07 — MVP code complete (M1–M4)

**Shipped**

- `PartisEventPass` (ERC-721): event creation, free and fixed-price issuance, per-event staff,
  `verifyPass` + single-use `checkIn`, transfer lock after check-in, escrowed proceeds,
  cancellation with full refunds, paginated batch views, on-chain stats.
- `PartisPassRenderer`: fully on-chain JSON + SVG metadata that reflects live pass status.
- Next.js app with the six PRD routes, styled to `docs/frontend.md`.
- 59 contract tests (including 4 stateful invariants), 21 web logic tests, an on-chain
  end-to-end script, and a Playwright suite that drives the whole flow through the UI.

**Decisions**

- *Verified network values instead of remembered ones.* Chain ids, RPCs, explorer and faucet
  came from dev-docs.botchain.ai and were confirmed with live `eth_chainId` calls
  (`docs/BOT_CHAIN_CONFIG.md`).
- *No `eth_getLogs`.* The official mainnet RPC disables it, so the app never relies on logs.
  The contract exposes bounded, paginated views (`getEvents`, `getPasses`, `getEventsByIds`, …).
- *No Multicall3 dependency.* It isn't deployed on testnet; batch views make it unnecessary.
- *No admin.* Every privilege is per-event. Nothing to compromise globally, nothing to upgrade.
- *Escrow until event end.* Organizers withdraw after the event; cancellation (only before any
  check-in) makes every pass refundable. Cancel and withdraw can never both happen.
- *Signed entry QR.* The QR stays minimal, but the holder's wallet signs a 10-minute entry code
  that the scanner checks against the current on-chain owner. This addresses copied QRs without
  storing anything personal.
- *Renderer split.* Moving SVG rendering out keeps `PartisEventPass` well under the 24KB limit.
- *Design.* Followed `docs/frontend.md`: kept its black + signal-yellow system, sentence-builder
  creation and landing structure; applied its own recommended fixes (one colour temperature,
  tokenised control surfaces, Inter actually loaded, accessible dialogs and toasts).

**BOT Chain developer feedback**

- The JSON-RPC docs state clearly that `eth_getLogs` is disabled on the official mainnet
  endpoint. That's useful up front, but dapps that need logs then depend on third-party RPCs;
  a documented log-enabled endpoint (or WebSocket URL) would help.
- No WebSocket RPC is listed in the docs.
- Multicall3 exists on mainnet but not on testnet, so the two networks behave differently for
  common tooling (viem/wagmi batching).
- Blockscout verification works with Foundry's `--verifier blockscout`; documenting the
  `/api/` verifier URL in the dev docs would save people a search.

**Next (M5 / M6)**

- Fund a deployer, deploy and verify on testnet, publish addresses in the README.
- Deploy the frontend; run a real testnet event with real attendees.
- Record the 2–4 minute demo video.
- Collect feedback, fix issues, pass the validation gate in `DEPLOYMENT.md`, then mainnet.
- Publish metrics from `scripts/metrics.sh` with each milestone report.
