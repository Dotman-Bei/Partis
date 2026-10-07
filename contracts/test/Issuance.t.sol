// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {PartisBase} from "./Base.t.sol";
import {PartisEventPass} from "../src/PartisEventPass.sol";
import {IERC721Receiver} from "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";

/// @dev Contract wallet that tries to claim a second pass from inside onERC721Received.
contract ReentrantClaimer is IERC721Receiver {
    PartisEventPass internal immutable partis;
    uint256 internal immutable eventId;
    bool internal attacked;

    constructor(PartisEventPass p, uint256 id) {
        partis = p;
        eventId = id;
    }

    function attack() external {
        partis.claim(eventId);
    }

    function onERC721Received(address, address, uint256, bytes calldata) external returns (bytes4) {
        if (!attacked) {
            attacked = true;
            partis.claim(eventId); // must revert via nonReentrant
        }
        return IERC721Receiver.onERC721Received.selector;
    }
}

contract IssuanceTest is PartisBase {
    function test_claim_freePass() public {
        uint256 id = _createEvent(0, 10);

        vm.expectEmit(true, true, true, true);
        emit PartisEventPass.PassIssued(id, 1, alice, 0);
        vm.prank(alice);
        uint256 tokenId = partis.claim(id);

        assertEq(tokenId, 1);
        assertEq(partis.ownerOf(tokenId), alice);
        PartisEventPass.PassData memory p = partis.getPass(tokenId);
        assertEq(p.eventId, id);
        assertEq(p.issuedAt, T0);
        assertEq(p.checkedInAt, 0);
        assertEq(partis.getEvent(id).minted, 1);
        assertTrue(partis.hasClaimed(id, alice));
        assertEq(partis.totalPassesIssued(), 1);
        assertEq(partis.totalAttendees(), 1);
    }

    function test_claim_paidPass_enforcesExactPrice() public {
        uint256 id = _createEvent(2 ether, 10);

        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(PartisEventPass.IncorrectPayment.selector, 2 ether, 1 ether));
        partis.claim{value: 1 ether}(id);

        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(PartisEventPass.IncorrectPayment.selector, 2 ether, 3 ether));
        partis.claim{value: 3 ether}(id);

        vm.prank(alice);
        uint256 tokenId = partis.claim{value: 2 ether}(id);
        assertEq(partis.getPass(tokenId).pricePaid, 2 ether);
        assertEq(partis.getEvent(id).proceeds, 2 ether);
        assertEq(address(partis).balance, 2 ether);
        assertEq(partis.totalPaidVolume(), 2 ether);
    }

    function test_claim_freeEventRejectsPayment() public {
        uint256 id = _createEvent(0, 10);
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(PartisEventPass.IncorrectPayment.selector, 0, 1));
        partis.claim{value: 1}(id);
    }

    function test_claim_enforcesMaxSupply() public {
        uint256 id = _createEvent(0, 2);
        vm.prank(alice);
        partis.claim(id);
        vm.prank(bob);
        partis.claim(id);
        vm.prank(mallory);
        vm.expectRevert(abi.encodeWithSelector(PartisEventPass.SoldOut.selector, id));
        partis.claim(id);
    }

    function test_claim_onePerWallet() public {
        uint256 id = _createEvent(0, 10);
        vm.startPrank(alice);
        partis.claim(id);
        vm.expectRevert(abi.encodeWithSelector(PartisEventPass.AlreadyClaimed.selector, id, alice));
        partis.claim(id);
        vm.stopPrank();
    }

    function test_claim_onePerWallet_survivesTransfer() public {
        uint256 id = _createEvent(0, 10);
        vm.startPrank(alice);
        uint256 tokenId = partis.claim(id);
        partis.transferFrom(alice, bob, tokenId);
        vm.expectRevert(abi.encodeWithSelector(PartisEventPass.AlreadyClaimed.selector, id, alice));
        partis.claim(id);
        vm.stopPrank();
    }

    function test_claim_multiplePerWalletWhenAllowed() public {
        PartisEventPass.EventConfig memory c = _config(0, 10);
        c.onePerWallet = false;
        vm.prank(organizer);
        uint256 id = partis.createEvent(c);

        vm.startPrank(alice);
        partis.claim(id);
        partis.claim(id);
        vm.stopPrank();
        assertEq(partis.balanceOf(alice), 2);
        assertEq(partis.totalAttendees(), 1);
    }

    function test_claim_rejectsUnknownEvent() public {
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(PartisEventPass.EventNotFound.selector, 99));
        partis.claim(99);
    }

    function test_claim_rejectsWhenPaused() public {
        uint256 id = _createEvent(0, 10);
        vm.prank(organizer);
        partis.setSalesPaused(id, true);
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(PartisEventPass.SalesPaused.selector, id));
        partis.claim(id);

        vm.prank(organizer);
        partis.setSalesPaused(id, false);
        vm.prank(alice);
        partis.claim(id);
    }

    function test_claim_rejectsAfterEventEnd() public {
        uint256 id = _createEvent(0, 10);
        vm.warp(partis.getEvent(id).endTime);
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(PartisEventPass.SalesEnded.selector, id));
        partis.claim(id);
    }

    function test_claim_blocksReentrancy() public {
        PartisEventPass.EventConfig memory c = _config(0, 10);
        c.onePerWallet = false; // isolate the reentrancy guard from the one-per-wallet rule
        vm.prank(organizer);
        uint256 id = partis.createEvent(c);

        ReentrantClaimer attacker = new ReentrantClaimer(partis, id);
        vm.expectRevert();
        attacker.attack();
        assertEq(partis.getEvent(id).minted, 0);
    }

    function test_eventAndOwnerTokenIds() public {
        uint256 a = _createEvent(0, 10);
        uint256 b = _createEvent(0, 10);
        vm.startPrank(alice);
        partis.claim(a);
        partis.claim(b);
        vm.stopPrank();
        vm.prank(bob);
        partis.claim(a);

        uint256[] memory ids = partis.getEventTokenIds(a, 0, 10);
        assertEq(ids.length, 2);
        assertEq(ids[0], 1);
        assertEq(ids[1], 3);
        assertEq(partis.eventPassCount(a), 2);

        uint256[] memory owned = partis.getOwnerTokenIds(alice, 0, 10);
        assertEq(owned.length, 2);
        assertEq(owned[0], 1);
        assertEq(owned[1], 2);
    }

    function testFuzz_claim_neverExceedsSupply(uint8 supply, uint8 attempts) public {
        vm.assume(supply > 0);
        PartisEventPass.EventConfig memory c = _config(0, supply);
        c.onePerWallet = false;
        vm.prank(organizer);
        uint256 id = partis.createEvent(c);

        for (uint256 i; i < attempts; ++i) {
            vm.prank(alice);
            try partis.claim(id) {} catch {}
        }
        uint32 minted = partis.getEvent(id).minted;
        assertLe(minted, supply);
        assertEq(minted, attempts < supply ? attempts : supply);
    }
}
