# Deploying Partis

Partis is two contracts (`PartisPassRenderer`, then `PartisEventPass`) and a static-friendly
Next.js app. There is no backend, database or indexer to deploy.

> **Before every deployment, re-verify network values** from the official docs
> (https://dev-docs.botchain.ai/docs/Developers/quick-guide/) and update
> `docs/BOT_CHAIN_CONFIG.md`, `contracts/foundry.toml` and `web/src/lib/chains.ts` if anything
> changed. Never deploy against remembered values (PRD §24).

## 0. Prerequisites

- Foundry (`forge`, `cast`), Node 22+, `jq`
- A deployer wallet stored as an encrypted Foundry keystore. The deployer has **no on-chain
  privileges** after deployment; it only pays gas.

```bash
cast wallet import partis-deployer --interactive   # paste the private key once; it is encrypted at rest
cast wallet address --account partis-deployer
```

## 1. Testnet (BOT Chain Testnet, chain 968)

1. Fund the deployer with tBOT: https://faucet.botchain.ai/basic (10 tBOT / 24h).
2. Run the full test suite:
   ```bash
   cd contracts && forge test && cd ../web && npm test
   ```
3. Deploy and verify on Blockscout in one step:
   ```bash
   cd contracts
   forge script script/Deploy.s.sol --rpc-url bot_testnet --broadcast \
     --account partis-deployer \
     --verify --verifier blockscout --verifier-url https://scan.bohr.life/api/
   cat deployments/968.json
   ```
   If verification times out, re-run it separately:
   ```bash
   forge verify-contract <renderer> src/PartisPassRenderer.sol:PartisPassRenderer \
     --chain 968 --verifier blockscout --verifier-url https://scan.bohr.life/api/
   forge verify-contract <partis> src/PartisEventPass.sol:PartisEventPass \
     --constructor-args $(cast abi-encode "constructor(address)" <renderer>) \
     --chain 968 --verifier blockscout --verifier-url https://scan.bohr.life/api/
   ```
4. Commit `contracts/deployments/968.json` and `contracts/broadcast/Deploy.s.sol/968/` so the
   deployment is part of the public record.
5. Build and deploy the web app (any Next.js host, e.g. Vercel) with:
   ```
   NEXT_PUBLIC_CHAIN_ID=968
   NEXT_PUBLIC_PARTIS_ADDRESS=<partis from deployments/968.json>
   NEXT_PUBLIC_REPO_URL=<public repository URL>
   ```
6. Smoke-test on testnet with real wallets: create a free and a paid event, claim from a second
   wallet, add a third wallet as staff, check in from a phone, confirm a second scan is rejected,
   and confirm a wallet that isn't staff is refused.
7. Record usage with `scripts/metrics.sh https://rpc.bohr.life <partis>`.

## 2. Testnet validation gate (before mainnet)

Mainnet goes ahead only when all of these hold:

- [ ] All contract, unit and browser tests pass on the release commit.
- [ ] At least one real testnet event run with real attendees checked in at a door.
- [ ] No open issues on access control, payments or check-in state.
- [ ] Threat model (`docs/THREAT_MODEL.md`) re-read against the release; any contract change
      since the last review gets a fresh review.
- [ ] Network values re-verified from official docs on the day of deployment.

## 3. Mainnet (BOT Chain Mainnet, chain 677)

The contract and app are identical; only configuration changes.

1. Re-verify chain id `677`, RPC `https://rpc.botchain.ai` and explorer
   `https://scan.botchain.ai` from the official docs.
2. Fund the deployer with a small amount of BOT (via the official B DEX). Deployment of both
   contracts costs a few million gas.
3. Deploy and verify:
   ```bash
   cd contracts
   forge script script/Deploy.s.sol --rpc-url bot_mainnet --broadcast \
     --account partis-deployer \
     --verify --verifier blockscout --verifier-url https://scan.botchain.ai/api/
   ```
4. Commit `deployments/677.json` and the broadcast record.
5. Deploy a production web build with `NEXT_PUBLIC_CHAIN_ID=677` and the mainnet address.
6. The mainnet RPC disables `eth_getLogs`. Partis does not use logs for reads, so no change is
   needed; an indexer for logs would need a third-party endpoint.

## 4. Local development

```bash
anvil                                   # terminal 1
./scripts/e2e-local.sh                  # deploys + exercises the full loop with cast
cd web && cp .env.example .env.local    # set NEXT_PUBLIC_CHAIN_ID=31337 and the address from
npm run dev                             # contracts/deployments/31337.json
```

Browser end-to-end tests (fresh chain, deploy, production build, Playwright):

```bash
./scripts/e2e-browser.sh
```

## 5. Rollback and incidents

Contracts are immutable and un-pausable by design (no admin). If a critical bug were found:

1. Publish a notice; organizers can pause sales on their own events (`setSalesPaused`) and
   cancel events that haven't started check-in, which makes every paid pass refundable.
2. Deploy a fixed version as a new contract and point the app at it. Existing passes remain
   valid and verifiable on the old contract; the app can be built against either.
