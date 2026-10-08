import Link from "next/link";
import { LiveStats } from "@/components/LiveStats";

const PILLARS = [
  {
    title: "Owned by attendees",
    body: "Every pass is a token in the attendee's wallet. Ownership is read from BOT Chain, not from a ticket database.",
  },
  {
    title: "Verified at the door",
    body: "Staff scan a QR and Partis checks the pass against current chain state: right event, real holder, not yet used.",
  },
  {
    title: "Single use, on-chain",
    body: "Check-in is a transaction. A used pass is rejected everywhere, and it can no longer be transferred away.",
  },
];

const FLOW = [
  {
    title: "Create an event",
    body: "Set the name, venue, time, pass supply and price — free or a fixed price in BOT. The event gets an on-chain ID and a shareable page.",
  },
  {
    title: "Claim a pass",
    body: "Attendees connect a wallet and claim or buy a pass. The contract enforces supply, price and the sales window, then issues the pass to their wallet.",
  },
  {
    title: "Present the QR",
    body: "At the venue the attendee opens their pass and signs a short-lived entry QR with their wallet. Signing is free and sends no transaction.",
  },
  {
    title: "Check in on-chain",
    body: "Authorized staff scan, see the live verdict from BOT Chain, and confirm. The pass is marked used on-chain and a second scan fails.",
  },
];

export default function Home() {
  return (
    <>
      {/* 1 — Hero */}
      <section className="hero">
        <div>
          <h2>
            Own the pass.
            <span className="glyph" aria-hidden="true">
              ✱
            </span>
            <br />
            <span>Prove you were there.</span>
          </h2>
          <p>
            Partis turns real-world event access into on-chain passes that can be verified at the door. Built on
            BOT Chain for meetups, hackathons, workshops and community events.
          </p>
        </div>
        <div className="hero-actions">
          <Link className="btn primary" href="/events">
            Explore events
          </Link>
          <Link className="btn ghost" href="/organizer">
            ＋ Create event
          </Link>
        </div>
      </section>

      {/* 2 — Live */}
      <section className="section" style={{ marginTop: 0 }} aria-labelledby="live-heading">
        <div className="section-head">
          <span className="micro">Live</span>
          <h2 id="live-heading">Events on Partis</h2>
          <p>Find an event, claim a pass, and walk in with it. These numbers come straight from the contract.</p>
        </div>
        <LiveStats />
      </section>

      {/* 3 — Pillars */}
      <section className="section" aria-labelledby="pillars-heading">
        <div className="section-head">
          <span className="micro">Why Partis</span>
          <h2 id="pillars-heading">
            Event access
            <span className="glyph" aria-hidden="true">
              ↗
            </span>
            verified differently.
          </h2>
          <p>
            The important part of access lives on BOT Chain: who owns a pass, whether it belongs to the event, and
            whether it has been used.
          </p>
        </div>
        <div className="grid three">
          {PILLARS.map((p, i) => (
            <div key={p.title} className="card feature">
              <span className="numbered">0{i + 1}</span>
              <h3>{p.title}</h3>
              <p>{p.body}</p>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 22 }}>
          <Link className="btn primary" href="/events">
            Explore Partis →
          </Link>
        </div>
      </section>

      {/* 4 — Flow */}
      <section className="section" aria-labelledby="flow-heading">
        <div className="section-head">
          <span className="micro">The Partis Flow</span>
          <h2 id="flow-heading">From event to attendance.</h2>
        </div>
        <div className="grid">
          {FLOW.map((s, i) => (
            <div key={s.title} className="card feature">
              <span className="numbered">0{i + 1}</span>
              <h3>{s.title}</h3>
              <p>{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 5 — Under the hood */}
      <section className="section" aria-labelledby="hood-heading">
        <div className="section-head">
          <span className="micro">Under the Hood</span>
          <h2 id="hood-heading">Public where it counts. Personal data stays off-chain.</h2>
        </div>
        <div className="grid">
          <div className="card feature">
            <h3>What lives on-chain.</h3>
            <div className="split">
              <div className="on">
                <span className="micro accent">Public — on BOT Chain</span>
                <ul>
                  <li>Event & pass IDs</li>
                  <li>Holder wallet</li>
                  <li>Supply & price</li>
                  <li>Check-in state</li>
                </ul>
              </div>
              <div>
                <span className="micro">Never stored 🔒</span>
                <ul>
                  <li>Names</li>
                  <li>Emails</li>
                  <li>Phone numbers</li>
                  <li>Any attendee profile</li>
                </ul>
              </div>
            </div>
            <p>
              Verify the access, not the person. A pass needs only a wallet. Everything that decides whether you get
              in is public and checkable; nothing personal is written to the chain.
            </p>
          </div>

          <div className="card feature">
            <h3>How a pass is proven at the door.</h3>
            <div className="strip" aria-label="QR, then chain, then check-in">
              <span>QR</span>
              <span className="arrow" aria-hidden="true">
                →
              </span>
              <span>CHAIN</span>
              <span className="arrow" aria-hidden="true">
                →
              </span>
              <span>CHECK-IN</span>
            </div>
            <p>
              The QR carries only an event ID, a pass ID and a short-lived signature from the holder&apos;s wallet. It
              is not proof on its own: the scanner reads the pass from BOT Chain, confirms it belongs to this event,
              is held by the signer and is unused. The check-in is then a transaction from authorized staff, so a used
              pass reads as used everywhere.
            </p>
          </div>
        </div>
      </section>

      {/* 6 — Principle */}
      <section className="section principle">
        <h2>
          Own the pass.
          <br />
          <span className="accent">Verify at the door.</span>
        </h2>
        <Link className="btn primary" href="/events">
          Explore Partis →
        </Link>
      </section>

      {/* 7 — Pricing model (matches PartisEventPass exactly) */}
      <section className="section" style={{ marginTop: 40 }} aria-labelledby="pricing-heading">
        <div className="section-head">
          <span className="micro">Pricing Model</span>
          <h2 id="pricing-heading">Organizers keep what they sell.</h2>
          <p>
            Partis takes no fee and has no token. Paid passes are held by the contract until the event ends, then
            the organizer withdraws. If the event is cancelled first, every holder can refund their pass.
          </p>
        </div>
        <div className="grid">
          <div className="card">
            <div className="alloc">
              <div className="alloc-row lead">
                <strong>Organizer</strong>
                <b>100%</b>
                <small>Entire pass revenue, withdrawable after the event ends</small>
              </div>
              <div className="alloc-row">
                <strong>Partis platform fee</strong>
                <b>0%</b>
                <small>No protocol fee, no admin, no token</small>
              </div>
              <div className="alloc-row">
                <strong>Refund if cancelled</strong>
                <b>100%</b>
                <small>Each holder reclaims exactly what they paid</small>
              </div>
            </div>
          </div>
          <div className="card example">
            <span className="micro">Example</span>
            <p style={{ marginTop: 8 }}>A workshop sells 40 passes at 2.5 BOT.</p>
            <dl>
              <dt>Held by the contract</dt>
              <dd>40 × 2.5 = 100 BOT</dd>
              <dt>Organizer withdraws after the event</dt>
              <dd>100 BOT</dd>
              <dt>Partis fee</dt>
              <dd>0 BOT</dd>
              <dt>If cancelled before it starts, each holder gets back</dt>
              <dd>2.5 BOT</dd>
            </dl>
            <p className="note" style={{ marginTop: 14 }}>
              Free events work the same way with a price of 0. Gas is paid in BOT.
            </p>
          </div>
        </div>
      </section>
    </>
  );
}
