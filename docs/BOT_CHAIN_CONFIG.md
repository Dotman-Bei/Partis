# BOT Chain configuration (verified)

PRD §24 requires network values to be fetched from official sources, never from memory.
These were verified on **2026-10-07** against the official developer docs and live RPC calls.
Re-verify before every deployment.

| | Testnet | Mainnet |
|---|---|---|
| Name | BOT Chain Testnet ("Bohr") | BOT Mainnet |
| Chain ID | `968` (`0x3c8`) | `677` (`0x2a5`) |
| HTTP RPC | `https://rpc.bohr.life` | `https://rpc.botchain.ai` |
| WebSocket RPC | not published in the docs; not required by Partis | not published; not required |
| Explorer | `https://scan.bohr.life` (Blockscout) | `https://scan.botchain.ai` (Blockscout) |
| Faucet | `https://faucet.botchain.ai/basic` (10 tBOT / address / 24h) | n/a — BOT via the official DEX |
| Native token | BOT (tBOT on testnet), 18 decimals | BOT, 18 decimals |

## Sources

- Quick Guide — https://dev-docs.botchain.ai/docs/Developers/quick-guide/
- JSON-RPC endpoints — https://dev-docs.botchain.ai/docs/Developers/json-rpc-endpoint/
- Faucet guide — https://dev-docs.botchain.ai/docs/Developers/claim-test-tbot-tokens/
- Live check: `eth_chainId` on `rpc.bohr.life` → `0x3c8`; on `rpc.botchain.ai` → `0x2a5`.

## Facts that shaped the architecture

1. **`eth_getLogs` is disabled on the official mainnet RPC** (stated in the JSON-RPC docs).
   Partis therefore never depends on event logs for reads. The contract exposes bounded,
   paginated view functions (`getEvents`, `getPasses`, `getEventTokenIds`, …) and the
   frontend reads state directly. Events are still emitted for indexers and explorers.
2. **Multicall3 is not deployed on testnet** (`eth_getCode` at
   `0xcA11bde05977b3631167028862bE2a173976CA11` returns `0x` on `rpc.bohr.life`; it does
   exist on mainnet). Batch view functions in the contract remove the need for it.
3. **The chain implements EIP-4844**, so it is at least Cancun-level; contracts compile with
   `evm_version = "cancun"`.
4. **Explorers are Blockscout**, so verification uses
   `forge verify-contract --verifier blockscout --verifier-url https://scan.bohr.life/api/`.
5. Average block time on testnet was ~0.67s at verification time.
6. **Mainnet minimum gas price is 20 gwei** (probed 2026-10-11: 19 gwei is rejected with
   "gasPrice too low"; there is no base fee). The RPC's `eth_gasPrice` also returns 20 gwei.
