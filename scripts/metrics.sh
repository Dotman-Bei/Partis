#!/usr/bin/env bash
# Prints Partis usage metrics straight from the PartisEventPass contract (PRD §3.5, §29).
# Nothing here is estimated: every number is read from chain state.
# Usage: scripts/metrics.sh <rpc-url> <partis-address>
#   e.g. scripts/metrics.sh https://rpc.bohr.life 0x...
set -euo pipefail
export PATH="$PATH:$HOME/.foundry/bin"
RPC=${1:?rpc url}; P=${2:?PartisEventPass address}

read -r EVENTS ORGS ATTENDEES PASSES CHECKINS VOLUME < <(
  cast call "$P" 'stats()((uint256,uint256,uint256,uint256,uint256,uint256))' --rpc-url "$RPC" \
    | tr -d '()' | sed 's/\[[^]]*\]//g' | tr ',' ' '
)

# Repeat organizers: organizers with more than one event (organizer is the 2nd field of EventData).
repeat_orgs=0
declare -A per_org=()
for ((id = 1; id <= EVENTS; id++)); do
  # Raw ABI return: word 0 = offset to the struct, word 1 = id, word 2 = organizer.
  raw=$(cast call "$P" 'getEvent(uint256)' "$id" --rpc-url "$RPC")
  org=${raw:2+64*2+24:40}
  per_org[$org]=$(( ${per_org[$org]:-0} + 1 ))
done
for n in "${per_org[@]}"; do (( n > 1 )) && repeat_orgs=$((repeat_orgs + 1)); done

avg="0"
(( EVENTS > 0 )) && avg=$(awk -v p="$PASSES" -v e="$EVENTS" 'BEGIN { printf "%.1f", p / e }')
rate="n/a"
(( PASSES > 0 )) && rate=$(awk -v c="$CHECKINS" -v p="$PASSES" 'BEGIN { printf "%.1f%%", 100 * c / p }')

cat <<OUT
Partis metrics  ($(date -u +%Y-%m-%dT%H:%MZ), chain $(cast chain-id --rpc-url "$RPC"), contract $P)
  Events created ............ $EVENTS
  Organizers ................ $ORGS   (repeat organizers: $repeat_orgs)
  Unique attendees .......... $ATTENDEES
  Passes issued ............. $PASSES   (avg per event: $avg)
  Check-ins ................. $CHECKINS   (check-in rate: $rate)
  Paid pass volume .......... $(cast from-wei "$VOLUME") BOT
OUT
