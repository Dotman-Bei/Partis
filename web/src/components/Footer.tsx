import Link from "next/link";
import { botChainWebsite, explorerUrl, partisAddress, repoUrl, targetChain } from "@/lib/config";
import { LogoTile } from "./Logo";

export function Footer() {
  return (
    <footer className="footer">
      <div>
        <LogoTile large />
        <strong>Own the pass. Verify at the door.</strong>
        <p>On-chain event passes, built on BOT Chain.</p>
      </div>
      <nav className="footer-links" aria-label="Footer">
        <Link href="/">Home</Link>
        <Link href="/events">Events</Link>
        <Link href="/passes">My Passes</Link>
        <Link href="/organizer">Organizer</Link>
        <Link href="/check-in">Check-In</Link>
        {repoUrl && (
          <a href={repoUrl} target="_blank" rel="noreferrer">
            GitHub
          </a>
        )}
        {explorerUrl && partisAddress && (
          <a href={`${explorerUrl}/address/${partisAddress}`} target="_blank" rel="noreferrer">
            Contract ↗
          </a>
        )}
      </nav>
      <div className="footer-chain" aria-label="Built on BOT Chain">
        <span className="micro">Built on</span>
        <strong className="footer-chain-name">BOT Chain</strong>
        <a href={botChainWebsite} target="_blank" rel="noreferrer">
          Official website ↗
        </a>
        {explorerUrl && (
          <a href={explorerUrl} target="_blank" rel="noreferrer">
            BOT Chain Explorer ↗
          </a>
        )}
      </div>
      <div className="footer-meta">
        <span>Running on {targetChain.name}</span>
        <span>© 2026 Partis</span>
      </div>
    </footer>
  );
}
