// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {PartisBase} from "./Base.t.sol";
import {PartisEventPass} from "../src/PartisEventPass.sol";

contract EventLifecycleTest is PartisBase {
    function test_createEvent_storesConfiguration() public {
        uint256 id = _createEvent(0, 50);
        assertEq(id, 1);
        assertEq(partis.eventCount(), 1);

        PartisEventPass.EventData memory e = partis.getEvent(id);
        assertEq(e.id, 1);
        assertEq(e.organizer, organizer);
        assertEq(e.paymentAsset, address(0));
        assertEq(e.name, "BOT Builders Meetup");
        assertEq(e.venue, "Lagos, Yaba Tech Hub");
        assertEq(e.passName, "General Admission");
        assertEq(e.maxSupply, 50);
        assertEq(e.minted, 0);
        assertEq(e.price, 0);
        assertEq(e.createdAt, T0);
        assertTrue(e.onePerWallet);
        assertEq(uint8(e.status), uint8(PartisEventPass.EventStatus.Active));
    }

    function test_createEvent_emits() public {
        PartisEventPass.EventConfig memory c = _config(1 ether, 10);
        vm.expectEmit(true, true, false, true);
        emit PartisEventPass.EventCreated(1, organizer, 1 ether, 10, c.startTime);
        vm.prank(organizer);
        partis.createEvent(c);
    }

    function test_createEvent_tracksOrganizers() public {
        _createEvent(0, 10);
        _createEvent(0, 10);
        vm.prank(alice);
        partis.createEvent(_config(0, 5));

        assertEq(partis.totalOrganizers(), 2);
        assertEq(partis.organizerEventCount(organizer), 2);
        uint256[] memory ids = partis.getOrganizerEventIds(organizer, 0, 10);
        assertEq(ids.length, 2);
        assertEq(ids[0], 1);
        assertEq(ids[1], 2);
    }

    function test_createEvent_rejectsInvalidConfig() public {
        PartisEventPass.EventConfig memory c;

        c = _config(0, 10);
        c.name = "";
        _expectInvalid(c, "name");

        c = _config(0, 10);
        c.venue = "";
        _expectInvalid(c, "venue");

        c = _config(0, 10);
        c.passName = "";
        _expectInvalid(c, "pass name");

        c = _config(0, 10);
        c.endTime = c.startTime;
        _expectInvalid(c, "start must be before end");

        c = _config(0, 10);
        c.startTime = T0 - 2 days;
        c.endTime = T0 - 1;
        c.checkInStart = T0 - 2 days;
        c.checkInEnd = T0 - 1;
        _expectInvalid(c, "event already ended");

        c = _config(0, 10);
        c.checkInStart = c.checkInEnd;
        _expectInvalid(c, "check-in window");

        c = _config(0, 10);
        c.checkInEnd = c.endTime + 1;
        _expectInvalid(c, "check-in must close by event end");

        c = _config(0, 0);
        _expectInvalid(c, "supply");

        c = _config(0, uint32(partis.MAX_SUPPLY_PER_EVENT() + 1));
        _expectInvalid(c, "supply");
    }

    function test_createEvent_rejectsOversizedStrings() public {
        PartisEventPass.EventConfig memory c = _config(0, 10);
        c.name = string(new bytes(partis.MAX_NAME_LENGTH() + 1));
        _expectInvalid(c, "name");

        c = _config(0, 10);
        c.description = string(new bytes(partis.MAX_DESCRIPTION_LENGTH() + 1));
        _expectInvalid(c, "description too long");
    }

    function test_getEvent_revertsForUnknownId() public {
        vm.expectRevert(abi.encodeWithSelector(PartisEventPass.EventNotFound.selector, 7));
        partis.getEvent(7);
    }

    function test_getEvents_paginates() public {
        for (uint256 i; i < 5; ++i) {
            _createEvent(0, 10);
        }
        PartisEventPass.EventData[] memory page = partis.getEvents(1, 3);
        assertEq(page.length, 3);
        assertEq(page[0].id, 2);
        assertEq(page[2].id, 4);

        page = partis.getEvents(4, 10);
        assertEq(page.length, 1);
        assertEq(page[0].id, 5);

        page = partis.getEvents(5, 10);
        assertEq(page.length, 0);
    }

    function test_getEvents_rejectsOversizedPage() public {
        vm.expectRevert(abi.encodeWithSelector(PartisEventPass.PageTooLarge.selector, 101));
        partis.getEvents(0, 101);
    }

    function test_updateEventDetails_onlyOrganizer() public {
        uint256 id = _createEvent(0, 10);
        vm.prank(mallory);
        vm.expectRevert(abi.encodeWithSelector(PartisEventPass.NotOrganizer.selector, id, mallory));
        partis.updateEventDetails(id, "hijacked", "elsewhere");

        vm.prank(organizer);
        partis.updateEventDetails(id, "New description", "Abuja");
        PartisEventPass.EventData memory e = partis.getEvent(id);
        assertEq(e.description, "New description");
        assertEq(e.venue, "Abuja");
    }

    function test_setSalesPaused_onlyOrganizer() public {
        uint256 id = _createEvent(0, 10);
        vm.prank(mallory);
        vm.expectRevert(abi.encodeWithSelector(PartisEventPass.NotOrganizer.selector, id, mallory));
        partis.setSalesPaused(id, true);

        vm.prank(organizer);
        partis.setSalesPaused(id, true);
        assertTrue(partis.getEvent(id).salesPaused);
    }

    function _expectInvalid(PartisEventPass.EventConfig memory c, string memory reason) internal {
        vm.expectRevert(abi.encodeWithSelector(PartisEventPass.InvalidEventConfig.selector, reason));
        vm.prank(organizer);
        partis.createEvent(c);
    }
}
