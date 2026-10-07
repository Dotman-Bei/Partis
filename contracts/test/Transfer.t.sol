// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {PartisBase} from "./Base.t.sol";
import {PartisEventPass} from "../src/PartisEventPass.sol";

contract TransferTest is PartisBase {
    uint256 internal eventId;
    uint256 internal tokenId;

    function setUp() public override {
        super.setUp();
        eventId = _createEvent(0, 10);
        vm.prank(alice);
        tokenId = partis.claim(eventId);
    }

    function test_transferBeforeCheckIn_allowed() public {
        vm.prank(alice);
        partis.safeTransferFrom(alice, bob, tokenId);
        assertEq(partis.ownerOf(tokenId), bob);
        assertEq(partis.getOwnerTokenIds(bob, 0, 10)[0], tokenId);
        assertEq(partis.balanceOf(alice), 0);
    }

    function test_transferAfterCheckIn_blocked() public {
        vm.warp(partis.getEvent(eventId).checkInStart);
        vm.prank(organizer);
        partis.checkIn(eventId, tokenId);

        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(PartisEventPass.PassAlreadyUsed.selector, tokenId));
        partis.transferFrom(alice, bob, tokenId);
    }

    /// A used pass that somehow changed hands must still read as used.
    function test_usedStatus_preservedAcrossTransferAttempt() public {
        vm.prank(alice);
        partis.transferFrom(alice, bob, tokenId);
        vm.warp(partis.getEvent(eventId).checkInStart);
        vm.prank(organizer);
        partis.checkIn(eventId, tokenId);

        (PartisEventPass.PassCheck result, address holder) = partis.verifyPass(eventId, tokenId);
        assertEq(uint8(result), uint8(PartisEventPass.PassCheck.AlreadyCheckedIn));
        assertEq(holder, bob);
    }
}
