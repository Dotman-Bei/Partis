#!/usr/bin/env bash
# Deploys Partis to BOT Chain MAINNET (chain 677) at the network's minimum gas price and
# verifies the contracts on BOTScan. Reads the deployer key from contracts/.env.mainnet.
#
# Usage: CONFIRM_MAINNET=yes ./scripts/deploy-mainnet.sh
#
# Cost (measured from the identical testnet deployment): ~6.08M gas ≈ 0.122 BOT at 20 gwei.
# The wallet must hold the gas *limit* up front (~0.134 BOT with a 10% estimate margin);
# whatever isn't used stays in the deployer wallet.
set -euo pipefail
export PATH="$PATH:$HOME/.foundry/bin"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="$ROOT/contracts/.env.mainnet"
EXPECTED_CHAIN_ID=677
EXPLORER=https://scan.botchain.ai
# Lowest price the mainnet tx pool accepts (probed 2026-10-11: 19 gwei → "gasPrice too low").
GAS_PRICE_WEI=20000000000
GAS_MARGIN=110  # forge gas-estimate multiplier (%), down from the default 130
# Computed with bc: the product exceeds bash's 64-bit integers.
MIN_BALANCE_WEI=$(echo "6100000 * $GAS_PRICE_WEI * $GAS_MARGIN / 100" | bc)

[[ "${CONFIRM_MAINNET:-}" == "yes" ]] || { echo "Refusing to deploy to MAINNET without CONFIRM_MAINNET=yes." >&2; exit 1; }
[[ -f "$ENV_FILE" ]] || { echo "Missing contracts/.env.mainnet." >&2; exit 1; }
set -a; source "$ENV_FILE"; set +a

RPC=${BOT_MAINNET_RPC:-https://rpc.botchain.ai}
PRIVATE_KEY=$(tr -d '[:space:]"'"'" <<<"${PRIVATE_KEY:-}")
[[ "$PRIVATE_KEY" =~ ^(0x)?[0-9a-fA-F]{64}$ ]] || { echo "Invalid PRIVATE_KEY in contracts/.env.mainnet." >&2; exit 1; }
[[ "$PRIVATE_KEY" == 0x* ]] || PRIVATE_KEY="0x$PRIVATE_KEY"

echo "▸ Checking network (PRD §24: never trust remembered values)"
CHAIN_ID=$(cast chain-id --rpc-url "$RPC")
[[ "$CHAIN_ID" == "$EXPECTED_CHAIN_ID" ]] || {
  echo "RPC $RPC reports chain $CHAIN_ID, expected $EXPECTED_CHAIN_ID. Re-verify docs/BOT_CHAIN_CONFIG.md." >&2; exit 1; }
echo "  $RPC → chain $CHAIN_ID ✓"

DEPLOYER=$(cast wallet address --private-key "$PRIVATE_KEY")
BALANCE=$(cast balance "$DEPLOYER" --rpc-url "$RPC")
echo "▸ Deployer $DEPLOYER — balance $(cast from-wei "$BALANCE") BOT (need ≥ $(cast from-wei "$MIN_BALANCE_WEI"))"
if [[ $(echo "$BALANCE < $MIN_BALANCE_WEI" | bc) == 1 ]]; then
  echo "Not enough BOT to cover the gas limit at 20 gwei. Top up and retry." >&2; exit 1
fi

echo "▸ Running contract tests"
(cd "$ROOT/contracts" && forge test >/dev/null) && echo "  all tests pass ✓"

echo "▸ Deploying at $(cast from-wei "$GAS_PRICE_WEI" gwei) gwei (legacy, no tip) and verifying on BOTScan"
cd "$ROOT/contracts"
# Deploy.s.sol writes the record during forge's simulation too, so clear any stale one first;
# the record is only trusted below once code is confirmed at the address.
rm -f "$ROOT/contracts/deployments/$EXPECTED_CHAIN_ID.json"
forge script script/Deploy.s.sol --rpc-url "$RPC" --broadcast --private-key "$PRIVATE_KEY" \
  --legacy --with-gas-price "$GAS_PRICE_WEI" --gas-estimate-multiplier "$GAS_MARGIN" \
  --slow \
  --verify --verifier blockscout --verifier-url "$EXPLORER/api/" \
  || echo "  (If only verification failed, see docs/DEPLOYMENT.md §1.3 to re-run it with --chain 677.)"

DEPLOYMENT="$ROOT/contracts/deployments/$EXPECTED_CHAIN_ID.json"
[[ -f "$DEPLOYMENT" ]] || { echo "Deployment record not written; deployment did not complete." >&2; exit 1; }
PARTIS=$(jq -r .partis "$DEPLOYMENT")
RENDERER=$(jq -r .renderer "$DEPLOYMENT")
[[ $(cast code "$PARTIS" --rpc-url "$RPC") != "0x" ]] || { echo "No code at $PARTIS." >&2; exit 1; }
LEFT=$(cast balance "$DEPLOYER" --rpc-url "$RPC")

cat <<OUT

✓ Partis is live on BOT Chain Mainnet
  PartisEventPass     $PARTIS   $EXPLORER/address/$PARTIS
  PartisPassRenderer  $RENDERER   $EXPLORER/address/$RENDERER
  Spent               $(cast from-wei "$(echo "$BALANCE - $LEFT" | bc)") BOT   (left in deployer: $(cast from-wei "$LEFT") BOT)
  Record              contracts/deployments/$EXPECTED_CHAIN_ID.json

Vercel (mainnet): NEXT_PUBLIC_CHAIN_ID=677  NEXT_PUBLIC_PARTIS_ADDRESS=$PARTIS
OUT
