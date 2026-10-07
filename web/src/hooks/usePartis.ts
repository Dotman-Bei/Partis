"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { usePublicClient } from "wagmi";
import type { Address } from "viem";
import { partisAbi } from "@/lib/abi";
import { partisAddress, targetChain } from "@/lib/config";
import type { PartisEvent, PassView } from "@/lib/types";

/**
 * Read layer. Every value comes from PartisEventPass view functions on the target chain —
 * no event-log scanning (eth_getLogs is disabled on the BOT mainnet RPC) and no off-chain
 * database. Pages are bounded by the contract's MAX_PAGE_SIZE.
 */

const PAGE = 100n;

function useClient() {
  return usePublicClient({ chainId: targetChain.id });
}

const contract = () => ({ address: partisAddress!, abi: partisAbi }) as const;

export const isDeployed = partisAddress !== null;

/** A clock that ticks every `ms`, for countdowns and time-based state. */
export function useNow(ms = 1000): number {
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));
  useEffect(() => {
    const id = setInterval(() => setNow(Math.floor(Date.now() / 1000)), ms);
    return () => clearInterval(id);
  }, [ms]);
  return now;
}

export function useStats() {
  const client = useClient();
  return useQuery({
    queryKey: ["partis", "stats"],
    enabled: isDeployed && !!client,
    queryFn: () => client!.readContract({ ...contract(), functionName: "stats" }),
  });
}

/** Every event, newest first. Fine for MVP scale; an indexer can replace this later. */
export function useAllEvents() {
  const client = useClient();
  return useQuery({
    queryKey: ["partis", "events"],
    enabled: isDeployed && !!client,
    queryFn: async (): Promise<PartisEvent[]> => {
      const count = await client!.readContract({ ...contract(), functionName: "eventCount" });
      const pages: Promise<readonly PartisEvent[]>[] = [];
      for (let offset = 0n; offset < count; offset += PAGE) {
        pages.push(client!.readContract({ ...contract(), functionName: "getEvents", args: [offset, PAGE] }));
      }
      return (await Promise.all(pages)).flat().reverse();
    },
  });
}

export function useEvent(eventId: bigint | null) {
  const client = useClient();
  return useQuery({
    queryKey: ["partis", "event", eventId?.toString()],
    enabled: isDeployed && !!client && eventId !== null && eventId > 0n,
    retry: false,
    queryFn: () => client!.readContract({ ...contract(), functionName: "getEvent", args: [eventId!] }),
  });
}

export interface OwnedPass {
  pass: PassView;
  event: PartisEvent;
}

/** Passes currently held by `owner`, joined with their events. */
export function useOwnedPasses(owner: Address | undefined) {
  const client = useClient();
  return useQuery({
    queryKey: ["partis", "owned", owner],
    enabled: isDeployed && !!client && !!owner,
    queryFn: async (): Promise<OwnedPass[]> => {
      const c = client!;
      const balance = await c.readContract({ ...contract(), functionName: "balanceOf", args: [owner!] });
      const ids: bigint[] = [];
      for (let offset = 0n; offset < balance; offset += PAGE) {
        ids.push(
          ...(await c.readContract({
            ...contract(),
            functionName: "getOwnerTokenIds",
            args: [owner!, offset, PAGE],
          })),
        );
      }
      if (ids.length === 0) return [];

      const passes: PassView[] = [];
      for (let i = 0; i < ids.length; i += Number(PAGE)) {
        passes.push(
          ...(await c.readContract({
            ...contract(),
            functionName: "getPasses",
            args: [ids.slice(i, i + Number(PAGE))],
          })),
        );
      }
      const events = await loadEvents(c, [...new Set(passes.map((p) => p.eventId))]);
      return passes
        .map((pass) => ({ pass, event: events.get(pass.eventId)! }))
        .sort((a, b) => Number(b.event.startTime - a.event.startTime));
    },
  });
}

/** Events created by `organizer`, newest first. */
export function useOrganizerEvents(organizer: Address | undefined) {
  const client = useClient();
  return useQuery({
    queryKey: ["partis", "organizer", organizer],
    enabled: isDeployed && !!client && !!organizer,
    queryFn: async (): Promise<PartisEvent[]> => {
      const c = client!;
      const count = await c.readContract({
        ...contract(),
        functionName: "organizerEventCount",
        args: [organizer!],
      });
      const ids: bigint[] = [];
      for (let offset = 0n; offset < count; offset += PAGE) {
        ids.push(
          ...(await c.readContract({
            ...contract(),
            functionName: "getOrganizerEventIds",
            args: [organizer!, offset, PAGE],
          })),
        );
      }
      const events = await loadEvents(c, ids);
      return ids.map((id) => events.get(id)!).reverse();
    },
  });
}

/** Issued passes for one event (first page), with live owners — for the organizer view. */
export function useEventPasses(eventId: bigint | null, enabled = true) {
  const client = useClient();
  return useQuery({
    queryKey: ["partis", "eventPasses", eventId?.toString()],
    enabled: isDeployed && !!client && eventId !== null && enabled,
    queryFn: async () => {
      const c = client!;
      const [total, ids] = await Promise.all([
        c.readContract({ ...contract(), functionName: "eventPassCount", args: [eventId!] }),
        c.readContract({ ...contract(), functionName: "getEventTokenIds", args: [eventId!, 0n, PAGE] }),
      ]);
      const passes = ids.length
        ? await c.readContract({ ...contract(), functionName: "getPasses", args: [ids] })
        : [];
      return { total, passes };
    },
  });
}

export function useStaff(eventId: bigint | null, enabled = true) {
  const client = useClient();
  return useQuery({
    queryKey: ["partis", "staff", eventId?.toString()],
    enabled: isDeployed && !!client && eventId !== null && enabled,
    queryFn: () => client!.readContract({ ...contract(), functionName: "getStaff", args: [eventId!] }),
  });
}

export function useIsOperator(eventId: bigint | null, account: Address | undefined) {
  const client = useClient();
  return useQuery({
    queryKey: ["partis", "operator", eventId?.toString(), account],
    enabled: isDeployed && !!client && eventId !== null && !!account,
    queryFn: () =>
      client!.readContract({ ...contract(), functionName: "isCheckInOperator", args: [eventId!, account!] }),
  });
}

export function useHasClaimed(eventId: bigint | null, account: Address | undefined) {
  const client = useClient();
  return useQuery({
    queryKey: ["partis", "claimed", eventId?.toString(), account],
    enabled: isDeployed && !!client && eventId !== null && !!account,
    queryFn: () =>
      client!.readContract({ ...contract(), functionName: "hasClaimed", args: [eventId!, account!] }),
  });
}

type Client = NonNullable<ReturnType<typeof useClient>>;

async function loadEvents(c: Client, ids: bigint[]): Promise<Map<bigint, PartisEvent>> {
  const map = new Map<bigint, PartisEvent>();
  for (let i = 0; i < ids.length; i += Number(PAGE)) {
    const chunk = ids.slice(i, i + Number(PAGE));
    const events = await c.readContract({ ...contract(), functionName: "getEventsByIds", args: [chunk] });
    events.forEach((e) => map.set(e.id, e));
  }
  return map;
}
