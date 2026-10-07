"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { targetChain } from "@/lib/config";
import { WalletButton } from "./WalletButton";

const NAV = [
  { href: "/events", label: "Events" },
  { href: "/passes", label: "My Passes" },
  { href: "/organizer", label: "Organizer" },
  { href: "/check-in", label: "Check-In" },
];

export function Header() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // Close the mobile menu after navigating.
  useEffect(() => setOpen(false), [pathname]);

  return (
    <header className="header">
      <Link href="/" className="brand" aria-label="Partis home">
        <span className="logo" aria-hidden="true">
          P
        </span>
        <span>
          <h1>Partis</h1>
          <p>Event passes · {targetChain.name}</p>
        </span>
      </Link>

      <nav id="site-nav" className={`nav${open ? " open" : ""}`} aria-label="Main">
        {NAV.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined}>
              {item.label}
            </Link>
          );
        })}
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
