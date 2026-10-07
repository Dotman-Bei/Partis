# PRD.md — Partis

## 1. Product Overview

**Product Name:** Partis  
**Category:** Social  
**Target Chain:** BOT Chain  
**Product Type:** On-chain event access and attendance platform

### Core Idea

Partis turns real-world event tickets into on-chain passes that live in the attendee's wallet and can be verified against BOT Chain at the event entrance.

The MVP proves one clear loop:

```text
Organizer creates event
        ↓
Event publishes passes
        ↓
Attendee claims/buys pass
        ↓
Pass is issued on-chain
        ↓
Attendee presents QR at venue
        ↓
Organizer verifies pass against BOT Chain
        ↓
Pass is checked in on-chain
```

The pass is an access credential, not merely a collectible.

---

## 2. Problem

Event organizers often rely on centralized ticket databases, screenshots, manually checked tickets, or QR codes whose authoritative state lives off-chain.

Partis makes the important part of the access lifecycle verifiable on-chain:

- who owns a pass
- whether the pass is valid
- whether it belongs to the event
- whether it has already been used
- whether the attendee has checked in

Initial use cases:

- Web3 meetups
- Hackathons
- Builder events
- Conferences
- Community gatherings
- Workshops
- University/community events

---

## 3. Incubation Strategy

The project must follow the BOT Chain Builder/BOT Labs incubation requirements: prioritize deployed product, working demo, real users, ecosystem fit, measurable usage, credible milestones, and community contribution. fileciteturn0file0L10-L10 fileciteturn0file0L56-L69

### 3.1 Real product

The final project should have:

- deployed smart contracts
- verified contracts
- working frontend
- working end-to-end event/pass/check-in flow
- public repository and real commit history
- complete README
- 2–4 minute demo video
- testnet validation
- mainnet deployment or a credible executable mainnet plan

### 3.2 BOT Chain must be load-bearing

Do not build a centralized event-ticketing application and merely connect a wallet.

The blockchain must be authoritative for:

- event/pass identifiers
- pass issuance
- ownership
- supply
- check-in state
- privileged verification/check-in actions

This follows the incubation guidance that the blockchain component must be load-bearing rather than an AI/web wrapper with a token added afterwards. fileciteturn0file0L62-L69 fileciteturn0file0L84-L88

### 3.3 BOT-native positioning

Position Partis as a Social product that uses BOT Chain for fast, inexpensive on-chain verification and frequent community interactions.

Core positioning:

> **Partis turns real-world event access into on-chain passes that can be verified at the door.**

### 3.4 No unnecessary project token

Partis does not need its own token for MVP.

The pass itself may be an NFT/unique on-chain token. Do not add a speculative token merely to make the project look more Web3-native. fileciteturn0file0L62-L69

### 3.5 Usage evidence

Track:

- organizers
- attendees
- events created
- passes issued
- passes held
- check-ins
- on-chain transactions
- repeat organizers
- repeat attendees

Do not fabricate metrics or users.

### 3.6 Community foundation

Publish build updates, useful documentation/tutorials, BOT Chain developer feedback, and a public build log. Ecosystem participation is part of the incubation signal. fileciteturn0file0L68-L69

---

## 4. Target Users

### Organizer

Creates and manages events, issues passes, and verifies attendees.

### Attendee

Discovers an event, obtains a pass, presents the pass at the venue, and receives an on-chain attendance record.

---

## 5. MVP Scope

Keep the MVP intentionally small.

### Required flow

1. Organizer connects wallet.
2. Organizer creates an event.
3. Event receives an on-chain ID/configuration.
4. Attendee opens the event page.
5. Attendee connects wallet.
6. Attendee claims a free pass or buys a fixed-price pass.
7. Pass is issued to the attendee wallet.
8. Attendee opens their pass and presents QR.
9. Organizer/staff scans QR.
10. System checks the pass against BOT Chain.
11. Authorized organizer/staff confirms check-in.
12. Check-in is recorded on-chain.
13. A second check-in attempt is rejected.

---

## 6. Event Model

Each event should contain at minimum:

- event ID
- organizer wallet
- event name
- description
- venue/location text
- start date/time
- end date/time
- pass/ticket name
- maximum supply
- price
- payment asset if paid
- event status
- pass/token reference
- check-in window
- created timestamp

Do not store unnecessary sensitive personal data on-chain.

---

## 7. Event Creation

MVP event creation is restricted to the connected organizer wallet.

Required inputs:

- event name
- description
- venue
- start time
- end time
- pass supply
- pass price
- claim/purchase mode

Supported MVP modes:

1. Free claim
2. Fixed-price purchase

Do not build auctions, dynamic pricing, resale markets, or complex ticket tiers in MVP.

After creation, the event receives a public shareable page.

---

## 8. Event Pass

Each attendee receives a unique pass represented by an NFT or equivalent unique on-chain token.

The pass must reference:

- event ID
- token/pass ID
- current owner
- issuance status
- used/check-in status

The pass is the attendee's access credential.

---

## 9. Pass Issuance

### Free event

```text
Open event
↓
Connect wallet
↓
Claim pass
↓
Confirm transaction
↓
Pass issued to wallet
```

### Paid event

```text
Open event
↓
Connect wallet
↓
Select purchase
↓
Confirm payment
↓
Pass issued
```

Contracts must enforce:

- maximum supply
- configured price
- supported payment asset
- event open state
- valid claim/purchase window
- any configured one-pass-per-wallet rule

---

## 10. Pass Ownership

BOT Chain state is authoritative for pass ownership.

The application must be able to verify:

- whether a pass exists
- whether it belongs to the event
- current owner
- whether it has been checked in
- whether it is still valid

An indexer/read service may be used for efficient discovery, but it must not replace contract state as the source of truth.

---

## 11. QR Pass

Each attendee pass should have a QR representation.

The QR should contain only minimum identification data, such as:

- event ID
- pass/token ID

The QR itself is not proof of ownership.

When scanned, Partis must validate the pass against current BOT Chain state.

Never put private keys, signing secrets, payment credentials, or unnecessary personal data in the QR.

---

## 12. Entrance Verification and Check-In

The organizer/staff flow:

1. Open check-in.
2. Scan the attendee QR.
3. Read event ID and token ID.
4. Query current BOT Chain state.
5. Verify:
   - event exists
   - token exists
   - token belongs to the event
   - token is owned by a valid attendee wallet
   - token is not already used
   - current time is inside the check-in window
6. Allow authorized organizer/staff to confirm check-in.
7. Submit transaction.
8. Mark pass checked-in on-chain.

A used pass must never be accepted again.

Wrong-event, nonexistent, expired, or already-used passes must fail cleanly.

---

## 13. Organizer and Staff Permissions

The MVP must have clear access control.

Organizer permissions may include:

- create event
- configure event
- manage authorized check-in staff
- open check-in
- cancel event where supported

Check-in staff should only be able to perform the minimum actions required to verify/check in attendees.

Do not expose privileged functions publicly.

---

## 14. Transfer Rules

Keep transfers simple in MVP.

Preferred approach:

- allow normal pass transfers before check-in, or
- disable transfers until a later version.

If transfers are enabled:

- a checked-in pass cannot become reusable after transfer
- used status remains preserved
- verification always checks current ownership and event association

Do not build a ticket resale marketplace in MVP.

---

## 15. Attendee Pass Area

The attendee should be able to see their active and previous passes.

Each pass should expose:

- event
- token/pass ID
- date
- venue
- status
- check-in status
- QR representation

Possible statuses:

- Active
- Checked In
- Event Ended
- Invalid

---

## 16. Organizer Area

The organizer area should support:

- creating events
- viewing created events
- viewing pass supply
- viewing issued passes
- viewing remaining passes
- viewing check-in count
- opening check-in

Do not turn this into a full enterprise event-management suite.

---

## 17. Event Discovery

Users should be able to discover:

- upcoming events
- events with passes available
- events they already have passes for
- recently completed events

Basic filtering is acceptable. Avoid unnecessary recommendation systems in MVP.

---

## 18. Profile

The connected user profile should show a basic participation history:

- wallet
- total passes
- events attended
- active passes
- checked-in passes
- recent events

This is the foundation for a future on-chain social/participation identity layer.

Do not build complex reputation mechanics in MVP.

---

## 19. Standard Pages and Routes

The MVP will have **6 standard pages/routes**:

### 1. Home
**Route:** `/`

Purpose: product explanation, featured/upcoming events, wallet entry point.

### 2. Events
**Route:** `/events`

Purpose: browse events and open event details.

### 3. Event Detail
**Route:** `/events/[eventId]`

Purpose: event information, availability, claim/purchase flow, and attendee pass state.

### 4. My Passes
**Route:** `/passes`

Purpose: list passes owned by the connected wallet, open pass details, show QR and status.

### 5. Organizer
**Route:** `/organizer`

Purpose: create/manage events and see basic pass/check-in statistics.

### 6. Check-In
**Route:** `/check-in`

Purpose: scan QR, validate pass, and execute authorized check-in.

### Route Summary

```text
/                       Home
/events                 Events
/events/[eventId]       Event Detail
/passes                 My Passes
/organizer              Organizer
/check-in               Check-In
```

**Total standard pages: 6**

Wallet connection, transaction confirmations, QR scanning, success states, error states, loading states, and claim/purchase flows should be handled inside these routes rather than creating unnecessary standalone pages.

---

## 20. Frontend Rule

This PRD contains **no visual or design requirements**.

When it is time to build the frontend, the building agent **MUST read and follow `frontend.md` first**.

`frontend.md` is the source of truth for:

- visual design
- layout
- components
- typography
- colors
- styling
- responsive behavior
- interaction patterns
- frontend polish

Do not invent separate design requirements in this PRD.

---

## 21. Smart Contract Architecture

Keep the MVP architecture minimal.

A suggested core contract is an **EventPass** contract responsible for:

- event creation/configuration
- pass issuance
- ownership
- pass supply
- fixed-price payment where supported
- event/pass references
- organizer permissions
- staff permissions
- check-in state

Split contracts only where there is a clear security or maintenance reason.

Avoid unnecessary contract fragmentation.

---

## 22. Metadata

Pass metadata may include:

- event name
- event ID
- token/pass ID
- organizer
- event date
- location
- pass type
- stable media/art reference

Do not store sensitive attendee information on-chain.

---

## 23. Security Requirements

Follow the BOT Chain Builder security baseline: no unbounded loops, checks-effects-interactions, access control, and explicit threat modeling. fileciteturn0file0L75-L79

Critical considerations:

- reentrancy protection where applicable
- access control
- supply validation
- price validation
- event-time validation
- duplicate check-in prevention
- replay prevention
- wrong-event prevention
- unauthorized check-in prevention
- safe payment handling
- safe NFT/pass transfer behavior
- clear failure states

Threat model must address:

1. **Copied QR:** a copied QR must not allow unauthorized or second successful check-in.
2. **Replay:** a used pass cannot be checked in again.
3. **Fake pass:** verification must query authoritative contract state.
4. **Wrong event:** a valid pass for another event must be rejected.
5. **Unauthorized staff:** only authorized accounts can execute privileged check-in actions.
6. **Supply abuse:** contract limits must be enforced on-chain.
7. **Payment abuse:** paid issuance must enforce configured price and asset.
8. **Admin compromise:** privileged roles must be documented and secured.

---

## 24. BOT Chain Configuration

Before deployment, the building agent MUST fetch and verify current BOT Chain configuration from official sources.

Verify at build/deployment time:

- mainnet Chain ID
- RPC
- WebSocket RPC if required
- explorer
- testnet
- testnet RPC
- faucet
- current contract deployment guidance

Never rely on remembered RPC URLs, chain IDs, or contract addresses. This is an explicit BOT Chain Builder rule. fileciteturn0file0L75-L86

---

## 25. Technology Expectations

Use standard EVM tooling.

Suggested stack:

- Solidity
- Foundry or Hardhat
- TypeScript
- React/Next.js or equivalent
- viem/wagmi or equivalent
- QR generation/scanning library
- optional indexing/read service

Equivalent tools are acceptable if they keep the system simple, maintainable, deployable, and BOT-compatible.

---

## 26. Data Architecture

On-chain state is authoritative for:

- pass ownership
- pass validity
- supply
- payment state
- check-in state

An indexed backend/read layer can support:

- event discovery
- event lists
- attendee history
- organizer statistics
- aggregated counts

Do not treat indexed data as the financial/access source of truth.

---

## 27. MVP Non-Goals

Do NOT build these in the first release:

- ticket resale marketplace
- dynamic pricing
- auctions
- multiple chains
- project token
- DAO governance
- complex social feed
- chat
- followers/following
- NFT marketplace
- advanced recommendation engine
- advanced KYC/identity system
- complicated loyalty/reputation system
- AI recommendations
- enterprise ticketing suite

The MVP must prove one thing well:

> **A real event can issue on-chain passes that are owned by attendees and verified at the entrance.**

---

## 28. Future Expansion

### Phase 2 — Participation History

- attendance history
- event badges
- organizer reputation
- community profiles

### Phase 3 — Community Layer

- community membership
- recurring event series
- member roles
- achievements
- portable proof of participation

### Phase 4 — BOT Ecosystem Layer

- BOT ecosystem event directory
- BOT community passport
- ecosystem project integrations
- ecosystem-wide event discovery

### Phase 5 — Access Infrastructure

- API for third-party apps
- white-label verification
- venue check-in integrations
- advanced access policies

Only expand after real MVP usage validates demand.

---

## 29. Metrics

Track at least:

### Organizer

- registered organizers
- active organizers
- events created
- repeat organizers
- average passes/event

### Attendee

- connected wallets
- unique attendees
- passes issued
- repeat attendees

### On-chain

- passes minted
- transactions
- check-ins
- transfers if enabled
- paid ticket volume if enabled
- unique interacting wallets

### Real-world

- events actually held
- physical attendees checked in
- successful check-in rate
- invalid scan attempts
- repeat event participation

These metrics can support future BOT Labs milestone reporting. The incubation criteria specifically emphasize real usage and measurable traction. fileciteturn0file0L62-L69

---

## 30. Milestone Plan

### M1 — Foundation

- repository setup
- contract project
- frontend project
- BOT Chain configuration verification
- wallet connection
- deployment pipeline
- test framework
- documentation foundation

### M2 — Event + Pass Engine

- event creation
- event configuration
- free pass issuance
- fixed-price pass issuance if enabled
- ownership tracking
- supply limits
- contract tests

### M3 — Verification + Check-In

- QR generation
- QR scanning
- on-chain validation
- organizer/staff authorization
- check-in transaction
- used-state enforcement
- duplicate/replay protection
- failure-path tests

### M4 — Frontend Product

- Home
- Events
- Event Detail
- My Passes
- Organizer
- Check-In
- end-to-end wallet interactions

When frontend implementation begins, the building agent MUST read `frontend.md` before making frontend decisions.

### M5 — Testnet + Mainnet

- end-to-end testing
- contract verification
- security review
- testnet events
- real testers
- bug fixes
- mainnet deployment
- production deployment

### M6 — Real Usage

- run real event(s)
- recruit real organizers/attendees
- record on-chain activity
- collect feedback
- publish build content
- document lessons and improvements

The roadmap should remain milestone-driven because BOT Labs support is released against phased milestones. fileciteturn0file0L23-L25

---

## 31. Definition of Done

- [ ] Smart contracts deployed
- [ ] Contracts verified
- [ ] Frontend deployed
- [ ] Wallet connection works
- [ ] Organizer can create an event
- [ ] Event can be published
- [ ] Attendee can open an event
- [ ] Attendee can claim/buy a pass
- [ ] Pass is issued on-chain
- [ ] Ownership is verifiable from BOT Chain
- [ ] Attendee can display QR
- [ ] Organizer/staff can scan QR
- [ ] Pass validity is checked against chain state
- [ ] Valid pass can be checked in
- [ ] Checked-in pass cannot be checked in again
- [ ] Unauthorized check-in is prevented
- [ ] Wrong-event pass is rejected
- [ ] My Passes works
- [ ] Organizer area works
- [ ] Event discovery works
- [ ] Error/failure states are handled
- [ ] Critical contract tests exist
- [ ] README is complete
- [ ] Threat model is documented
- [ ] Demo video is prepared
- [ ] Public repository contains real commit history
- [ ] Testnet testing performed
- [ ] Mainnet deployment exists or has an executable plan
- [ ] Real-user testing performed

---

# 32. Git Commit Rules

Git commits are a required part of the development process.

During the build, commit changes continuously instead of waiting until the entire project is finished.

## Commit Frequency

For a normal build, aim for **50+ meaningful commits** across the development process.

Do NOT create 50 meaningless commits just to reach the number. Every commit should represent a real, completed development step.

Make a commit whenever you complete a logical unit of work, such as:

- Creating a new page
- Creating or modifying a component
- Adding a feature
- Implementing an API endpoint
- Adding database functionality
- Adding authentication logic
- Adding validation
- Adding error handling
- Connecting frontend to backend
- Adding a utility/helper
- Adding a configuration
- Refactoring a specific section
- Fixing a bug
- Improving an existing feature
- Adding tests
- Fixing failing tests
- Improving responsiveness
- Fixing accessibility issues
- Updating documentation
- Completing a route
- Completing a major UI section
- Integrating an external service

## Commit Process

After completing each logical development unit:

1. Check the current changes.
2. Verify that the changes work.
3. Stage only the relevant files.
4. Create a descriptive commit.
5. Continue building from the committed state.

Use conventional commit messages where appropriate:

- `feat: add dashboard`
- `feat: add wallet connection`
- `feat: implement transaction history`
- `fix: resolve wallet connection error`
- `refactor: simplify auth middleware`
- `test: add dashboard tests`
- `style: improve mobile layout`
- `docs: update setup instructions`

## Important Rules

- Do NOT wait until the end of the project to commit everything.
- Do NOT make one giant commit containing the entire project.
- Do NOT create fake changes solely to increase the commit count.
- Do NOT repeatedly modify and commit the same thing without a meaningful reason.
- Keep commits small, focused, and logically separated.
- Before moving to the next major feature, make sure the previous feature has been committed.
- If a task contains several independent steps, commit each completed step separately.
- If you encounter and fix a bug during development, commit the fix separately.
- If you make a meaningful refactor, commit it separately.

## Target

For a substantial project, aim for **50+ meaningful commits by the time the build is complete**, distributed naturally throughout development.

The commit history should clearly show the progression of the project from initial setup → individual features → integrations → fixes → testing → polish → final state.

At the end of the build, run `git log` and verify that the history accurately reflects the development process.

---

# 33. Build Rules for the Coding Agent

1. Read this PRD completely before coding.
2. Read `frontend.md` before starting frontend implementation.
3. Treat `frontend.md` as the only source of truth for visual/frontend requirements.
4. Do not invent or add competing design requirements to this PRD.
5. Verify current BOT Chain infrastructure values from official sources before deployment.
6. Keep the MVP small, real, and functional.
7. Do not add impressive-sounding features without a clear user or incubation reason.
8. Keep blockchain functionality load-bearing.
9. Treat contract state as authoritative for pass ownership and check-in.
10. Test critical access-control and pass-state logic before mainnet.
11. Follow the Git Commit Rules throughout the entire build.
12. Never fake users, events, transactions, check-ins, or metrics.
13. Document assumptions and known limitations.
14. Keep a clear testnet-to-mainnet path.
15. Avoid unnecessary architectural complexity.
16. Before declaring completion, verify every Definition of Done item.
17. Run `git log` at the end and verify the history accurately reflects development.

---

# 34. Final Product Positioning

> **Partis turns real-world event access into on-chain passes that can be verified at the door.**

Core product loop:

**Event → On-chain Pass → Wallet Ownership → QR Presentation → BOT Chain Verification → On-chain Attendance**

Long-term positioning:

> **Partis can become an on-chain participation layer for real-world communities.**
