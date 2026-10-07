#!/usr/bin/env bash
# End-to-end check of the PRD §5 loop against a local anvil node, using real transactions.
# Usage: anvil &  then  ./scripts/e2e-local.sh
set -euo pipefail
export PATH="$PATH:$HOME/.foundry/bin"
cd "$(dirname "$0")/../contracts"

RPC=${RPC:-http://127.0.0.1:8545}
# Keys derived from anvil's default test mnemonic (never use outside a local node).
MNEMONIC="test test test test test test test test test test test junk"
key() { cast wallet private-key --mnemonic "$MNEMONIC" --mnemonic-index "$1"; }
ORG_KEY=$(key 0); STAFF_KEY=$(key 1); ALICE_KEY=$(key 2); BOB_KEY=$(key 3)
STAFF=$(cast wallet address $STAFF_KEY)
ALICE=$(cast wallet address $ALICE_KEY)

pass() { printf '  \033[32mPASS\033[0m %s\n' "$1"; }
fail() { printf '  \033[31mFAIL\033[0m %s\n' "$1"; exit 1; }
ERRORS=$(forge inspect PartisEventPass errors --json 2>/dev/null)
reason() { # map the revert selector in cast's output to the contract's error name
  local sel; sel=$(grep -oE '(custom error 0x|data: "0x)[0-9a-f]{8}' <<<"$1" | head -1 | grep -oE '[0-9a-f]{8}$' || true)
  [[ -n $sel ]] && jq -r --arg s "$sel" 'to_entries[] | select(.value==$s) | .key | sub("\\(.*";"")' <<<"$ERRORS" || echo "reverted"
}
expect_revert() { # desc, cmd...
  local desc=$1 out; shift
  if out=$("$@" 2>&1); then fail "$desc (expected revert)"; else pass "$desc → $(reason "$out")"; fi
}

echo "▸ Deploying"
forge script script/Deploy.s.sol --rpc-url "$RPC" --broadcast --private-key $ORG_KEY >/dev/null
P=$(jq -r .partis deployments/31337.json)
echo "  PartisEventPass at $P"

NOW=$(cast block latest --rpc-url "$RPC" -f timestamp)
START=$((NOW + 7200)); END=$((START + 14400)); CI_START=$((START - 3600))
CFG="(\"BOT Builders Meetup\",\"Demos and talks\",\"Yaba, Lagos\",\"General Admission\",$START,$END,$CI_START,$END,2,1000000000000000000,true)"
SIG='createEvent((string,string,string,string,uint64,uint64,uint64,uint64,uint32,uint128,bool))'

echo "▸ 1–3  Organizer creates a paid event"
cast send $P "$SIG" "$CFG" --private-key $ORG_KEY --rpc-url "$RPC" >/dev/null
cast send $P "$SIG" "${CFG/BOT Builders Meetup/Other Event}" --private-key $ORG_KEY --rpc-url "$RPC" >/dev/null
[[ $(cast call $P 'eventCount()(uint256)' --rpc-url "$RPC") == 2 ]] && pass "events 1 and 2 exist on-chain"
cast send $P 'setStaff(uint256,address,bool)' 1 $STAFF true --private-key $ORG_KEY --rpc-url "$RPC" >/dev/null && pass "staff authorized for event 1"

echo "▸ 4–7  Attendee buys a pass"
expect_revert "underpayment rejected" cast send $P 'claim(uint256)' 1 --value 0.5ether --private-key $ALICE_KEY --rpc-url "$RPC"
cast send $P 'claim(uint256)' 1 --value 1ether --private-key $ALICE_KEY --rpc-url "$RPC" >/dev/null
[[ $(cast call $P 'ownerOf(uint256)(address)' 1 --rpc-url "$RPC") == "$ALICE" ]] && pass "pass #1 owned by attendee"
expect_revert "second pass for same wallet rejected" cast send $P 'claim(uint256)' 1 --value 1ether --private-key $ALICE_KEY --rpc-url "$RPC"
cast send $P 'claim(uint256)' 2 --value 1ether --private-key $BOB_KEY --rpc-url "$RPC" >/dev/null && pass "bob holds pass #2 for event 2"

echo "▸ 9–13  Entrance verification and check-in"
expect_revert "check-in before window rejected" cast send $P 'checkIn(uint256,uint256)' 1 1 --private-key $STAFF_KEY --rpc-url "$RPC"
cast rpc evm_increaseTime 3700 --rpc-url "$RPC" >/dev/null && cast rpc evm_mine --rpc-url "$RPC" >/dev/null
[[ $(cast call $P 'verifyPass(uint256,uint256)(uint8,address)' 1 1 --rpc-url "$RPC" | head -1) == 0 ]] && pass "verifyPass(1,1) = Valid"
expect_revert "unauthorized wallet cannot check in" cast send $P 'checkIn(uint256,uint256)' 1 1 --private-key $BOB_KEY --rpc-url "$RPC"
expect_revert "wrong-event pass rejected" cast send $P 'checkIn(uint256,uint256)' 1 2 --private-key $STAFF_KEY --rpc-url "$RPC"
expect_revert "nonexistent pass rejected" cast send $P 'checkIn(uint256,uint256)' 1 999 --private-key $STAFF_KEY --rpc-url "$RPC"
cast send $P 'checkIn(uint256,uint256)' 1 1 --private-key $STAFF_KEY --rpc-url "$RPC" >/dev/null && pass "valid pass checked in on-chain"
expect_revert "second check-in rejected (replay)" cast send $P 'checkIn(uint256,uint256)' 1 1 --private-key $ORG_KEY --rpc-url "$RPC"
expect_revert "used pass cannot be transferred" cast send $P 'transferFrom(address,address,uint256)' $ALICE $STAFF 1 --private-key $ALICE_KEY --rpc-url "$RPC"

echo "▸ Proceeds"
expect_revert "withdraw locked before event end" cast send $P 'withdrawProceeds(uint256)' 1 --private-key $ORG_KEY --rpc-url "$RPC"
cast rpc evm_increaseTime 20000 --rpc-url "$RPC" >/dev/null && cast rpc evm_mine --rpc-url "$RPC" >/dev/null
cast send $P 'withdrawProceeds(uint256)' 1 --private-key $ORG_KEY --rpc-url "$RPC" >/dev/null && pass "organizer withdrew proceeds after event end"

echo "▸ Stats: $(cast call $P 'stats()((uint256,uint256,uint256,uint256,uint256,uint256))' --rpc-url "$RPC")"
echo "All end-to-end checks passed."
