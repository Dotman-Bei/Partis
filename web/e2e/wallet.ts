import type { Page } from "@playwright/test";

/** anvil's default dev accounts (unlocked on a local node, so anvil signs for them). */
export const ACCOUNTS = {
  organizer: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
  staff: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
  attendee: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
  stranger: "0x90F79bf6EB2c4f870365E785982E1f101E93b906",
} as const;

export const RPC = process.env.E2E_RPC ?? "http://127.0.0.1:8545";

/**
 * Test-only EIP-1193 provider. Exposes one anvil account as `window.ethereum` and forwards
 * every request — including eth_sendTransaction and personal_sign — to the local node.
 * It exists only in the browser test; the app itself ships no key handling.
 */
export async function injectWallet(page: Page, account: string) {
  await page.addInitScript(
    ({ account, rpc }) => {
      let id = 0;
      const listeners: Record<string, ((...args: unknown[]) => void)[]> = {};
      const rpcCall = async (method: string, params: unknown[] = []) => {
        const res = await fetch(rpc, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ jsonrpc: "2.0", id: ++id, method, params }),
        });
        const json = await res.json();
        if (json.error) {
          const err = new Error(json.error.message) as Error & { code: number; data: unknown };
          err.code = json.error.code;
          err.data = json.error.data;
          throw err;
        }
        return json.result;
      };
      (window as unknown as { ethereum: unknown }).ethereum = {
        isMetaMask: true,
        request: async ({ method, params }: { method: string; params?: unknown[] }) => {
          switch (method) {
            case "eth_requestAccounts":
            case "eth_accounts":
              return [account];
            case "wallet_switchEthereumChain":
            case "wallet_addEthereumChain":
              return null;
            case "wallet_requestPermissions":
            case "wallet_getPermissions":
              return [{ parentCapability: "eth_accounts" }];
            default:
              return rpcCall(method, params ?? []);
          }
        },
        on: (event: string, fn: (...args: unknown[]) => void) => {
          (listeners[event] ??= []).push(fn);
        },
        removeListener: (event: string, fn: (...args: unknown[]) => void) => {
          listeners[event] = (listeners[event] ?? []).filter((f) => f !== fn);
        },
      };
    },
    { account, rpc: RPC },
  );
}
