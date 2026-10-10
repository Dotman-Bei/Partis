import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test, type Browser, type Page } from "@playwright/test";
import { PNG } from "pngjs";
import jsQR from "jsqr";
import { createPublicClient, createWalletClient, http, isHex, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { botTestnet } from "../src/lib/chains";
import { partisAbi } from "../src/lib/abi";
import { encodeEntry, entryMessage } from "../src/lib/entry";

/**
 * Live testnet run of docs/TESTNET_TEST_PLAN.md against the deployed site and contract,
 * using the wallets in /root/Partis/.test-wallets.env (git-ignored). Creates real testnet
 * records, all named "Partis test run" so they are never mistaken for real usage.
 *
 *   npx playwright test -c e2e-live
 */

const SITE = process.env.LIVE_URL ?? "https://partis-seven.vercel.app";
const CONTRACT = process.env.LIVE_CONTRACT as Hex;
const env = Object.fromEntries(
  readFileSync(join(__dirname, "../../.test-wallets.env"), "utf8")
    .split("\n")
    .filter((l) => /^\w+=/.test(l))
    .map((l) => l.split("=") as [string, string]),
);
const KEYS = { organizer: env.ORGANIZER_KEY, attendee: env.ATTENDEE_KEY, staff: env.STAFF_KEY } as Record<
  string,
  Hex
>;
const publicClient = createPublicClient({ chain: botTestnet, transport: http() });

test.describe.configure({ mode: "serial" });
test.setTimeout(20 * 60_000);

/** Connects a browser page to the site with a wallet whose key stays in this Node process. */
async function walletPage(browser: Browser, role: keyof typeof KEYS): Promise<Page> {
  const account = privateKeyToAccount(KEYS[role]);
  const wallet = createWalletClient({ account, chain: botTestnet, transport: http() });
  const context = await browser.newContext({ baseURL: SITE, viewport: { width: 430, height: 932 }, hasTouch: true, isMobile: true });
  const page = await context.newPage();
  await page.exposeFunction("__partisSign", async (method: string, params: unknown[]) => {
    if (method === "eth_sendTransaction") {
      const tx = params[0] as { to: Hex; data?: Hex; value?: Hex; gas?: Hex };
      return wallet.sendTransaction({
        to: tx.to,
        data: tx.data,
        value: tx.value ? BigInt(tx.value) : undefined,
        gas: tx.gas ? BigInt(tx.gas) : undefined,
      });
    }
    if (method === "personal_sign") {
      const msg = params[0] as string;
      return wallet.signMessage({ message: isHex(msg) ? { raw: msg } : msg });
    }
    throw new Error(`unsupported ${method}`);
  });
  await page.addInitScript(
    ({ address, chainIdHex, rpc }) => {
      let id = 0;
      const sign = (window as unknown as { __partisSign: (m: string, p: unknown[]) => Promise<string> }).__partisSign;
      (window as unknown as { ethereum: unknown }).ethereum = {
        isMetaMask: true,
        on() {},
        removeListener() {},
        async request({ method, params = [] }: { method: string; params?: unknown[] }) {
          if (method === "eth_requestAccounts" || method === "eth_accounts") return [address];
          if (method === "eth_chainId") return chainIdHex;
          if (method === "wallet_switchEthereumChain" || method === "wallet_addEthereumChain") return null;
          if (method === "wallet_requestPermissions" || method === "wallet_getPermissions")
            return [{ parentCapability: "eth_accounts" }];
          if (method === "eth_sendTransaction" || method === "personal_sign") return sign(method, params);
          const res = await fetch(rpc, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ jsonrpc: "2.0", id: ++id, method, params }),
          }).then((r) => r.json());
          if (res.error) throw Object.assign(new Error(res.error.message), res.error);
          return res.result;
        },
      };
    },
    { address: account.address, chainIdHex: `0x${botTestnet.id.toString(16)}`, rpc: botTestnet.rpcUrls.default.http[0] },
  );
  await page.goto("/");
  await page.getByRole("button", { name: "Connect Wallet" }).first().click();
  await expect(page.getByText("Wallet connected.")).toBeVisible();
  return page;
}

const hhmm = (d: Date) => `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
const ymd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

async function createEvent(
  page: Page,
  o: { name: string; startInMin: number; lengthMin: number; price?: string; supply: string },
): Promise<bigint> {
  await page.goto("/organizer");
  await page.getByRole("button", { name: "＋ Create event" }).first().click();
  const d = page.getByRole("dialog", { name: "Create an event" });
  const start = new Date(Date.now() + o.startInMin * 60_000);
  const end = new Date(start.getTime() + o.lengthMin * 60_000);
  await d.getByLabel("Event name").fill(o.name);
  await d.getByLabel("Venue").fill("Online (automated testnet run)");
  await d.getByLabel("Date").fill(ymd(start));
  await d.getByLabel("Start time").fill(hhmm(start));
  await d.getByLabel("End time").fill(hhmm(end));
  await d.getByLabel("Pass supply").fill(o.supply);
  if (o.price) {
    await d.getByLabel("Claim or purchase mode").selectOption("paid");
    await d.getByLabel("Price in BOT").fill(o.price);
  }
  await d.getByLabel("Minutes before start that check-in opens").fill("60");
  await d.getByRole("button", { name: "Create event" }).click();
  const done = page.getByRole("dialog", { name: "Event published" });
  await expect(done).toBeVisible({ timeout: 60_000 });
  const id = BigInt((await done.locator(".micro").first().textContent())!.match(/#(\d+)/)![1]);
  await done.getByRole("button", { name: "Done" }).click();
  return id;
}

async function decodeQr(page: Page, tokenId: bigint): Promise<string> {
  const img = page.getByRole("img", { name: new RegExp(`Entry QR for pass ${tokenId}`) });
  await expect(img).toBeVisible({ timeout: 30_000 });
  const src = (await img.getAttribute("src"))!;
  const png = PNG.sync.read(Buffer.from(src.split(",")[1], "base64"));
  return jsQR(new Uint8ClampedArray(png.data), png.width, png.height)!.data;
}

async function ownedPass(owner: Hex, eventId: bigint): Promise<bigint> {
  const ids = await publicClient.readContract({ address: CONTRACT, abi: partisAbi, functionName: "getOwnerTokenIds", args: [owner, 0n, 100n] });
  const passes = await publicClient.readContract({ address: CONTRACT, abi: partisAbi, functionName: "getPasses", args: [ids] });
  return passes.find((p) => p.eventId === eventId)!.tokenId;
}

const ev: Record<string, bigint> = {};
const pass: Record<string, bigint> = {};
let qr = "";
const results: string[] = [];
const ok = (s: string) => {
  results.push(`PASS  ${s}`);
  console.log(`  ✓ ${s}`);
};

test("1. organizer creates events and adds staff", async ({ browser }) => {
  const org = await walletPage(browser, "organizer");
  // Paid event, check-in open now, ends ~12 min from now (for the withdraw test).
  ev.paid = await createEvent(org, { name: "Partis test run — paid", startInMin: 3, lengthMin: 9, price: "0.5", supply: "5" });
  ok(`created paid event #${ev.paid}`);
  ev.free = await createEvent(org, { name: "Partis test run — free", startInMin: 30, lengthMin: 60, supply: "5" });
  ok(`created free event #${ev.free}`);
  ev.cancel = await createEvent(org, { name: "Partis test run — cancel", startInMin: 60, lengthMin: 60, price: "0.5", supply: "5" });
  ok(`created event to cancel #${ev.cancel}`);

  await org.goto("/organizer");
  const card = org.locator("article", { has: org.getByRole("link", { name: "Partis test run — paid" }) }).first();
  await card.getByRole("button", { name: "Staff" }).click();
  const staffDialog = org.getByRole("dialog", { name: "Check-in staff" });
  await staffDialog.getByLabel("Staff wallet address").fill(env.STAFF_ADDRESS);
  await staffDialog.getByRole("button", { name: "Add" }).click();
  await expect(staffDialog.getByTitle(env.STAFF_ADDRESS)).toBeVisible({ timeout: 60_000 });
  ok("staff wallet authorized for the paid event");
});

test("2. attendee buys and claims passes", async ({ browser }) => {
  const att = await walletPage(browser, "attendee");
  await att.goto(`/events/${ev.paid}`);
  await att.getByRole("button", { name: /Buy pass · 0\.5 BOT/ }).click();
  await att.getByRole("dialog", { name: "Buy pass" }).getByRole("button", { name: /Buy pass · 0\.5 BOT/ }).click();
  await expect(att.getByRole("dialog", { name: /^Pass #\d+$/ })).toBeVisible({ timeout: 60_000 });
  await att.keyboard.press("Escape");
  pass.paid = await ownedPass(env.ATTENDEE_ADDRESS as Hex, ev.paid);
  ok(`bought pass #${pass.paid} for 0.5 tBOT`);

  await att.reload();
  await expect(att.getByText("This wallet already claimed its pass for this event.")).toHaveCount(0); // holds it
  await expect(att.getByRole("button", { name: /Buy pass/ })).toHaveCount(0);
  ok("second purchase not offered (one per wallet)");

  await att.goto(`/events/${ev.free}`);
  await att.getByRole("button", { name: "Claim free pass" }).click();
  await att.getByRole("dialog", { name: "Claim pass" }).getByRole("button", { name: "Claim free pass" }).click();
  await expect(att.getByRole("dialog", { name: /^Pass #\d+$/ })).toBeVisible({ timeout: 60_000 });
  await att.keyboard.press("Escape");
  pass.free = await ownedPass(env.ATTENDEE_ADDRESS as Hex, ev.free);
  ok(`claimed free pass #${pass.free}`);

  await att.goto(`/events/${ev.cancel}`);
  await att.getByRole("button", { name: /Buy pass · 0\.5 BOT/ }).click();
  await att.getByRole("dialog", { name: "Buy pass" }).getByRole("button", { name: /Buy pass · 0\.5 BOT/ }).click();
  await expect(att.getByRole("dialog", { name: /^Pass #\d+$/ })).toBeVisible({ timeout: 60_000 });
  pass.cancel = await ownedPass(env.ATTENDEE_ADDRESS as Hex, ev.cancel);
  ok(`bought pass #${pass.cancel} on the event that will be cancelled`);

  // Contract-level double-buy attempt must revert.
  const again = await publicClient
    .simulateContract({ address: CONTRACT, abi: partisAbi, functionName: "claim", args: [ev.paid], value: 500000000000000000n, account: env.ATTENDEE_ADDRESS as Hex })
    .then(() => "succeeded", (e: Error) => e.message);
  expect(again).toMatch(/AlreadyClaimed/);
  ok("contract rejects a second purchase from the same wallet (AlreadyClaimed)");
});

test("3. attendee signs an entry QR", async ({ browser }) => {
  const att = await walletPage(browser, "attendee");
  await att.goto("/passes");
  const card = att.locator("article", { hasText: `Pass #${pass.paid} ·` });
  await card.getByRole("button", { name: "Show QR" }).click();
  await att.getByRole("dialog", { name: `Pass #${pass.paid}` }).getByRole("button", { name: "Sign entry QR" }).click();
  qr = await decodeQr(att, pass.paid);
  expect(qr).toMatch(new RegExp(`^partis:1:968:${ev.paid}:${pass.paid}:\\d+:0x[0-9a-f]{130}$`));
  ok("signed entry QR decoded from the rendered image");
});

test("4. door: staff verifies, checks in; failures are rejected", async ({ browser }) => {
  const staff = await walletPage(browser, "staff");
  await staff.goto(`/check-in?event=${ev.paid}`);
  await expect(staff.getByText("Staff", { exact: true })).toBeVisible({ timeout: 30_000 });
  ok("staff wallet recognised as Staff");

  const verify = async (input: string) => {
    const field = staff.getByLabel("Pass ID or QR text");
    if (!(await field.isVisible())) await staff.getByRole("button", { name: "Scan next" }).click();
    if (await staff.getByRole("button", { name: "Stop camera" }).isVisible()) await staff.getByRole("button", { name: "Stop camera" }).click();
    await field.fill(input);
    await staff.getByRole("button", { name: "Verify" }).click();
  };

  await verify(qr);
  await expect(staff.getByRole("heading", { name: "Valid pass" })).toBeVisible({ timeout: 30_000 });
  await expect(staff.getByText(/Holder signature verified/)).toBeVisible();
  ok("valid pass with verified holder signature");
  await staff.getByRole("button", { name: "Confirm check-in" }).click();
  await expect(staff.getByRole("heading", { name: "Checked in" })).toBeVisible({ timeout: 60_000 });
  ok(`pass #${pass.paid} checked in on-chain`);

  await verify(qr);
  await expect(staff.getByText("On-chain: Already checked in")).toBeVisible({ timeout: 30_000 });
  ok("replay rejected: Already checked in");

  await verify(String(pass.free));
  await expect(staff.getByText("On-chain: Pass is for a different event")).toBeVisible({ timeout: 30_000 });
  ok("wrong-event pass rejected");

  await verify("999999");
  await expect(staff.getByText("On-chain: Pass does not exist")).toBeVisible({ timeout: 30_000 });
  ok("fake pass rejected");

  // A screenshot of a QR signed 11 minutes ago (same as a stale copied QR).
  const issuedAt = Math.floor(Date.now() / 1000) - 11 * 60;
  const signature = await privateKeyToAccount(KEYS.attendee).signMessage({
    message: entryMessage({ chainId: 968, contract: CONTRACT, eventId: ev.paid, tokenId: pass.free, issuedAt }),
  });
  await verify(encodeEntry({ chainId: 968, eventId: ev.paid, tokenId: pass.free, issuedAt, signature }));
  await expect(staff.getByRole("heading", { name: "Do not admit" })).toBeVisible({ timeout: 30_000 });
  ok("stale QR not admissible");
});

test("5. a wallet that is not staff cannot check in", async ({ browser }) => {
  const att = await walletPage(browser, "attendee");
  await att.goto(`/check-in?event=${ev.paid}`);
  await expect(att.getByText("This wallet can't check people in for this event.")).toBeVisible({ timeout: 30_000 });
  const res = await publicClient
    .simulateContract({ address: CONTRACT, abi: partisAbi, functionName: "checkIn", args: [ev.paid, pass.paid], account: env.ATTENDEE_ADDRESS as Hex })
    .then(() => "succeeded", (e: Error) => e.message);
  expect(res).toMatch(/NotCheckInOperator/);
  ok("unauthorized check-in blocked in UI and by contract (NotCheckInOperator)");
});

test("6. a checked-in pass cannot be transferred", async () => {
  const res = await publicClient
    .simulateContract({
      address: CONTRACT,
      abi: [...partisAbi, { type: "function", name: "transferFrom", stateMutability: "nonpayable", inputs: [{ name: "from", type: "address" }, { name: "to", type: "address" }, { name: "tokenId", type: "uint256" }], outputs: [] }] as const,
      functionName: "transferFrom",
      args: [env.ATTENDEE_ADDRESS as Hex, env.STAFF_ADDRESS as Hex, pass.paid],
      account: env.ATTENDEE_ADDRESS as Hex,
    })
    .then(() => "succeeded", (e: Error) => e.message);
  expect(res).toMatch(/PassAlreadyUsed/);
  ok("transfer of a used pass rejected (PassAlreadyUsed)");
});

test("7. attendee sees the pass as checked in", async ({ browser }) => {
  const att = await walletPage(browser, "attendee");
  await att.goto("/passes");
  const card = att.locator("article", { hasText: `Pass #${pass.paid} ·` });
  await expect(card.getByText("CHECKED IN", { exact: true })).toBeVisible({ timeout: 30_000 });
  ok("My Passes shows CHECKED IN");
});

test("8. cancel and refund", async ({ browser }) => {
  const org = await walletPage(browser, "organizer");
  await org.goto("/organizer");
  const card = org.locator("article", { has: org.getByRole("link", { name: "Partis test run — cancel" }) }).first();
  await card.getByRole("button", { name: "Cancel event" }).click();
  await org.getByRole("dialog", { name: "Cancel this event?" }).getByRole("button", { name: "Cancel event" }).click();
  await expect(card.getByText("CANCELLED")).toBeVisible({ timeout: 60_000 });
  ok(`event #${ev.cancel} cancelled`);

  const att = await walletPage(browser, "attendee");
  const before = await publicClient.getBalance({ address: env.ATTENDEE_ADDRESS as Hex });
  await att.goto(`/events/${ev.cancel}`);
  await att.getByRole("button", { name: /Refund 0\.5 BOT/ }).click();
  await expect(att.getByText(/Refunded 0\.5 BOT/)).toBeVisible({ timeout: 60_000 });
  const after = await publicClient.getBalance({ address: env.ATTENDEE_ADDRESS as Hex });
  expect(after - before).toBeGreaterThan(490000000000000000n); // 0.5 minus gas
  ok("attendee refunded 0.5 tBOT");
});

test("9. organizer withdraws after the event ends", async ({ browser }) => {
  const e = await publicClient.readContract({ address: CONTRACT, abi: partisAbi, functionName: "getEvent", args: [ev.paid] });
  const wait = Number(e.endTime) * 1000 - Date.now() + 15_000;
  if (wait > 0) {
    console.log(`  … waiting ${Math.round(wait / 1000)}s for event #${ev.paid} to end`);
    await new Promise((r) => setTimeout(r, wait));
  }
  const org = await walletPage(browser, "organizer");
  const before = await publicClient.getBalance({ address: env.ORGANIZER_ADDRESS as Hex });
  await org.goto("/organizer");
  const card = org.locator("article", { has: org.getByRole("link", { name: "Partis test run — paid" }) }).first();
  await card.getByRole("button", { name: /Withdraw 0\.5 BOT/ }).click();
  await expect(org.getByText(/Withdrew 0\.5 BOT/)).toBeVisible({ timeout: 60_000 });
  const after = await publicClient.getBalance({ address: env.ORGANIZER_ADDRESS as Hex });
  expect(after - before).toBeGreaterThan(490000000000000000n);
  ok("organizer withdrew 0.5 tBOT after the event ended");
});

test.afterAll(() => {
  console.log(`\nLive testnet run on ${SITE} (contract ${CONTRACT})\n${results.join("\n")}`);
});
