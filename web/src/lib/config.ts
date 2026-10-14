// `injected` comes from the core package: importing it from "wagmi/connectors" pulls the
// Coinbase, WalletConnect and MetaMask SDK connectors into every page even though Partis
// only uses the browser's injected wallet.
import { createConfig, http, injected } from "wagmi";
import { getAddress, isAddress, type Address } from "viem";
import { chainById } from "./chains";

/** The single chain this deployment of Partis runs on. Defaults to BOT Chain Testnet. */
export const targetChain = chainById(Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? 968));

const rawAddress = process.env.NEXT_PUBLIC_PARTIS_ADDRESS ?? "";

/** PartisEventPass address, or null when this build has not been pointed at a deployment. */
export const partisAddress: Address | null = isAddress(rawAddress) ? getAddress(rawAddress) : null;

export const explorerUrl = targetChain.blockExplorers?.default.url ?? null;

/** BOT Chain's official website (botchain.ai redirects here). */
export const botChainWebsite = "https://www.botchain.ai";

export const repoUrl = process.env.NEXT_PUBLIC_REPO_URL || null;

export const wagmiConfig = createConfig({
  chains: [targetChain],
  connectors: [injected()],
  transports: { [targetChain.id]: http() },
  ssr: true,
});

declare module "wagmi" {
  interface Register {
    config: typeof wagmiConfig;
  }
}
