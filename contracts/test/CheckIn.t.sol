// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {PartisBase} from "./Base.t.sol";
import {PartisEventPass} from "../src/PartisEventPass.sol";

/// @notice Covers PRD §12 (entrance verification) and the §23 threat model:
///         copied QR, replay, fake pass, wrong event, unauthorized staff.
contract CheckInTest is PartisBase {
    uint256 internal eventId;
    uint256 internal tokenId;

    function setUp() public override {
        super.setUp();
        eventId = _createEvent(0, 10);
        vm.prank(alice);
        tokenId = partis.claim(eventId);
        vm.prank(organizer);
        partis.setStaff(eventId, staff, true);
    }

    function _openCheckIn() internal {
        vm.warp(partis.getEvent(eventId).checkInStart);
    }

    function _expectCheck(uint256 evt, uint256 tok, PartisEventPass.PassCheck expected) internal view {
        (PartisEventPass.PassCheck result,) = partis.verifyPass(evt, tok);
        assertEq(uint8(result), uint8(expected));
    }

    // --- happy path ---------------------------------------------------------

    function test_checkIn_byStaff() public {
        _openCheckIn();
        (PartisEventPass.PassCheck result, address holder) = partis.verifyPass(eventId, tokenId);
        assertEq(uint8(result), uint8(PartisEventPass.PassCheck.Valid));
        assertEq(holder, alice);

        vm.expectEmit(true, true, true, true);
        emit PartisEventPass.CheckedIn(eventId, tokenId, alice, staff);
        vm.prank(staff);
        partis.checkIn(eventId, tokenId);

        PartisEventPass.PassData memory p = partis.getPass(tokenId);
        assertEq(p.checkedInAt, block.timestamp);
        assertEq(p.checkedInBy, staff);
        assertEq(partis.getEvent(eventId).checkedIn, 1);
        assertEq(partis.totalCheckIns(), 1);
    }

    function test_checkIn_byOrganizer() public {
        _openCheckIn();
        vm.prank(organizer);
        partis.checkIn(eventId, tokenId);
        assertEq(partis.getPass(tokenId).checkedInBy, organizer);
    }

    // --- threat: replay / copied QR -------------------------------------------

    function test_checkIn_secondAttemptRejected() public {
        _openCheckIn();
        vm.prank(staff);
        partis.checkIn(eventId, tokenId);

        _expectCheck(eventId, tokenId, PartisEventPass.PassCheck.AlreadyCheckedIn);
        vm.prank(organizer);
        vm.expectRevert(
            abi.encodeWithSelector(
                PartisEventPass.PassNotValid.selector, eventId, tokenId, PartisEventPass.PassCheck.AlreadyCheckedIn
            )
        );
        partis.checkIn(eventId, tokenId);
        assertEq(partis.getEvent(eventId).checkedIn, 1);
    }

    // --- threat: fake pass ------------------------------------------------------

    function test_checkIn_nonexistentPassRejected() public {
        _openCheckIn();
        _expectCheck(eventId, 999, PartisEventPass.PassCheck.PassNotFound);
        vm.prank(staff);
        vm.expectRevert(
            abi.encodeWithSelector(
                PartisEventPass.PassNotValid.selector, eventId, 999, PartisEventPass.PassCheck.PassNotFound
            )
        );
        partis.checkIn(eventId, 999);
    }

    function test_verifyPass_nonexistentEvent() public view {
        _expectCheck(42, tokenId, PartisEventPass.PassCheck.EventNotFound);
    }

    // --- threat: wrong event ------------------------------------------------------

    function test_checkIn_wrongEventRejected() public {
        uint256 other = _createEvent(0, 10);
        vm.prank(bob);
        uint256 otherToken = partis.claim(other);

        _openCheckIn();
        _expectCheck(eventId, otherToken, PartisEventPass.PassCheck.WrongEvent);
        vm.prank(organizer);
        vm.expectRevert(
            abi.encodeWithSelector(
                PartisEventPass.PassNotValid.selector, eventId, otherToken, PartisEventPass.PassCheck.WrongEvent
            )
        );
        partis.checkIn(eventId, otherToken);
    }

    /// The organizer of event A is not staff for event B and cannot admit to it.
    function test_checkIn_organizerOfOtherEventRejected() public {
        vm.prank(mallory);
        uint256 malloryEvent = partis.createEvent(_config(0, 10));
        _openCheckIn();
        vm.prank(mallory);
        vm.expectRevert(abi.encodeWithSelector(PartisEventPass.NotCheckInOperator.selector, eventId, mallory));
        partis.checkIn(eventId, tokenId);
        assertFalse(partis.isCheckInOperator(eventId, mallory));
        assertTrue(partis.isCheckInOperator(malloryEvent, mallory));
    }

    // --- threat: unauthorized staff -------------------------------------------------

    function test_checkIn_unauthorizedRejected() public {
        _openCheckIn();
        vm.prank(mallory);
        vm.expectRevert(abi.encodeWithSelector(PartisEventPass.NotCheckInOperator.selector, eventId, mallory));
        partis.checkIn(eventId, tokenId);

        // Even the pass holder cannot check themselves in.
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(PartisEventPass.NotCheckInOperator.selector, eventId, alice));
        partis.checkIn(eventId, tokenId);
    }

    function test_checkIn_revokedStaffRejected() public {
        vm.prank(organizer);
        partis.setStaff(eventId, staff, false);
        _openCheckIn();
        vm.prank(staff);
        vm.expectRevert(abi.encodeWithSelector(PartisEventPass.NotCheckInOperator.selector, eventId, staff));
        partis.checkIn(eventId, tokenId);
    }

    function test_setStaff_onlyOrganizer() public {
        vm.prank(staff);
        vm.expectRevert(abi.encodeWithSelector(PartisEventPass.NotOrganizer.selector, eventId, staff));
        partis.setStaff(eventId, mallory, true);
    }

    function test_setStaff_listAndLimits() public {
        address[] memory list = partis.getStaff(eventId);
        assertEq(list.length, 1);
        assertEq(list[0], staff);

        vm.startPrank(organizer);
        vm.expectRevert(abi.encodeWithSelector(PartisEventPass.InvalidStaff.selector, address(0)));
        partis.setStaff(eventId, address(0), true);
        vm.expectRevert(abi.encodeWithSelector(PartisEventPass.InvalidStaff.selector, organizer));
        partis.setStaff(eventId, organizer, true);

        for (uint160 i = 1; i < partis.MAX_STAFF_PER_EVENT(); ++i) {
            partis.setStaff(eventId, address(i + 1000), true);
        }
        vm.expectRevert(abi.encodeWithSelector(PartisEventPass.StaffLimitReached.selector, eventId));
        partis.setStaff(eventId, address(5000), true);
        vm.stopPrank();
    }

    // --- check-in window ------------------------------------------------------------

    function test_checkIn_beforeWindowRejected() public {
        _expectCheck(eventId, tokenId, PartisEventPass.PassCheck.CheckInNotOpen);
        vm.prank(staff);
        vm.expectRevert(
            abi.encodeWithSelector(
                PartisEventPass.PassNotValid.selector, eventId, tokenId, PartisEventPass.PassCheck.CheckInNotOpen
            )
        );
        partis.checkIn(eventId, tokenId);
    }

    function test_checkIn_afterWindowRejected() public {
        vm.warp(partis.getEvent(eventId).checkInEnd);
        _expectCheck(eventId, tokenId, PartisEventPass.PassCheck.CheckInClosed);
        vm.prank(staff);
        vm.expectRevert(
            abi.encodeWithSelector(
                PartisEventPass.PassNotValid.selector, eventId, tokenId, PartisEventPass.PassCheck.CheckInClosed
            )
        );
        partis.checkIn(eventId, tokenId);
    }

    /// Verification always reports the *current* holder.
    function test_verifyPass_followsOwnership() public {
        vm.prank(alice);
        partis.transferFrom(alice, bob, tokenId);
        _openCheckIn();
        (, address holder) = partis.verifyPass(eventId, tokenId);
        assertEq(holder, bob);
    }
}
