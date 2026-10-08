import { expect, test, type Page } from "@playwright/test";
import { ACCOUNTS, injectWallet } from "./wallet";

/**
 * Responsive regression test: every route at common device widths must fit the viewport
 * (no horizontal scrolling) and keep tap targets usable. Runs after flow.spec.ts in the
 * browser suite, so pages render with real on-chain data (an event, a pass, a check-in).
 */

const WIDTHS = [
  { name: "phone-s", width: 320, height: 640, touch: true },
  { name: "phone", width: 375, height: 812, touch: true },
  { name: "phone-l", width: 430, height: 932, touch: true },
  { name: "tablet", width: 768, height: 1024, touch: true },
  { name: "tablet-l", width: 1024, height: 768, touch: true },
  { name: "laptop", width: 1366, height: 768, touch: false },
  { name: "desktop", width: 1920, height: 1080, touch: false },
];

/** On touch screens: tap targets ≥ 40px and form text ≥ 16px (prevents iOS focus zoom). */
async function touchProblems(page: Page) {
  return page.evaluate(() => {
    const out: string[] = [];
    for (const el of Array.from(document.querySelectorAll("main button, main a.btn, header button, .chip"))) {
      const b = el.getBoundingClientRect();
      if (b.height > 0 && b.height < 40) out.push(`"${el.textContent?.trim().slice(0, 18)}" ${Math.round(b.height)}px tall`);
    }
    for (const el of Array.from(document.querySelectorAll("input:not([type=checkbox]), select, textarea"))) {
      const fs = parseFloat(getComputedStyle(el).fontSize);
      if (el.getBoundingClientRect().height > 0 && fs < 16) out.push(`${el.tagName.toLowerCase()} text ${fs}px`);
    }
    return out;
  });
}

const ROUTES = ["/", "/events", "/events/1", "/passes", "/organizer", "/check-in?event=1"];

async function overflowingElements(page: Page) {
  return page.evaluate(() => {
    const vw = document.documentElement.clientWidth;
    const out: string[] = [];
    for (const el of Array.from(document.querySelectorAll("body *"))) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      // Ignore content inside intentionally scrollable containers.
      let p: Element | null = el.parentElement;
      let scrollable = false;
      while (p && p !== document.body) {
        const ox = getComputedStyle(p).overflowX;
        if (ox === "auto" || ox === "scroll" || ox === "hidden") {
          scrollable = true;
          break;
        }
        p = p.parentElement;
      }
      if (!scrollable && (r.right > vw + 1 || r.left < -1)) {
        out.push(`${el.tagName.toLowerCase()}.${(el.className || "").toString().split(" ")[0]} → ${Math.round(r.right)}px`);
      }
    }
    return { vw, scrollWidth: document.documentElement.scrollWidth, offenders: out.slice(0, 5) };
  });
}

for (const vp of WIDTHS) {
  test(`fits ${vp.name} (${vp.width}px) on every route`, async ({ browser, baseURL }) => {
    const context = await browser.newContext({
      baseURL,
      viewport: { width: vp.width, height: vp.height },
      hasTouch: vp.touch,
      isMobile: vp.touch && vp.width < 1024,
    });
    const page = await context.newPage();
    await injectWallet(page, ACCOUNTS.organizer);
    await page.goto("/");
    await page.getByRole("button", { name: "Connect Wallet" }).first().click();
    await expect(page.getByText("Wallet connected.")).toBeVisible();

    for (const route of ROUTES) {
      await page.goto(route);
      await page.waitForLoadState("networkidle");
      await page.waitForTimeout(300);
      const res = await overflowingElements(page);
      expect(res.scrollWidth, `${route} at ${vp.width}px overflows: ${res.offenders.join(", ")}`).toBeLessThanOrEqual(
        res.vw,
      );
      if (vp.touch) {
        const problems = await touchProblems(page);
        expect(problems, `${route} at ${vp.width}px (touch)`).toEqual([]);
      }
      const slug = route === "/" ? "home" : route.slice(1).replace(/[/?=]/g, "-");
      await page.screenshot({ path: `e2e/screenshots/rwd-${vp.width}-${slug}.png`, fullPage: true });
    }
    await context.close();
  });
}
