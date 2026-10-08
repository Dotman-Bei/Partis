"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import { targetChain } from "@/lib/config";
import { LogoTile } from "./Logo";
import { WalletButton } from "./WalletButton";

const NAV = [
  { href: "/events", label: "Events" },
  { href: "/passes", label: "My Passes" },
  { href: "/organizer", label: "Organizer" },
  { href: "/check-in", label: "Check-In" },
];

/** Nav links with the current page marked; reads the URL so it lives inside Suspense. */
function NavLinks({ onNavigate }: { onNavigate: () => void }) {
  const pathname = usePathname();
  // Close the mobile menu after navigating.
  useEffect(() => onNavigate(), [pathname, onNavigate]);
  return NAV.map((item) => {
    const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
    return (
      <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined}>
        {item.label}
      </Link>
    );
  });
}

const staticLinks = NAV.map((item) => (
  <Link key={item.href} href={item.href}>
    {item.label}
  </Link>
));

export function Header() {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);

  return (
    <header className="header">
      <Link href="/" className="brand" aria-label="Partis home">
        <LogoTile />
        <span>
          <h1>Partis</h1>
          <p>Event passes · {targetChain.name}</p>
        </span>
      </Link>

      <nav id="site-nav" className={`nav${open ? " open" : ""}`} aria-label="Main">
        <Suspense fallback={staticLinks}>
          <NavLinks onNavigate={close} />
        </Suspense>
      </nav>

      <div className="header-actions">
        <WalletButton />
        <button
          type="button"
          className="btn ghost menu-toggle"
          aria-expanded={open}
          aria-controls="site-nav"
          onClick={() => setOpen((v) => !v)}
        >
          <span className="visually-hidden">Menu</span>
          <span aria-hidden="true">{open ? "×" : "≡"}</span>
        </button>
      </div>
    </header>
  );
}
