#!/usr/bin/env bash
# Team-operated end-to-end smoke test of the MAINNET deployment: 5 disclosed team wallets,
# 10 transactions at the network's minimum gas price (20 gwei, legacy, no tip).
# This verifies the deployment works; it is NOT user activity and must not be reported as such.
#
# Usage: CONFIRM_MAINNET=yes ./scripts/mainnet-smoke-test.sh   (keys: .mainnet-smoke-wallets.env)
set -euo pipefail
export PATH="$PATH:$HOME/.foundry/bin"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
RPC=https://rpc.botchain.ai
EXPLORER=https://scan.botchain.ai
P=$(jq -r .partis "$ROOT/contracts/deployments/677.json")
GAS_PRICE=20000000000

[[ "${CONFIRM_MAINNET:-}" == "yes" ]] || { echo "Refusing to send mainnet transactions without CONFIRM_MAINNET=yes." >&2; exit 1; }
[[ $(cast chain-id --rpc-url "$RPC") == 677 ]] || { echo "RPC is not BOT Chain Mainnet (677)." >&2; exit 1; }
set -a; source "$ROOT/.mainnet-smoke-wallets.env"; set +a

N=0
send() { # label, key, sig, args...
  local label=$1 key=$2; shift 2
  local out hash status gas
  out=$(cast send "$P" "$@" --private-key "$key" --rpc-url "$RPC" --legacy --gas-price "$GAS_PRICE" --json)
  hash=$(jq -r .transactionHash <<<"$out"); status=$(jq -r .status <<<"$out"); gas=$(printf '%d' "$(jq -r .gasUsed <<<"$out")")
  [[ "$status" == "0x1" ]] || { echo "  ✗ $label reverted: $EXPLORER/tx/$hash" >&2; exit 1; }
  N=$((N + 1))
  printf '  %2d. %-38s gas %7d  %s/tx/%s\n' "$N" "$label" "$gas" "$EXPLORER" "$hash"
}

NOW=$(cast block latest -f timestamp --rpc-url "$RPC")
START=$((NOW + 600)); END=$((START + 7200)); CHECKIN_FROM=$((NOW - 60))
NAME="Partis mainnet smoke test"
DESC="Team-operated end-to-end verification of the mainnet deployment. Not user activity."
SIG='createEvent((string,string,string,string,uint64,uint64,uint64,uint64,uint32,uint128,bool))'

echo "▸ Mainnet smoke test on $P"
send "W1 creates free event" "$W1_KEY" "$SIG" \
  "(\"$NAME\",\"$DESC\",\"Online (team smoke test)\",\"Smoke test pass\",$START,$END,$CHECKIN_FROM,$END,10,0,true)"
EVENT=$(cast call "$P" 'eventCount()(uint256)' --rpc-url "$RPC")
send "W1 adds W2 as staff (event #$EVENT)" "$W1_KEY" 'setStaff(uint256,address,bool)' "$EVENT" "$W2_ADDRESS" true

declare -A PASS
for w in 2 3 4 5; do
  key=W${w}_KEY; addr=W${w}_ADDRESS
  send "W$w claims a pass" "${!key}" 'claim(uint256)' "$EVENT"
  PASS[$w]=$(cast call "$P" 'getOwnerTokenIds(address,uint256,uint256)(uint256[])' "${!addr}" 0 1 --rpc-url "$RPC" | tr -d '[]')
done

send "W2 (staff) checks in W3 (pass #${PASS[3]})" "$W2_KEY" 'checkIn(uint256,uint256)' "$EVENT" "${PASS[3]}"
send "W2 (staff) checks in W4 (pass #${PASS[4]})" "$W2_KEY" 'checkIn(uint256,uint256)' "$EVENT" "${PASS[4]}"
send "W1 (organizer) checks in W5 (pass #${PASS[5]})" "$W1_KEY" 'checkIn(uint256,uint256)' "$EVENT" "${PASS[5]}"
send "W1 (organizer) checks in W2 (pass #${PASS[2]})" "$W1_KEY" 'checkIn(uint256,uint256)' "$EVENT" "${PASS[2]}"

echo "▸ Negative checks (free simulations, no transactions)"
if cast call "$P" 'checkIn(uint256,uint256)' "$EVENT" "${PASS[3]}" --from "$W2_ADDRESS" --rpc-url "$RPC" >/dev/null 2>&1; then
  echo "  ✗ replay check-in was NOT rejected" >&2; exit 1; fi
echo "  ✓ replay check-in of pass #${PASS[3]} rejected (already used)"
if cast call "$P" 'claim(uint256)' "$EVENT" --from "$W3_ADDRESS" --rpc-url "$RPC" >/dev/null 2>&1; then
  echo "  ✗ second claim was NOT rejected" >&2; exit 1; fi
echo "  ✓ second claim by W3 rejected (one per wallet)"

echo "▸ On-chain state"
echo "  stats(): $(cast call "$P" 'stats()((uint256,uint256,uint256,uint256,uint256,uint256))' --rpc-url "$RPC")"
for w in 2 3 4 5; do
  echo "  pass #${PASS[$w]} → verifyPass: $(cast call "$P" 'verifyPass(uint256,uint256)(uint8,address)' "$EVENT" "${PASS[$w]}" --rpc-url "$RPC" | tr '\n' ' ')(4 = AlreadyCheckedIn)"
done
echo "✓ $N transactions, all succeeded"
