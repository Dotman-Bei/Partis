import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Inter } from "next/font/google";
import { Providers } from "@/components/Providers";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import "./globals.css";

// §3/§9: the system names Inter but never loads it. Load the variable font so the 800–900
// weights actually render distinctly.
const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

export const metadata: Metadata = {
  title: "Partis — On-chain event passes on BOT Chain",
  description:
    "Partis turns real-world event access into on-chain passes that can be verified at the door.",
};

export const viewport: Viewport = {
  themeColor: "#080808",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body>
        <Providers>
          <div className="app">
            <Header />
            <main id="main">{children}</main>
            <Footer />
          </div>
        </Providers>
      </body>
    </html>
  );
}
