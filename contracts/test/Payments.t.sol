// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {PartisBase} from "./Base.t.sol";
import {PartisEventPass} from "../src/PartisEventPass.sol";

/// @dev Organizer contract that tries to re-enter withdrawProceeds when paid.
contract ReentrantOrganizer {
    PartisEventPass internal immutable partis;
    uint256 public eventId;
    uint256 public reentries;

    constructor(PartisEventPass p) {
        partis = p;
    }

    function create(PartisEventPass.EventConfig calldata c) external {
        eventId = partis.createEvent(c);
    }

    function withdraw() external {
        partis.withdrawProceeds(eventId);
    }

    receive() external payable {
        reentries++;
        try partis.withdrawProceeds(eventId) {} catch {}
    }
}

/// @dev Wallet that rejects native payments.
contract RejectingHolder {
    function claim(PartisEventPass p, uint256 id) external payable {
        p.claim{value: msg.value}(id);
    }

    function refund(PartisEventPass p, uint256 tokenId) external {
        p.refund(tokenId);
    }

    function onERC721Received(address, address, uint256, bytes calldata) external pure returns (bytes4) {
        return this.onERC721Received.selector;
    }
}

contract PaymentsTest is PartisBase {
    uint128 internal constant PRICE = 2 ether;

    function test_withdraw_afterEventEnd() public {
        uint256 id = _createEvent(PRICE, 10);
        vm.prank(alice);
        partis.claim{value: PRICE}(id);
        vm.prank(bob);
        partis.claim{value: PRICE}(id);

        uint64 endTime = partis.getEvent(id).endTime;
        vm.prank(organizer);
        vm.expectRevert(abi.encodeWithSelector(PartisEventPass.WithdrawLocked.selector, id, endTime));
        partis.withdrawProceeds(id);

        vm.warp(partis.getEvent(id).endTime);
        vm.expectEmit(true, true, false, true);
        emit PartisEventPass.ProceedsWithdrawn(id, organizer, 4 ether);
        vm.prank(organizer);
        partis.withdrawProceeds(id);

        assertEq(organizer.balance, 4 ether);
        assertEq(partis.getEvent(id).proceeds, 0);
        assertEq(address(partis).balance, 0);

        vm.prank(organizer);
        vm.expectRevert(abi.encodeWithSelector(PartisEventPass.NothingToWithdraw.selector, id));
        partis.withdrawProceeds(id);
    }

    function test_withdraw_onlyOrganizer() public {
        uint256 id = _createEvent(PRICE, 10);
        vm.prank(alice);
        partis.claim{value: PRICE}(id);
        vm.warp(partis.getEvent(id).endTime);
        vm.prank(mallory);
        vm.expectRevert(abi.encodeWithSelector(PartisEventPass.NotOrganizer.selector, id, mallory));
        partis.withdrawProceeds(id);
    }

    function test_withdraw_isolatedPerEvent() public {
        uint256 a = _createEvent(PRICE, 10);
        vm.prank(mallory);
        uint256 b = partis.createEvent(_config(1 ether, 10));
        vm.prank(alice);
        partis.claim{value: PRICE}(a);
        vm.prank(bob);
        partis.claim{value: 1 ether}(b);

        vm.warp(partis.getEvent(b).endTime);
        uint256 before = mallory.balance;
        vm.prank(mallory);
        partis.withdrawProceeds(b);
        assertEq(mallory.balance - before, 1 ether);
        assertEq(address(partis).balance, PRICE);
    }

    function test_withdraw_blocksReentrancy() public {
        ReentrantOrganizer org = new ReentrantOrganizer(partis);
        org.create(_config(PRICE, 10));
        uint256 id = org.eventId();
        vm.prank(alice);
        partis.claim{value: PRICE}(id);
        vm.prank(bob);
        partis.claim{value: PRICE}(id);

        vm.warp(partis.getEvent(id).endTime);
        org.withdraw();
        assertEq(address(org).balance, 4 ether); // paid exactly once
        assertEq(org.reentries(), 1);
        assertEq(address(partis).balance, 0);
    }

    function test_cancel_thenRefund() public {
        uint256 id = _createEvent(PRICE, 10);
        vm.prank(alice);
        uint256 tokenId = partis.claim{value: PRICE}(id);

        vm.prank(organizer);
        partis.cancelEvent(id);
        assertEq(uint8(partis.getEvent(id).status), uint8(PartisEventPass.EventStatus.Cancelled));

        uint256 before = alice.balance;
        vm.prank(alice);
        partis.refund(tokenId);
        assertEq(alice.balance - before, PRICE);
        assertEq(partis.balanceOf(alice), 0);
        assertEq(partis.getEvent(id).refunded, 1);
        assertEq(partis.getEvent(id).proceeds, 0);

        (PartisEventPass.PassCheck result,) = partis.verifyPass(id, tokenId);
        assertEq(uint8(result), uint8(PartisEventPass.PassCheck.PassNotFound));

        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(PartisEventPass.NotPassHolder.selector, tokenId, alice));
        partis.refund(tokenId);
    }

    function test_cancel_blocksIssuanceCheckInAndWithdraw() public {
        uint256 id = _createEvent(PRICE, 10);
        vm.prank(alice);
        uint256 tokenId = partis.claim{value: PRICE}(id);
        vm.prank(organizer);
        partis.cancelEvent(id);

        vm.prank(bob);
        vm.expectRevert(abi.encodeWithSelector(PartisEventPass.EventIsCancelled.selector, id));
        partis.claim{value: PRICE}(id);

        vm.warp(partis.getEvent(id).checkInStart);
        (PartisEventPass.PassCheck result,) = partis.verifyPass(id, tokenId);
        assertEq(uint8(result), uint8(PartisEventPass.PassCheck.EventCancelled));

        vm.warp(partis.getEvent(id).endTime);
        vm.prank(organizer);
        vm.expectRevert(abi.encodeWithSelector(PartisEventPass.EventIsCancelled.selector, id));
        partis.withdrawProceeds(id);
    }

    function test_cancel_rules() public {
        uint256 id = _createEvent(0, 10);
        vm.prank(mallory);
        vm.expectRevert(abi.encodeWithSelector(PartisEventPass.NotOrganizer.selector, id, mallory));
        partis.cancelEvent(id);

        vm.prank(alice);
        uint256 tokenId = partis.claim(id);
        vm.warp(partis.getEvent(id).checkInStart);
        vm.prank(organizer);
        partis.checkIn(id, tokenId);
        vm.prank(organizer);
        vm.expectRevert(abi.encodeWithSelector(PartisEventPass.CannotCancel.selector, "attendees already checked in"));
        partis.cancelEvent(id);

        uint256 ended = _createEvent(0, 10);
        vm.warp(partis.getEvent(ended).endTime);
        vm.prank(organizer);
        vm.expectRevert(abi.encodeWithSelector(PartisEventPass.CannotCancel.selector, "event already ended"));
        partis.cancelEvent(ended);
    }

    function test_refund_requiresCancelledEvent() public {
        uint256 id = _createEvent(PRICE, 10);
        vm.prank(alice);
        uint256 tokenId = partis.claim{value: PRICE}(id);
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(PartisEventPass.EventNotCancelled.selector, id));
        partis.refund(tokenId);
    }

    function test_refund_paysCurrentHolderOnly() public {
        uint256 id = _createEvent(PRICE, 10);
        vm.prank(alice);
        uint256 tokenId = partis.claim{value: PRICE}(id);
        vm.prank(alice);
        partis.transferFrom(alice, bob, tokenId);
        vm.prank(organizer);
        partis.cancelEvent(id);

        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(PartisEventPass.NotPassHolder.selector, tokenId, alice));
        partis.refund(tokenId);

        uint256 before = bob.balance;
        vm.prank(bob);
        partis.refund(tokenId);
        assertEq(bob.balance - before, PRICE);
    }

    function test_refund_failedPaymentReverts() public {
        uint256 id = _createEvent(PRICE, 10);
        RejectingHolder holder = new RejectingHolder();
        holder.claim{value: PRICE}(partis, id);
        vm.prank(organizer);
        partis.cancelEvent(id);

        vm.expectRevert(PartisEventPass.PaymentFailed.selector);
        holder.refund(partis, 1);
        assertEq(partis.ownerOf(1), address(holder)); // state rolled back, pass still refundable
    }

    function test_noStrayBalance_invariantAcrossFlows() public {
        uint256 id = _createEvent(PRICE, 10);
        vm.prank(alice);
        partis.claim{value: PRICE}(id);
        vm.prank(bob);
        uint256 bobToken = partis.claim{value: PRICE}(id);
        vm.prank(organizer);
        partis.cancelEvent(id);
        vm.prank(bob);
        partis.refund(bobToken);
        assertEq(address(partis).balance, partis.getEvent(id).proceeds);
    }
}
