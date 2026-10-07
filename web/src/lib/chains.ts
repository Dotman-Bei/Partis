import { defineChain, type Chain } from "viem";

// Values verified 2026-10-07 against dev-docs.botchain.ai (docs/BOT_CHAIN_CONFIG.md).
// Re-verify before every deployment; never edit these from memory.

export const botTestnet = defineChain({
  id: 968,
  name: "BOT Chain Testnet",
  nativeCurrency: { name: "BOT", symbol: "BOT", decimals: 18 },
  rpcUrls: { default: { http: ["https://rpc.bohr.life"] } },
  blockExplorers: { default: { name: "BOTScan", url: "https://scan.bohr.life" } },
  testnet: true,
});

export const botMainnet = defineChain({
  id: 677,
  name: "BOT Chain Mainnet",
  nativeCurrency: { name: "BOT", symbol: "BOT", decimals: 18 },
  rpcUrls: { default: { http: ["https://rpc.botchain.ai"] } },
  blockExplorers: { default: { name: "BOTScan", url: "https://scan.botchain.ai" } },
  contracts: {
    multicall3: { address: "0xcA11bde05977b3631167028862bE2a173976CA11" },
  },
});

/** Local anvil node for development and the end-to-end script. */
export const localChain = defineChain({
  id: 31337,
  name: "Local (anvil)",
  nativeCurrency: { name: "BOT", symbol: "BOT", decimals: 18 },
  rpcUrls: { default: { http: ["http://127.0.0.1:8545"] } },
  testnet: true,
});

const byId: Record<number, Chain> = {
  [botTestnet.id]: botTestnet,
  [botMainnet.id]: botMainnet,
  [localChain.id]: localChain,
};

export function chainById(id: number): Chain {
  const chain = byId[id];
  if (!chain) throw new Error(`Unsupported chain id ${id}. Use 968 (testnet), 677 (mainnet) or 31337 (local).`);
  return chain;
}
