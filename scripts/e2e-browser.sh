#!/usr/bin/env bash
# Browser end-to-end test: fresh anvil chain → deploy → production build pointed at it →
# serve → Playwright drives the full PRD §5 flow through the UI. Cleans up after itself.
set -euo pipefail
export PATH="$PATH:$HOME/.foundry/bin"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PORT=${E2E_PORT:-3217}
RPC=http://127.0.0.1:8545

for p in 8545 "$PORT"; do
  if ss -ltn "sport = :$p" 2>/dev/null | grep -q LISTEN; then
    echo "Port $p is in use. Stop that process first (this test needs a fresh chain and server)." >&2
    exit 1
  fi
done

anvil --silent --port 8545 >/dev/null 2>&1 &
ANVIL=$!
cleanup() {
  kill $ANVIL 2>/dev/null || true
  # `npx next start` spawns next-server as a child; stop whatever is listening on the port.
  for pid in $(ss -ltnp "sport = :$PORT" 2>/dev/null | grep -oP 'pid=\K\d+'); do kill "$pid" 2>/dev/null || true; done
}
trap cleanup EXIT
sleep 2

KEY=$(cast wallet private-key --mnemonic "test test test test test test test test test test test junk" --mnemonic-index 0)
(cd "$ROOT/contracts" && forge script script/Deploy.s.sol --rpc-url $RPC --broadcast --private-key "$KEY" >/dev/null)
ADDRESS=$(jq -r .partis "$ROOT/contracts/deployments/31337.json")
echo "Deployed PartisEventPass at $ADDRESS"

cd "$ROOT/web"
NEXT_PUBLIC_CHAIN_ID=31337 NEXT_PUBLIC_PARTIS_ADDRESS=$ADDRESS npx next build >/dev/null
npx next start -p "$PORT" >/dev/null 2>&1 &
for _ in $(seq 1 30); do curl -sf "http://localhost:$PORT" >/dev/null && break; sleep 1; done

mkdir -p e2e/screenshots
E2E_BASE_URL="http://localhost:$PORT" npx playwright test "$@"
