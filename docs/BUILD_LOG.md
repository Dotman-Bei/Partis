# Build log

A public record of how Partis was built, the decisions made along the way, and what's next.
Newest entries first.

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
