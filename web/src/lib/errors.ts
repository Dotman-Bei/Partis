import {
  BaseError,
  ContractFunctionRevertedError,
  InsufficientFundsError,
  UserRejectedRequestError,
} from "viem";
import { formatPrice } from "./format";
import { passCheckLabel } from "./types";

/** Turns a wallet/RPC/contract error into one plain sentence for a toast. */
export function explainError(error: unknown): string {
  if (!(error instanceof BaseError)) {
    return error instanceof Error ? error.message : "Something went wrong.";
  }
  if (error.walk((e) => e instanceof UserRejectedRequestError)) return "Request rejected in your wallet.";
  if (error.walk((e) => e instanceof InsufficientFundsError)) return "Not enough BOT to cover this transaction.";

  const revert = error.walk((e) => e instanceof ContractFunctionRevertedError);
  if (revert instanceof ContractFunctionRevertedError && revert.data) {
    const args = (revert.data.args ?? []) as readonly unknown[];
    switch (revert.data.errorName) {
      case "EventNotFound":
        return "That event does not exist.";
      case "NotOrganizer":
        return "Only this event's organizer can do that.";
      case "NotCheckInOperator":
        return "This wallet is not authorized to check people in for this event.";
      case "InvalidEventConfig":
        return `Invalid event: ${String(args[0])}.`;
      case "EventIsCancelled":
        return "This event was cancelled.";
      case "SalesPaused":
        return "The organizer has paused pass sales.";
      case "SalesEnded":
        return "Pass sales have ended for this event.";
      case "SoldOut":
        return "All passes have been issued.";
      case "IncorrectPayment":
        return `This pass costs ${formatPrice(args[0] as bigint)}.`;
      case "AlreadyClaimed":
        return "This wallet already claimed a pass for this event.";
      case "PassNotValid":
        return passCheckLabel[Number(args[2])] ?? "Pass is not valid.";
      case "PassAlreadyUsed":
        return "A checked-in pass cannot be transferred.";
      case "InvalidStaff":
        return "That address cannot be added as staff.";
      case "StaffLimitReached":
        return "This event already has the maximum number of staff.";
      case "CannotCancel":
        return `Cannot cancel: ${String(args[0])}.`;
      case "EventNotCancelled":
        return "Refunds are only available for cancelled events.";
      case "NotPassHolder":
        return "Only the current holder can do that.";
      case "WithdrawLocked":
        return "Proceeds unlock when the event ends.";
      case "NothingToWithdraw":
        return "There is nothing to withdraw.";
      case "PaymentFailed":
        return "The payment transfer failed.";
    }
  }
  return error.shortMessage || error.message;
}
