# Frontend Style & Structure Guide — "Veynt" system

Extracted from [`Pandey456/VEYNT`](https://github.com/Pandey456/VEYNT) (README states MIT; there is no LICENSE file in the repo) · live at [veyntmarket.adarshpandey.xyz](https://veyntmarket.adarshpandey.xyz/).

Veynt is a confidential prediction market on BOT Chain: users stake on binary price outcomes, their YES/NO choice is encrypted in the browser, and an off-chain evaluator settles with a Merkle root.

**The one-line description:** dark crypto dashboard in black and signal yellow. A near-black ground lit by two faint yellow glows at the top corners, large-radius translucent cards with a yellow-tinted hairline edge, heavy system sans (weights 800–900) with tight negative tracking, one saturated yellow for every primary action, and tinted "fill + edge + text" pills for YES (yellow), NO (red) and status badges.

**Written for building agents.** §6 is a page-by-page blueprint (landing, app, modals, card states) and §7 is a replace map of every Veynt-specific string, number, address and link.

---

## 0. Read this first: there are three frontends, and only one is in the repo

| Surface | Where it lives | What this document has |
|---|---|---|
| **A. The app** (`index.html`) | the repo, root | **Everything verified from source:** every token, class, measurement, card state and modal |
| **B. Marketing landing** (`/`) | live site only | **Structure and copy only.** It's a Next.js build (images served from `/_next/image`) whose source isn't in this repo |
| **C. Redesigned app** (`/app`) | live site only | **Structure and copy only.** It differs from the repo's `index.html` |

What that means for an agent:

- **Style values in §2–5 and §8 come from the repo and are exact.** They describe surface A.
- **I could not read the live site's CSS.** The shell can't reach that domain from here and no browser was linked to this chat, so surfaces B and C are documented from their rendered text and links (§6.1, §6.4). Where §6.1 says how to render a landing section, that's a recommendation to build it from the repo's tokens, not a measurement of the live page.
- If you need pixel-level fidelity to the live landing, open it in a browser and read its computed styles before building.

Other things in the repo:

- `index-dev.html` is a byte-identical copy of `index.html`.
- `backup-index/` holds three older versions of the page (`index1.html`, `index2.html`, `index_working_html.txt`). Ignore them.
- `src/`, `script/`, `lib/`, `broadcast/` are the Solidity contract (Foundry); `veyntmarket-tee/` is the Node evaluator; `.github/workflows/fdc-full-run.yml` runs resolution.

---

## 1. Stack and file map

| Concern | Choice (surface A) |
|---|---|
| Build | **None.** One static HTML file: `<style>` (lines 8–494), markup (500–628), `<script type="module">` (629–1578) |
| CSS | Hand-written, 11 custom properties in `:root`, flat class names |
| Font | `font-family: Inter, system-ui, -apple-system, Segoe UI, sans-serif`. **Inter is never loaded**, so most visitors get their system UI face |
| JS | Vanilla DOM + [`viem@2.55.11`](https://esm.sh/viem@2.55.11) imported from esm.sh; no framework |
| Rendering | Market cards built as template strings and assigned with `innerHTML` (user text passed through `escapeHtml`) |
| Wallet | `window.ethereum` (MetaMask), auto-adds/switches to BOT Chain Testnet (chain 968) |
| Encryption | RSA-OAEP via `crypto.subtle`, public key embedded in the page |
| Surfaces B and C | Next.js (`next/image`), source not public in this repo |

```
index.html            THE APP: tokens, all styles, markup, script
index-dev.html        identical copy
backup-index/         older page versions (ignore)
.github/workflows/    fdc-full-run.yml (dispatched from the Resolve modal)
src/VeyntMarket.sol   contract the page talks to
veyntmarket-tee/      evaluator (encryption private key lives here, not in the page)
```

---

## 2. Colour tokens

```css
:root {
  --bg:     #080808;                   /* page ground */
  --panel:  #111111;                   /* defined, unused */
  --panel2: #171717;                   /* defined, unused */
  --border: rgba(255, 210, 0, 0.14);   /* yellow-tinted hairline, every card and control */
  --text:   #f7f7f2;                   /* warm off-white */
  --muted:  #9b9b91;                   /* warm grey, all secondary text */
  --green:  #35e59a;                   /* defined, unused */
  --red:    #ff5f6d;                   /* NO */
  --yellow: #ffd400;                   /* the accent */
  --blue:   #8fa7ff;                   /* RESOLVED */
  --black:  #080808;                   /* defined, unused (raw #080808 used instead) */
}
```

### The background

```css
body {
  background:
    radial-gradient(circle at 10% 0%, rgba(255, 212, 0, 0.12), transparent 30%),
    radial-gradient(circle at 90% 0%, rgba(255, 212, 0, 0.07), transparent 28%),
    var(--bg);
}
```

Two yellow glows bleed from the top corners, the left one stronger. It's the only atmosphere on the page.

### Off-token colours in use

The CSS reaches for raw values more than for its tokens. A clean clone should promote these:

| Value | Used for | Suggested token |
|---|---|---|
| `#151c27` (navy) | wallet button, ghost button, sentence-builder fields | `--control` |
| `#090d13` | text inputs, sentence-builder box | `--input` |
| `#0e131b` | modal | `--modal` |
| `#131b26` | toast | `--toast` |
| `#bbc4d0` | form labels | `--label` |
| `#dce2ea` | sentence-builder text | `--text-cool` |
| `#fff1a3` | logo gradient end | (part of logo) |
| `rgba(245,196,81,…)` | Resolve button, `.badge.ready` | a second, softer yellow; fold into `--yellow` |
| `rgba(112,167,255,…)` | resolved badge fill and edge | doesn't match `--blue` `#8fa7ff`; use `--blue` |

Note the split: the ground is neutral black, but controls, inputs, modal and toast are **navy-black** (`#0e131b`–`#151c27`). The page mixes a warm palette (off-white, warm grey, yellow) with cool control surfaces. Decide which you want; most of the "dark blue" reads as a leftover from an earlier theme.

### How the palette is spent

- **Yellow is the only action colour.** Primary buttons, the Claim button, the connected wallet button, the hero headline's second line, focus borders and every hairline (at 14%).
- **The tinted pill triple** marks status and choice: a 8–10% fill, an 18–22% edge, and full-strength text in the same hue.

  | Element | Hue |
  |---|---|
  | `LIVE` / `DEADLINE PASSED` badge, YES button, Resolve button | yellow |
  | NO button | red |
  | `RESOLVED · YES/NO` badge | blue |

- **Muted grey carries everything secondary:** subtitles, card IDs, meta labels, timers, notes, empty states.

### Measured contrast

| Pair | Ratio |
|---|---|
| `--text` on `--bg` | 18.64 |
| `--muted` on `--bg` | 7.14 |
| `--muted` on a card | 6.75 |
| `--muted` on the modal | 6.64 |
| `--muted` inside the hero glow | 5.78 |
| yellow on `--bg` | 13.99 |
| `#080808` on yellow (primary button) | 13.99 |
| yellow on YES fill | 10.84 |
| red on NO fill | 5.88 |
| blue on resolved badge | 7.39 |
| `--text` on `#151c27` controls | 15.92 |
| input focus border vs input | 4.01 |
| `--border` hairline vs `--bg` | 1.30 |

Every text pairing clears AA comfortably. The 14% hairline is decorative (1.30:1); cards don't depend on it to be seen because they also have a fill and a shadow.

---

## 3. Typography

One family, set heavy.

```css
font-family: Inter, system-ui, -apple-system, Segoe UI, sans-serif;
```

**Inter isn't loaded** (no `<link>`, no `@font-face`). On a machine without Inter installed the whole page renders in the platform UI font. Either load Inter (or another heavy grotesque) or remove it from the stack so the intent is honest.

### Scale in use

| Role | Spec |
|---|---|
| Hero h2 | `clamp(38px, 6vw, 66px)` / 0.94, tracking -0.07em; second line `<span>` in yellow |
| Brand h1 | 20px, tracking -0.04em |
| Modal h3 | 24px |
| Card question | 22px / 1.25, tracking -0.025em |
| Sentence builder | 18px / 1.8 (16px ≤560px) |
| Body / hero p | 16px / 1.6, `--muted`, max 650px |
| Buttons | weight **850** |
| Wallet button | weight 800 |
| Modal p | 13px / 1.5 |
| Toast, meta value, timer, label | 12–13px |
| Card ID | 11px, 800, uppercase, tracking 0.1em |
| Note | 11px |
| Meta label, badge | 10px; badge 900 |
| Preview label | 9px, tracking 0.1em |

The type personality comes from three things: very tight negative tracking on large sizes (-0.07em on the hero), very heavy weights on small UI (800–900), and uppercase tracked micro-labels ("POOL", "DEADLINE", "RESULT", "MARKET PREVIEW"). Weights of 850 and 900 only render distinctly with a variable font; with a system fallback they collapse to the nearest available bold.

---

## 4. Surface grammar

- **Generous radii, in two sizes.** 22px for big containers (cards, modal, empty state), 11–16px for everything inside (buttons 11px, inputs 11px, meta tiles 12px, logo 13px, toast 14px, sentence builder 16px). Badges are full pills (`99px`).
- **Card:**
  ```css
  .card {
    background: linear-gradient(180deg, rgba(255,255,255,.035), rgba(255,255,255,.015));
    border: 1px solid var(--border);
    border-radius: 22px;
    padding: 22px;
    box-shadow: 0 22px 65px rgba(0,0,0,.3);
  }
  ```
  A barely-there white sheen fading downward, the yellow hairline, and a deep soft shadow.
- **Meta tiles** inside the card: three cells, each `rgba(255,255,255,.02)` fill, 5% white edge, 12px radius, a 10px muted label over a 12px bold value.
- **Divider row:** `border-top: 1px solid rgba(255,255,255,.06)` above the note and Claim button.
- **Buttons:**

  | Class | Look |
  |---|---|
  | `.primary`, `.claim` | solid yellow, `#080808` text, weight 850 |
  | `.ghost` | navy `#151c27`, `--text`, yellow hairline |
  | `.wallet` | ghost style; `.wallet.connected` turns solid yellow and shows the short address |
  | `.yes` / `.no` / `.resolve` | tinted pill triple (§2) |
  | `.close` | bare `×` at 25px, muted |

  All 11px radius, `12px 16px` padding. Hover on solid buttons: `translateY(-1px)` and `brightness(1.04)`. Disabled: 35% opacity, no lift.
- **Inputs:** `#090d13` fill, yellow hairline, 11px radius, `outline: none`, focus turns the border to 50% yellow.
- **Logo:** a 40px rounded square (13px radius) with a yellow → pale-yellow diagonal gradient and a black "V" at weight 900.
- **Empty state:** a dashed yellow-hairline box, 22px radius, 70px vertical padding, centred muted text.
- **Modal:** `#0e131b`, yellow hairline, 22px radius, `0 40px 100px rgba(0,0,0,.6)` shadow, over a 70% black scrim with 9px blur.
- **Toast:** fixed bottom-right, `min(390px, 100% - 40px)`, `#131b26`, yellow hairline, 14px radius, auto-hides after 4.5s.

---

## 5. Layout

```css
.app { width: min(1180px, calc(100% - 32px)); margin: auto; padding: 24px 0 70px; }
```

One centred 1180px column, no side frame. Inside it, top to bottom: header, hero, toolbar, markets grid. Modals and toast are fixed overlays outside `.app`.

- **Header:** flex, brand left, wallet button right, 42px space below.
- **Hero:** flex, copy left, "＋ Create Market" right, aligned to the baseline (`align-items: end`).
- **Toolbar:** "Markets" h3 + summary line left, Refresh right.
- **Markets grid:** `repeat(2, minmax(0,1fr))`, 18px gap.

### Breakpoints

| Width | Change |
|---|---|
| ≤850 | grid → 1 column; hero stacks and its button goes full width |
| ≤560 | page gutter 11px; bet row → 2 columns with the amount input spanning both; meta tiles → 2 columns; modal field pairs → 1 column; sentence builder text 16px |

---

## 6. Page blueprints

### 6.1 Landing page (live `/`, structure and copy only)

Source isn't in the repo (§0). Below is the rendered content in order, with what each section does and what to replace. Where I suggest a rendering, it uses the repo's tokens.

```
Header         logo image + "Veynt"
1  Hero        "Predict✱what happens next" + one-line description
2  Markets     "Prediction Markets" + "LIVE MARKETS" stat panel (24+, three sample markets with %)
3  Pillars     "Prediction markets↗built differently." + 3 numbered features + CTA → /app
4  Flow        "The Veynt Flow" — 4 numbered steps
5  Under the hood  Privacy panel (PUBLIC vs PRIVATE) + Resolution panel (FDC | DATA | ROOT)
6  Principle   one-line statement + CTA → /app
7  Payout      "Payout Model" — 86 / 10 / 3 / 1 split + worked example
Footer         logo, tagline, Home · App · GitHub, "Built on BOT Chain", ©
```

**Header.** A logo image (`/logo.png`, served at 64px) linking home, with the word "Veynt". No nav links or wallet button on the landing header. *Suggested render:* the repo's `.brand` row.

**1. Hero.** Headline **"Predict✱what happens next"**, where `✱` sits between the two phrases as a glyph or icon. Subline: "Veynt is a decentralized prediction market where you can trade on real-world outcomes using crypto." No CTA button in the hero text. *Suggested render:* the repo's hero type (`clamp(38px,6vw,66px)`, -0.07em, line-height .94) with the glyph in yellow.
**Replace:** headline, glyph, subline.

**2. Prediction Markets.** Heading "Prediction Markets", line "Discover markets, take positions, and let the outcome determine your payout.", then a **LIVE MARKETS** panel: a big "24+" with "Active prediction markets", and three sample rows each with a market name and a percentage ("BTC above $100K 68%", "ETH above $5K 42%", "BTC ETF inflows 81%"). These figures are illustrative, not read from the chain. *Suggested render:* a `.card` with a yellow `.badge`-style "LIVE MARKETS" label, a large number, and rows with a percentage bar.
**Replace:** the count and sample markets. Use live data or label them as examples.

**3. Pillars.** Heading **"Prediction markets↗built differently."** (another inline glyph), tagline "Veynt keeps your prediction private while keeping settlement transparent and verifiable.", then three numbered items:

| # | Title | Body |
|---|---|---|
| 01 | Private Predictions | Your YES or NO choice stays encrypted until the market is resolved. |
| 02 | Verifiable Settlement | External data comes from FDC while BOT Chain handles the final settlement. |
| 03 | Fair Payouts | Winning bettors receive proportional payouts based on their share of the pool. |

CTA: **"Explore Veynt→"** linking to `/app`.
**Replace:** heading, tagline, three pillars, CTA label and target.

**4. Flow.** "The Veynt Flow" / "From prediction to payout." Four numbered steps:

| # | Title | Body |
|---|---|---|
| 01 | Create a Market | Set the asset, direction, target price, and duration. Creating a market costs a fixed 1 BOT fee. |
| 02 | Make Your Prediction | Choose YES or NO and stake your BOT. Your prediction is encrypted in the browser before being submitted on-chain. |
| 03 | Market Resolution | After the deadline, the evaluator uses FDC data to determine the outcome and publishes a verifiable settlement. |
| 04 | Claim Your Payout | If you win, your payout is verified with a Merkle proof and can be claimed directly from the market. |

**Replace:** the four steps with your product's lifecycle. Keep 3–5.

**5. Under the hood.** "Under the Hood" / "Private by default. Verifiable by design." Two panels:

- **Privacy:** "Your position stays hidden." A visual contrasting **PUBLIC — Wallet + Stake** with **PRIVATE — YES / NO** and a 🔒. Body: "Hide the decision, not the transaction. Your wallet address, stake, market and transaction remain visible on-chain. What stays confidential is whether you selected YES or NO until the market resolves."
- **Resolution:** "The outcome can be verified." A ✓ and a three-stage strip **FDC | DATA | ROOT**. Body: "From external data to on-chain settlement. FDC provides the external price data. The evaluator determines the outcome and builds the payout Merkle tree. The resulting outcome and root are then submitted to VeyntMarket for verifiable settlement."

This is the section that explains the product's actual mechanism, and it's the one most worth keeping as a pattern: one panel for "what's hidden vs visible", one for "how the result is proven".
**Replace:** both panels' headings, visuals and bodies.

**6. Principle.** One statement, "Hide the decision. Keep the settlement verifiable.", and a second **"Explore Veynt →"** CTA to `/app`.
**Replace:** the statement (your one-line thesis) and CTA.

**7. Payout model.** "Payout Model" / "The pool is shared by design." / "Veynt uses a parimutuel payout model. Winners share the distributable pool proportionally to their stake." Four allocation rows:

| Recipient | Share | Note |
|---|---|---|
| Winning Bettors | **86%** ("Largest Share") | split proportionally by stake on the winning side |
| Market Creator | 10% | reward for creating the market |
| Veynt Treasury | 3% | platform share |
| Resolver | 1% | resolution submitter |

Then an **Example**: "15 BOT total pool. After the 14% total allocation to creator, platform, and resolver, 12.90 BOT is distributed to the winning bettors." Winner A 10.32 BOT, Winner B 2.58 BOT. (The arithmetic holds: 15 × 0.86 = 12.90, split 80/20.)
**Replace:** the split, recipients and example. If your product has no fee split, replace this section with pricing or remove it. Make sure these numbers match what your contract actually does.

**Footer.** Logo (96px), "Keep the prediction private. Keep the settlement verifiable.", "A confidential prediction market built on BOT Chain.", links **Home** (`/`) · **App** (`/app`) · **GitHub** (repo), "Built on BOT Chain", "© 2026 Veynt". In the rendered text the copyright runs straight into the principle line ("© 2026 VeyntHide the decision…"), which suggests two inline elements with no space between them; check this when you rebuild.
**Replace:** logo, tagline, description, links, chain line, copyright.

### 6.2 The app (repo `index.html`, verified)

```
.app
  header        logo "V" tile · "Veynt" / "Prediction markets · BOT Chain Testnet" · Connect Wallet
  .hero         "Predict what happens." / "Prove what happened." (yellow) + paragraph · ＋ Create Market
  .toolbar      "Markets" + summary line · Refresh
  main.markets  2-column grid of cards (or empty state)
#createModal    sentence builder + preview
#resolveModal   GitHub token field
#toast
```

**Header.** 40px gradient logo tile with "V"; "Veynt" (20px) over "Prediction markets · BOT Chain Testnet" (12px muted); the wallet button reads "Connect Wallet", then the short address (`0x1234…abcd`) on a solid yellow fill once connected.

**Hero.** h2 **"Predict what happens."** / **"Prove what happened."** (second line yellow). Paragraph: "Create a market, make your prediction, and let the Veynt TEE verify the outcome. Winners can claim their BOT payout after resolution." Button "＋ Create Market" (the plus is the full-width "＋" character).

**Toolbar.** "Markets" with a summary line that changes: "Connect your wallet to interact." → "Connected · 0x1234…abcd". Ghost "Refresh" button.

**Empty states** (dashed box): "Connect your wallet to load markets." before connecting; "No markets yet. Create the first one." when the contract has none.

**Market card: three states.** Every card has the same top: "MARKET #N" (11px tracked uppercase) on the left, a status badge on the right, the question in 22px, then three meta tiles **POOL** (`x BOT`), **DEADLINE** (local date/time), **RESULT**.

| State | Badge | RESULT | Below the meta |
|---|---|---|---|
| Open | yellow `LIVE` | Pending | countdown ("4m 12s remaining", ticking every second) · bet row: amount input + **YES** + **NO** · note "Prediction is open." |
| Deadline passed | yellow `DEADLINE PASSED` | Pending | "Deadline passed" · bet row (still shown) · note "Market deadline passed." · **Resolve Market** button |
| Resolved | blue `RESOLVED · YES` / `NO` | YES / NO | "Market resolved." · divider row: "Winning side: **YES**" + yellow **Claim Winnings** |

The question is stored on-chain as `ASSET|DIRECTION|PRICE×1e8` and rendered as "Will the price of BTC be above $65,000?". Cards render newest first.

**Create modal.** "Create a market" / "Set the asset, direction, target price and how long the market stays open. Market creation costs 1 BOT." Then the **sentence builder**, a single sentence with inline controls:

> Will the price of `[BTC ▾]` be `[above ▾]` than `[$ 65000]` after `[5] minutes` ?

Assets: BTC, ETH, SOL, BNB, XRP, ADA, AVAX, LINK, DOGE, each prefilling a default price. Below it a **MARKET PREVIEW** box (4.5% yellow fill, 12% yellow edge) repeats the sentence in plain text and updates as you type. Cancel (ghost) / Create Market (primary).

The sentence builder is the best piece of UI in the repo: the form reads as the question it produces, so there's nothing to interpret. Note the grammar: "be above **than**" should be "be above" (or "higher than").

**Resolve modal.** "Resolve market" / "Enter a GitHub Personal Access Token with permission to trigger the Veynt evaluator workflow." A password field labelled "GitHub Personal Access Token" (placeholder `github_pat_…`), a note that the token isn't saved, Cancel / Start Resolution (label becomes "Starting…" while it runs). See §9 before copying this.

**Toast** messages: "Wallet connected.", "Market created successfully — 1 BOT creation fee paid.", "Prediction YES placed.", "GitHub evaluator started for Market #N.", "Please install MetaMask.", and "<Action> failed: <reason>" for errors.

### 6.3 Interactions (app)

- Connect → ensure chain 968 (adds it to MetaMask if missing) → load markets → toast.
- YES/NO → encrypt the choice with the embedded RSA public key → send the stake.
- Countdown timers refresh every second on open cards.
- Modals open with a class toggle and close via ×, Cancel, or a click on the scrim. No Escape key.
- Account or chain change in the wallet reloads the page.

### 6.4 Redesigned app (live `/app`, structure and copy only)

The deployed app differs from the repo:

- **Header:** logo image + nav links **Home · App · GitHub**; no Connect Wallet button visible on load.
- **Hero:** "Predict what happens. Keep it private." / "Create markets, make encrypted predictions, and settle outcomes on BOT Chain."
- **Create section** (inline, not just a button): "Start a market" / "Define an asset, target price and duration. Market creation costs 1 BOT." + Create Market.
- **Markets section:** "Explore markets." with a status line ("Refreshing...") and a refresh control.
- **Network empty state:** "Unsupported network. Switch to BOT Mainnet or Bohr Testnet to explore markets."
- **Footer:** logo, "Keep the prediction private. Keep the settlement verifiable.", "© 2026 Veynt".

If you're cloning the *live* experience, use this section order with the card and modal designs from §6.2.

---

## 7. Replace map

| What | Where | Veynt value | Replace with |
|---|---|---|---|
| Name | `<title>`, header, toasts, landing, footer | "Veynt" | your name |
| Page title | `index.html` | "Veynt — Prediction Markets on BOT" (live: "Veynt — Private Prediction Markets") | yours |
| Logo | `.logo` tile ("V" on yellow gradient); live `/logo.png` | V mark | your mark |
| Accent | `--yellow`, `--border`, the two glows, `#fff1a3`, all `rgba(255,212,0,…)` | `#ffd400` | your accent (recompute the 8/10/14/18/22% tints) |
| Subtitle | header `p` | "Prediction markets · BOT Chain Testnet" | yours |
| App hero | `.hero` | "Predict what happens. / Prove what happened." + paragraph | yours |
| Landing hero | live `/` | "Predict✱what happens next" | yours |
| Landing stats | live `/` LIVE MARKETS | "24+", BTC $100K 68%, ETH $5K 42%, BTC ETF 81% | live data, or label as examples |
| Pillars | live `/` | Private Predictions / Verifiable Settlement / Fair Payouts | your three |
| Flow | live `/` | Create / Predict / Resolve / Claim | your lifecycle |
| Under the hood | live `/` | PUBLIC vs PRIVATE; FDC → DATA → ROOT | your mechanism |
| Principle | live `/`, footer, README | "Hide the decision. Keep the settlement verifiable." | your thesis |
| Payout model | live `/` | 86 / 10 / 3 / 1, 15 BOT example | your economics, matching the contract |
| Creation fee | create modal text, toast, landing | 1 BOT | your fee |
| Assets | `ASSET_CONFIG` | BTC … DOGE with default prices | your list |
| Question format | `questionText()`, sentence builder | "Will the price of X be above $Y after N minutes?" | your question template |
| Chain | `defineChain` | BOT Chain Testnet, id 968, `rpc.bohr.life`, `scan.bohr.life` | your chain |
| Contract | `CONTRACT_ADDRESS` | `0x392B82F53b61f253a13B5aE403a000932d9485db` | your deployment |
| ABI | `ABI` | VeyntMarket | yours |
| Encryption key | `PREDICTION_PUBLIC_KEY` | embedded RSA public key | your key (never the private one) |
| Resolution trigger | `triggerResolution()` | GitHub `workflow_dispatch` on `Pandey456/VEYNT` / `fdc-full-run.yml` | your resolver (see §9) |
| Wallet | `connectWallet()` | MetaMask only | your wallet flow |
| Footer | live site | Home · App · GitHub, "Built on BOT Chain", © 2026 Veynt | yours |
| Site verification | `<meta name="google-site-verification">` | Veynt's token | **remove**; it's tied to their Search Console |

---

## 8. Motion

Minimal:

- Buttons: `transition: .2s`; solid buttons lift 1px and brighten 4% on hover.
- Countdown text updates every second.
- Toast appears and disappears with a display toggle (no animation), 4.5s.
- Modals open instantly (display toggle) with a blurred scrim.

There's no `prefers-reduced-motion` handling, but there's almost nothing to reduce.

---

## 9. Accessibility and known issues

The colour contrast is good throughout (§2). The issues are mostly structural, plus one security pattern.

| Issue | Detail | Fix |
|---|---|---|
| **GitHub token entered in the browser** | Resolving a market asks the user to paste a GitHub PAT, which the page sends straight to the GitHub API to dispatch a workflow. It isn't stored, but any user is being asked for a credential with write access to a repo | Don't copy this. Trigger resolution from a backend, a keeper, or an on-chain call; never ask end users for a repo token |
| Inter not loaded | named first in the stack, never fetched | load it, or drop it from the stack |
| Modals aren't dialogs | no `role="dialog"`, `aria-modal` or label; focus isn't moved in or trapped; no Escape to close | add the roles, focus the first field, trap Tab, close on Escape, restore focus |
| Close button unlabeled | a bare `×` | `aria-label="Close"` |
| Toast isn't announced | no `aria-live` | `role="status" aria-live="polite"` |
| Amount input has no label | placeholder "Amount in BOT" only | add a visually hidden label |
| Sentence-builder controls unlabeled | the selects and inputs rely on the surrounding words | `aria-label` each ("Asset", "Direction", "Target price", "Minutes") |
| Inputs remove the outline | `outline: none`, replaced by a 50%-yellow border (4.01:1) | acceptable; thicken to 2px or add a ring for clarity |
| Expired cards still show the bet row | the YES/NO row renders after the deadline and `predict()` has no deadline check, so the user only learns from a failed transaction | hide or disable it on `DEADLINE PASSED` |
| "above than" | sentence builder reads "be above than $…" | "be above $…" / "be higher than $…" |
| Unused tokens | `--panel`, `--panel2`, `--green`, `--black` | remove or use |
| Two yellows, two blues | `#ffd400` vs `rgba(245,196,81)`; `#8fa7ff` vs `rgba(112,167,255)` | one of each |
| Navy controls on a black page | `#151c27`, `#0e131b`, `#090d13`, `#131b26` off-token | tokenise, and decide warm or cool |
| Sequential market loading | one RPC call per market id in a loop | batch, or index off-chain |
| Chain naming | app says "BOT Chain Testnet"; live empty state says "BOT Mainnet or Bohr Testnet" | one naming scheme |
| Duplicate files | `index-dev.html` identical; `backup-index/` | delete |

Good things to keep: `escapeHtml` on every user-supplied string before `innerHTML`; the private key never touches the client; disabled buttons that don't lift; full-width primary button on narrow screens.

---

## 10. Copy voice

- **Paired imperative lines:** "Predict what happens. / Prove what happened.", "Hide the decision. Keep the settlement verifiable.", "Private by default. Verifiable by design."
- **Honest about what's private:** "Hide the decision, not the transaction." The landing spells out what stays public.
- **Numbered everything:** 01–03 pillars, 01–04 flow.
- **Plain system messages:** "Prediction is open.", "Market deadline passed.", "Market resolved.", "Winning side: YES".
- **Uppercase micro-labels:** POOL, DEADLINE, RESULT, LIVE, MARKET PREVIEW.
- **Fees stated up front:** "Market creation costs 1 BOT."

---

## 11. Build checklist for an agent

1. Decide which surface you're cloning: the repo app (§6.2, exact), the live landing (§6.1, structure), or the live app (§6.4, structure). Most products want landing + app.
2. Tokens: `--bg`, `--text`, `--muted`, `--border` (accent at 14%), `--yellow` (your accent), `--red`, `--blue`, plus the promoted control/input/modal/toast tokens from §2. Delete unused ones.
3. Background: your ground plus two accent radial glows at the top corners (12% and 7%).
4. Load a heavy sans that actually has 800–900 weights; set large headings at -0.04 to -0.07em.
5. Card recipe: faint top-down white sheen, accent hairline, 22px radius, deep soft shadow; 12px-radius meta tiles inside.
6. Buttons: solid accent primary with lift on hover; navy (or neutral) ghost; tinted pill triple for choices and status.
7. Build the card in all its states (open, deadline passed, resolved), not just the open one.
8. Build creation as a sentence builder with a live preview.
9. Landing: hero → live stats → pillars → flow → mechanism panels → principle → economics → footer, every number either live or labelled as an example.
10. Modals: dialog roles, focus management, Escape; toast with `aria-live`.
11. Never ask users for an API or repo token to trigger backend work.
12. Remove Veynt's site-verification meta tag.

---

## 12. What to keep, what to change

| Keep | Change |
|---|---|
| One saturated accent for every action | The yellow |
| Accent-tinted hairlines on dark cards | Tint strength |
| Tinted pill triple for choices and status | Hues per state |
| Sentence-builder form with live preview | The sentence |
| Three explicit card states with their own actions | The states, to match your lifecycle |
| Landing's "what's public vs private" and "how it's proven" panels | Their content |
| Worked payout example with real arithmetic | The numbers, to match your contract |
| Contrast levels | — they're good |
| Navy control surfaces on a black ground | **Pick one temperature** |
| Resolution via user-supplied GitHub token | **Replace entirely** (§9) |

**The idea to think hardest about:** the visual layer here is a familiar crypto-dashboard look (black, one neon accent, rounded translucent cards, heavy tight type), and on its own it won't distinguish a product. What's genuinely Veynt is the explanation: the sentence builder that makes the market legible, and the landing's two "under the hood" panels that say plainly what is hidden, what is public, and how the result is proven. If you reuse this, put your effort into the equivalent panels for your product's mechanism, and treat the palette as a starting point rather than the identity.
