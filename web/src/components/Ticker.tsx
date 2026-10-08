"use client";

import type { ReactNode } from "react";
import { useNow } from "@/hooks/usePartis";

/**
 * Renders time-sensitive text that changes every second (countdowns) on its own clock, so
 * only this text node re-renders each second instead of the whole page around it.
 */
export function Ticker({ children, every = 1000 }: { children: (now: number) => ReactNode; every?: number }) {
  const now = useNow(every);
  return <>{now === 0 ? null : children(now)}</>;
}
