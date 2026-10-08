import { expect, test, type Page } from "@playwright/test";
import { PNG } from "pngjs";
import jsQR from "jsqr";
import { ACCOUNTS, injectWallet } from "./wallet";

/**
 * PRD §5 required flow, end to end through the real UI against a local anvil deployment:
 * organizer creates event → attendee buys pass → attendee shows signed QR → staff scans,
 * verifies against chain, checks in → second check-in rejected; plus unauthorized staff.
 * Run with ./scripts/e2e-browser.sh (fresh chain + deployment).
 */

test.describe.configure({ mode: "serial" });

const EVENT_NAME = `E2E Builders Night ${Date.now() % 100000}`;
let entryQr = "";

async function connect(page: Page) {
  await page.getByRole("button", { name: "Connect Wallet" }).first().click();
  await expect(page.getByText("Wallet connected.")).toBeVisible();
}

function hhmm(d: Date) {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

test("organizer creates a paid event with the sentence builder", async ({ page }) => {
  await injectWallet(page, ACCOUNTS.organizer);
  await page.goto("/organizer");
  await connect(page);

  await page.getByRole("button", { name: "＋ Create event" }).first().click();
  const dialog = page.getByRole("dialog", { name: "Create an event" });
  await expect(dialog).toBeVisible();

  // Starts in 30 minutes; check-in opens 60 minutes before start, i.e. already open.
  const start = new Date(Date.now() + 30 * 60_000);
  const end = new Date(start.getTime() + 3 * 3600_000);
  const date = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}-${String(start.getDate()).padStart(2, "0")}`;

  await dialog.getByLabel("Event name").fill(EVENT_NAME);
  await dialog.getByLabel("Venue").fill("Yaba Tech Hub, Lagos");
  await dialog.getByLabel("Date").fill(date);
  await dialog.getByLabel("Start time").fill(hhmm(start));
  await dialog.getByLabel("End time").fill(hhmm(end));
  await dialog.getByLabel("Pass supply").fill("25");
  await dialog.getByLabel("Claim or purchase mode").selectOption("paid");
  await dialog.getByLabel("Price in BOT").fill("1.5");
  await dialog.getByLabel("Minutes before start that check-in opens").fill("60");

  await expect(dialog.getByText(/25 General Admission passes, 1\.5 BOT, one per wallet/)).toBeVisible();
  await dialog.getByRole("button", { name: "Create event" }).click();

  const done = page.getByRole("dialog", { name: "Event published" });
  await expect(done).toBeVisible({ timeout: 20_000 });
  await expect(done.getByText("Event #1")).toBeVisible();
  await done.getByRole("button", { name: "Done" }).click();

  await expect(page.getByRole("heading", { name: EVENT_NAME })).toBeVisible();
  await page.screenshot({ path: "e2e/screenshots/organizer.png", fullPage: true });
});

test("attendee buys a pass on the event page", async ({ page }) => {
  await injectWallet(page, ACCOUNTS.attendee);
  await page.goto("/events/1");
  await expect(page.getByRole("heading", { name: EVENT_NAME })).toBeVisible();
  await connect(page);

  await page.getByRole("button", { name: /Buy pass · 1\.5 BOT/ }).click();
  const dialog = page.getByRole("dialog", { name: "Buy pass" });
  await dialog.getByRole("button", { name: /Buy pass · 1\.5 BOT/ }).click();

  // Success opens the pass QR dialog for the newly issued pass.
  const qr = page.getByRole("dialog", { name: "Pass #1" });
  await expect(qr).toBeVisible({ timeout: 20_000 });
  await qr.getByRole("button", { name: "Close" }).click();

  await expect(page.getByText("Pass #1", { exact: true })).toBeVisible();
  await expect(page.getByText("ACTIVE")).toBeVisible();
  await expect(page.getByText("1 / 25")).toBeVisible();
  await page.screenshot({ path: "e2e/screenshots/event-detail.png", fullPage: true });
});

test("attendee signs an entry QR from My Passes", async ({ page }) => {
  await injectWallet(page, ACCOUNTS.attendee);
  await page.goto("/passes");
  await connect(page);

  await expect(page.getByRole("heading", { name: EVENT_NAME })).toBeVisible();
  await page.getByRole("button", { name: "Show QR" }).click();
  const dialog = page.getByRole("dialog", { name: "Pass #1" });
  await dialog.getByRole("button", { name: "Sign entry QR" }).click();

  const img = dialog.getByRole("img", { name: /Entry QR for pass 1/ });
  await expect(img).toBeVisible();
  const src = await img.getAttribute("src");
  const png = PNG.sync.read(Buffer.from(src!.split(",")[1], "base64"));
  const decoded = jsQR(new Uint8ClampedArray(png.data), png.width, png.height);
  expect(decoded?.data).toMatch(/^partis:1:31337:1:1:\d+:0x[0-9a-f]{130}$/);
  entryQr = decoded!.data;
  await page.screenshot({ path: "e2e/screenshots/pass-qr.png" });
});

test("a wallet that is not organizer or staff cannot check in", async ({ page }) => {
  await injectWallet(page, ACCOUNTS.stranger);
  await page.goto("/check-in?event=1");
  await connect(page);
  await expect(page.getByText("This wallet can't check people in for this event.")).toBeVisible();
});

test("organizer adds staff; staff verifies and checks in; replay is rejected", async ({ browser }) => {
  // Organizer authorizes the staff wallet.
  const orgPage = await (await browser.newContext()).newPage();
  await injectWallet(orgPage, ACCOUNTS.organizer);
  await orgPage.goto("/organizer");
  await connect(orgPage);
  await orgPage.getByRole("button", { name: "Staff" }).click();
  const staffDialog = orgPage.getByRole("dialog", { name: "Check-in staff" });
  await staffDialog.getByLabel("Staff wallet address").fill(ACCOUNTS.staff);
  await staffDialog.getByRole("button", { name: "Add" }).click();
  await expect(staffDialog.getByTitle(ACCOUNTS.staff)).toBeVisible({ timeout: 20_000 });

  // Staff scans (pastes) the signed QR.
  const page = await (await browser.newContext()).newPage();
  await injectWallet(page, ACCOUNTS.staff);
  await page.goto("/check-in?event=1");
  await connect(page);
  await expect(page.getByRole("heading", { name: EVENT_NAME })).toBeVisible();

  await page.getByLabel("Pass ID or QR text").fill(entryQr);
  await page.getByRole("button", { name: "Verify" }).click();
  await expect(page.getByRole("heading", { name: "Valid pass" })).toBeVisible();
  await expect(page.getByText(/Holder signature verified/)).toBeVisible();
  await page.screenshot({ path: "e2e/screenshots/check-in-valid.png", fullPage: true });

  await page.getByRole("button", { name: "Confirm check-in" }).click();
  await expect(page.getByRole("heading", { name: "Checked in" })).toBeVisible({ timeout: 20_000 });

  // Replay: the same QR again.
  await page.getByRole("button", { name: "Scan next" }).click();
  await page.getByRole("button", { name: "Stop camera" }).click();
  await page.getByLabel("Pass ID or QR text").fill(entryQr);
  await page.getByRole("button", { name: "Verify" }).click();
  await expect(page.getByRole("heading", { name: "Do not admit" })).toBeVisible();
  await expect(page.getByText("On-chain: Already checked in")).toBeVisible();

  // Fake pass.
  await page.getByRole("button", { name: "Scan next" }).click();
  await page.getByRole("button", { name: "Stop camera" }).click();
  await page.getByLabel("Pass ID or QR text").fill("999");
  await page.getByRole("button", { name: "Verify" }).click();
  await expect(page.getByText("On-chain: Pass does not exist")).toBeVisible();
  await page.screenshot({ path: "e2e/screenshots/check-in-rejected.png", fullPage: true });
});

test("attendee sees the pass as checked in", async ({ page }) => {
  await injectWallet(page, ACCOUNTS.attendee);
  await page.goto("/passes");
  await connect(page);
  await expect(page.getByText("CHECKED IN", { exact: true })).toBeVisible();
  await expect(page.getByText("Attendance recorded on-chain.")).toBeVisible();
  await page.screenshot({ path: "e2e/screenshots/passes.png", fullPage: true });
});

test("home and events read live chain data", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Events created on-chain")).toBeVisible();
  await expect(page.locator(".big-number")).toHaveText("1");
  await page.screenshot({ path: "e2e/screenshots/home.png", fullPage: true });

  await page.goto("/events");
  await expect(page.getByRole("heading", { name: EVENT_NAME })).toBeVisible();
  await page.screenshot({ path: "e2e/screenshots/events.png", fullPage: true });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.screenshot({ path: "e2e/screenshots/home-mobile.png", fullPage: true });
});
