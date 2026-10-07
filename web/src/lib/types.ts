import type { ContractFunctionReturnType } from "viem";
import type { partisAbi } from "./abi";

export type PartisEvent = ContractFunctionReturnType<typeof partisAbi, "view", "getEvent">;
export type PassView = ContractFunctionReturnType<typeof partisAbi, "view", "getPasses">[number];
export type PartisStats = ContractFunctionReturnType<typeof partisAbi, "view", "stats">;

/** Mirrors PartisEventPass.EventStatus. */
export const EventStatus = { Active: 0, Cancelled: 1 } as const;

/** Mirrors PartisEventPass.PassCheck, in declaration order. */
export const PassCheck = {
  Valid: 0,
  EventNotFound: 1,
  PassNotFound: 2,
  WrongEvent: 3,
  AlreadyCheckedIn: 4,
  EventCancelled: 5,
  CheckInNotOpen: 6,
  CheckInClosed: 7,
} as const;

export const passCheckLabel: Record<number, string> = {
  [PassCheck.Valid]: "Valid pass",
  [PassCheck.EventNotFound]: "Event not found",
  [PassCheck.PassNotFound]: "Pass does not exist",
  [PassCheck.WrongEvent]: "Pass is for a different event",
  [PassCheck.AlreadyCheckedIn]: "Already checked in",
  [PassCheck.EventCancelled]: "Event was cancelled",
  [PassCheck.CheckInNotOpen]: "Check-in has not opened yet",
  [PassCheck.CheckInClosed]: "Check-in has closed",
};
