#!/usr/bin/env bash
# Deploys Partis to BOT Chain Testnet (chain 968) and verifies the contracts on BOTScan.
# Reads the deployer key from contracts/.env (see contracts/.env.example).
# Usage: ./scripts/deploy-testnet.sh
set -euo pipefail
export PATH="$PATH:$HOME/.foundry/bin"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="$ROOT/contracts/.env"
EXPECTED_CHAIN_ID=968
EXPLORER=https://scan.bohr.life

[[ -f "$ENV_FILE" ]] || { echo "Missing contracts/.env — copy contracts/.env.example and fill it in." >&2; exit 1; }
set -a; source "$ENV_FILE"; set +a

RPC=${BOT_TESTNET_RPC:-https://rpc.bohr.life}
[[ "${PRIVATE_KEY:-}" =~ ^0x[0-9a-fA-F]{64}$ ]] || {
  echo "PRIVATE_KEY in contracts/.env must be a 0x-prefixed 64-hex-character key." >&2; exit 1; }

echo "▸ Checking network (PRD §24: never trust remembered values)"
CHAIN_ID=$(cast chain-id --rpc-url "$RPC")
[[ "$CHAIN_ID" == "$EXPECTED_CHAIN_ID" ]] || {
  echo "RPC $RPC reports chain $CHAIN_ID, expected $EXPECTED_CHAIN_ID. Re-verify docs/BOT_CHAIN_CONFIG.md." >&2; exit 1; }
echo "  $RPC → chain $CHAIN_ID ✓"

DEPLOYER=$(cast wallet address --private-key "$PRIVATE_KEY")
BALANCE=$(cast balance "$DEPLOYER" --rpc-url "$RPC")
echo "▸ Deployer $DEPLOYER — balance $(cast from-wei "$BALANCE") tBOT"
[[ "$BALANCE" != "0" ]] || {
  echo "Deployer has no tBOT. Claim some at https://faucet.botchain.ai/basic and retry." >&2; exit 1; }

echo "▸ Running contract tests"
(cd "$ROOT/contracts" && forge test >/dev/null) && echo "  all tests pass ✓"

echo "▸ Deploying and verifying on BOTScan"
cd "$ROOT/contracts"
forge script script/Deploy.s.sol --rpc-url "$RPC" --broadcast --private-key "$PRIVATE_KEY" \
  --verify --verifier blockscout --verifier-url "$EXPLORER/api/" \
  || echo "  (If only verification failed, see docs/DEPLOYMENT.md §1.3 to re-run it.)"

DEPLOYMENT="$ROOT/contracts/deployments/$EXPECTED_CHAIN_ID.json"
[[ -f "$DEPLOYMENT" ]] || { echo "Deployment record not written; deployment did not complete." >&2; exit 1; }
PARTIS=$(jq -r .partis "$DEPLOYMENT")
RENDERER=$(jq -r .renderer "$DEPLOYMENT")
[[ $(cast code "$PARTIS" --rpc-url "$RPC") != "0x" ]] || { echo "No code at $PARTIS." >&2; exit 1; }

# Point the web app at testnet. Keep the previous (local) config alongside.
WEB_ENV="$ROOT/web/.env.local"
[[ -f "$WEB_ENV" ]] && cp "$WEB_ENV" "$WEB_ENV.bak"
printf 'NEXT_PUBLIC_CHAIN_ID=%s\nNEXT_PUBLIC_PARTIS_ADDRESS=%s\nNEXT_PUBLIC_REPO_URL=%s\n' \
  "$EXPECTED_CHAIN_ID" "$PARTIS" "${REPO_URL:-}" > "$WEB_ENV"

cat <<OUT

✓ Partis is live on BOT Chain Testnet
  PartisEventPass     $PARTIS   $EXPLORER/address/$PARTIS
  PartisPassRenderer  $RENDERER   $EXPLORER/address/$RENDERER
  Record              contracts/deployments/$EXPECTED_CHAIN_ID.json
  Web config          web/.env.local now targets testnet (previous config in .env.local.bak)

Next: restart the web app, and commit contracts/deployments/$EXPECTED_CHAIN_ID.json
plus contracts/broadcast/Deploy.s.sol/$EXPECTED_CHAIN_ID/ as the public deployment record.
OUT
